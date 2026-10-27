<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\TaskNotification;
use App\Models\TaskRead;
use App\Models\User;
use App\Support\TaskAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $request->validate([
            'status'        => 'nullable|in:pending,in_progress,completed',
            'priority'      => 'nullable|in:low,medium,high',
            'department_id' => 'nullable|integer',
            'assignee_id'   => 'nullable|integer',
            'creator_id'    => 'nullable|integer',
            'due'           => 'nullable|in:overdue,today,week,none',
            'due_from'      => 'nullable|date',
            'due_to'        => 'nullable|date',
        ]);

        // workflowSteps is needed by the edit form: without it, opening a
        // workflow task from the board looked workflow-less and saving it removed the chain.
        $query = Task::with(['creator:id,name,avatar', 'assignees:id,name,avatar', 'department:id,name', 'attachments', 'workflowSteps.user:id,name']);
        $user = $request->user();

        // Honour ?per_page= (the Kanban board asks for 100) instead of silently
        // truncating the board to the first 20 tasks.
        $perPage = $request->filled('per_page') ? min(max((int) $request->per_page, 1), 200) : 20;

        // ── Groups scope: private tasks only, membership-restricted ────────────
        if ($request->scope === 'groups') {
            $query->where('is_private', true)->whereNull('parent_group_id');
            // Archived groups live on their own tab: ?archived=1 shows only those, otherwise they're hidden.
            $request->boolean('archived') ? $query->whereNotNull('archived_at') : $query->whereNull('archived_at');
            if (!$user->isSuperAdmin()) {
                $query->where(function ($q) use ($user) {
                    $q->where('creator_id', $user->id)
                      ->orWhereHas('assignees', fn($q2) => $q2->where('users.id', $user->id));
                });
            }
            return response()->json($query->latest()->paginate($perPage));
        }

        // ── Normal tasks: never include private groups ──────────────────────────
        $query->where('is_private', false);

        // Filters narrow the result; they run before the role scoping below, which
        // is AND-ed on top, so a filter can never reveal a task the user couldn't already see.
        $this->applyFilters($query, $request, $user);

        if ($user->isAdminOrAbove()) {
            // Admin / Super Admin see everything — no filter
        } elseif ($user->isManager()) {
            // Manager sees their department's tasks, tasks they created, and tasks they've been mentioned on
            $query->where(function ($q) use ($user) {
                if ($user->department_id) {
                    $q->where('department_id', $user->department_id);
                }
                $q->orWhere('creator_id', $user->id)
                  ->orWhereHas('mentions', fn($q2) => $q2->where('users.id', $user->id))
                  // Assigned to them from another department — canView already allows it.
                  ->orWhereHas('assignees', fn($q2) => $q2->where('users.id', $user->id));
            });
        } else {
            // Employee sees only tasks assigned to them, within their department
            $query->where(function ($q) use ($user) {
                $q->whereHas('assignees', fn($q2) => $q2->where('users.id', $user->id))
                  ->orWhere('creator_id', $user->id);
            });
            if ($user->department_id) {
                $query->where(function ($q) use ($user) {
                    $q->where('department_id', $user->department_id)
                      ->orWhereNull('department_id');
                });
            }
        }

        return response()->json($query->latest()->paginate($perPage));
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'sometimes|in:pending,in_progress,completed',
            'priority' => 'sometimes|in:low,medium,high',
            'department_id' => 'nullable|exists:departments,id',
            'due_date' => 'nullable|date',
            'assignees' => 'nullable|array',
            'assignees.*' => 'exists:users,id',
            'mentions' => 'nullable|array',
            'mentions.*' => 'exists:users,id',
            'recurrence' => 'nullable|in:daily,weekly,monthly',
            'recurrence_end_date' => 'nullable|date',
            'is_private' => 'sometimes|boolean',
        ]);

        $isPrivate = $request->boolean('is_private');

        $task = Task::create([
            'title'            => $request->title,
            'description'      => $request->description,
            'status'           => $request->status ?? 'pending',
            'priority'         => $request->priority ?? 'medium',
            'creator_id'       => $request->user()->id,
            'department_id'    => $request->department_id,
            'due_date'         => $request->due_date,
            'workflow_enabled' => false,
            'recurrence'          => $isPrivate ? null : $request->recurrence,
            'recurrence_end_date' => $isPrivate ? null : $request->recurrence_end_date,
            'is_private'       => $isPrivate,
        ]);

        if ($request->assignees) {
            $task->assignees()->sync($request->assignees);
            foreach ($request->assignees as $userId) {
                TaskNotification::create([
                    'user_id' => $userId,
                    'type' => 'task_assigned',
                    'data' => [
                        'task_id' => $task->id,
                        'task_title' => $task->title,
                        'assigned_by' => $request->user()->name,
                    ],
                ]);
            }
        }

        // Mentions never apply to a private group — the closed circle is exactly the point.
        if ($request->mentions && !$isPrivate) {
            $task->mentions()->sync($request->mentions);
            foreach ($request->mentions as $userId) {
                TaskNotification::create([
                    'user_id' => $userId,
                    'type' => 'task_mentioned',
                    'data' => [
                        'task_id' => $task->id,
                        'task_title' => $task->title,
                        'mentioned_by' => $request->user()->name,
                    ],
                ]);
            }
        }

        ActivityLog::record('task_created', $task, [], $task->toArray());

        return response()->json($task->load(['creator:id,name', 'assignees:id,name,avatar', 'department:id,name']), 201);
    }

    /**
     * POST /tasks/groups — dedicated, permission-free entry point for private
     * groups. Any authenticated user (Employee, Manager, Admin) can create one;
     * this is deliberately separate from store() so it can never be used to
     * create a normal (non-private) task and bypass the tasks.create gate.
     */
    public function storeGroup(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'assignees' => 'nullable|array',
            'assignees.*' => 'exists:users,id',
        ]);

        $task = Task::create([
            'title'            => $request->title,
            'description'      => $request->description,
            'status'           => 'pending',
            'priority'         => 'medium',
            'creator_id'       => $request->user()->id,
            'workflow_enabled' => false,
            'is_private'       => true,
        ]);

        if ($request->assignees) {
            $task->assignees()->sync($request->assignees);
            foreach ($request->assignees as $userId) {
                TaskNotification::create([
                    'user_id' => $userId,
                    'type' => 'task_assigned',
                    'data' => [
                        'task_id' => $task->id,
                        'task_title' => $task->title,
                        'assigned_by' => $request->user()->name,
                    ],
                ]);
            }
        }

        ActivityLog::record('task_created', $task, [], $task->toArray());

        return response()->json($task->load(['creator:id,name', 'assignees:id,name,avatar']), 201);
    }

    /**
     * GET /tasks/{groupId}/subtasks — every task created inside a group.
     * Channel-visible: any member of the group (not just the sub-task's own
     * assignees) can see the list, via TaskAccess::canView on the parent.
     */
    public function subtasks(string $groupId)
    {
        $group = Task::with(['assignees'])->findOrFail($groupId);

        if (!TaskAccess::canView(auth()->user(), $group)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json(
            $group->childTasks()->with(['creator:id,name,avatar', 'assignees:id,name,avatar'])->latest()->get()
        );
    }

    /**
     * POST /tasks/{groupId}/subtasks — any member of the group can create a task
     * inside it (permission-free, same reasoning as POST /tasks/groups). Assignees
     * must be a subset of the group's own members — a sub-task can never reach
     * outside the group's closed circle.
     */
    public function storeSubtask(Request $request, string $groupId)
    {
        $group = Task::with(['assignees'])->findOrFail($groupId);
        $user = $request->user();

        if (!$group->is_private || $group->parent_group_id) {
            return response()->json(['message' => 'Tasks can only be created inside a top-level group.'], 422);
        }

        if (!TaskAccess::canView($user, $group)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($group)) {
            return response()->json(['message' => TaskAccess::lockedMessage($group)], 423);
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'sometimes|in:low,medium,high',
            'due_date' => 'nullable|date',
            'assignees' => 'required|array|min:1',
            'assignees.*' => 'exists:users,id',
            'mentions' => 'nullable|array',
            'mentions.*' => 'exists:users,id',
        ]);

        $groupMemberIds = $group->assignees->pluck('id');
        $invalid = collect($request->assignees)->diff($groupMemberIds);
        if ($invalid->isNotEmpty()) {
            return response()->json(['message' => 'Assignees must be members of this group.'], 422);
        }

        // A mention can additionally reach the group's own creator (not just its
        // assignees) — same "group member" definition used everywhere else.
        $mentionable = $groupMemberIds->push($group->creator_id);
        $invalidMentions = collect($request->mentions ?? [])->diff($mentionable);
        if ($invalidMentions->isNotEmpty()) {
            return response()->json(['message' => 'You can only mention someone from this group.'], 422);
        }

        $task = Task::create([
            'title'            => $request->title,
            'description'      => $request->description,
            'status'           => 'pending',
            'priority'         => $request->priority ?? 'medium',
            'creator_id'       => $user->id,
            'due_date'         => $request->due_date,
            'workflow_enabled' => false,
            'is_private'       => true,
            'parent_group_id'  => $group->id,
        ]);

        $task->assignees()->sync($request->assignees);
        foreach ($request->assignees as $userId) {
            TaskNotification::create([
                'user_id' => $userId,
                'type' => 'task_assigned',
                'data' => [
                    'task_id' => $task->id,
                    'task_title' => $task->title,
                    'assigned_by' => $user->name,
                ],
            ]);
        }

        if ($request->mentions) {
            $task->mentions()->sync($request->mentions);
            foreach ($request->mentions as $userId) {
                TaskNotification::create([
                    'user_id' => $userId,
                    'type' => 'task_mentioned',
                    'data' => [
                        'task_id' => $task->id,
                        'task_title' => $task->title,
                        'mentioned_by' => $user->name,
                    ],
                ]);
            }
        }

        ActivityLog::record('task_created', $task, [], $task->toArray());

        return response()->json($task->load(['creator:id,name,avatar', 'assignees:id,name,avatar', 'mentions:id,name,avatar']), 201);
    }

    public function show(string $id)
    {
        $task = Task::with([
            'creator:id,name,avatar',
            'assignees:id,name,avatar',
            'mentions:id,name,avatar',
            'department:id,name',
            'attachments.user:id,name',
            'workflowSteps.user:id,name,avatar',
            // Full row (not column-restricted) — TaskAccess needs creator_id,
            // is_private, and closed_at off the parent to authorize the child.
            // assignees + creator also feed the sub-task's @mention picker,
            // which is scoped to the whole group, not just this sub-task.
            'parentGroup',
            'parentGroup.assignees:id,name,avatar',
            'parentGroup.creator:id,name,avatar',
        ])->findOrFail($id);

        if (!TaskAccess::canView(auth()->user(), $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json($task);
    }

    public function update(Request $request, string $id)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $user = $request->user();

        if (!TaskAccess::canEdit($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($task) && !$user->isSuperAdmin()) {
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'sometimes|in:low,medium,high',
            'department_id' => 'nullable|exists:departments,id',
            'due_date' => 'nullable|date',
            'assignees' => 'nullable|array',
            'assignees.*' => 'exists:users,id',
            'mentions' => 'nullable|array',
            'mentions.*' => 'exists:users,id',
            'recurrence' => 'nullable|in:daily,weekly,monthly',
            'recurrence_end_date' => 'nullable|date',
        ]);

        $old = $task->toArray();
        $fields = $request->only(['title', 'description', 'priority', 'department_id', 'due_date', 'recurrence', 'recurrence_end_date']);

        // A new deadline means the due-soon / overdue reminders should fire again.
        if ($request->has('due_date')
            && ($task->due_date?->toDateString()) !== ($request->due_date ? Carbon::parse($request->due_date)->toDateString() : null)) {
            $fields['due_reminder_sent_at'] = null;
            $fields['overdue_notified_at'] = null;
        }

        $task->update($fields);

        if ($request->has('assignees')) {
            $task->assignees()->sync($request->assignees ?? []);
        }

        if ($request->has('mentions') && !$task->is_private) {
            $task->mentions()->sync($request->mentions ?? []);
        }

        ActivityLog::record('task_updated', $task, $old, $task->fresh()->toArray());

        return response()->json($task->load(['creator:id,name', 'assignees:id,name,avatar', 'department:id,name']));
    }

    public function updateStatus(Request $request, string $id)
    {
        $request->validate(['status' => 'required|in:pending,in_progress,completed']);

        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $user = $request->user();

        if (!TaskAccess::canView($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($task) && !$user->isSuperAdmin()) {
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        $oldStatus = $task->status;
        $task->update(['status' => $request->status]);

        if ($request->status === 'completed') {
            TaskNotification::create([
                'user_id' => $task->creator_id,
                'type' => 'task_completed',
                'data' => [
                    'task_id' => $task->id,
                    'task_title' => $task->title,
                    'completed_by' => $request->user()->name,
                ],
            ]);
        }

        ActivityLog::record('task_status_changed', $task, ['status' => $oldStatus], ['status' => $request->status]);

        return response()->json($task->load(['creator:id,name', 'assignees:id,name,avatar']));
    }

    /**
     * POST /tasks/{id}/assignees
     * Normal task — Admin/Super Admin: any user; Manager: only their own
     * department's people, on a task in their department or one they've been
     * mentioned on. Private group — creator or Super Admin only, any active user.
     */
    public function addAssignee(Request $request, string $id)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $target = User::findOrFail($request->user_id);
        $user = $request->user();

        $allowed = $task->is_private
            ? TaskAccess::canManageMembers($user, $task)
            : $this->canManageAssignee($user, $task, $target);

        if (!$allowed) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($task) && !$user->isSuperAdmin()) {
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        $task->assignees()->syncWithoutDetaching([$target->id]);

        TaskNotification::create([
            'user_id' => $target->id,
            'type' => 'task_assigned',
            'data' => [
                'task_id' => $task->id,
                'task_title' => $task->title,
                'assigned_by' => $user->name,
            ],
        ]);

        ActivityLog::record('task_assignee_added', $task, [], ['assignee_id' => $target->id]);

        return response()->json($task->load(['assignees:id,name,avatar']));
    }

    /**
     * DELETE /tasks/{id}/assignees/{userId}
     */
    public function removeAssignee(Request $request, string $id, string $userId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $target = User::findOrFail($userId);
        $user = $request->user();

        $allowed = $task->is_private
            ? TaskAccess::canManageMembers($user, $task)
            : $this->canManageAssignee($user, $task, $target);

        if (!$allowed) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($task) && !$user->isSuperAdmin()) {
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        $task->assignees()->detach($target->id);

        ActivityLog::record('task_assignee_removed', $task, ['assignee_id' => $target->id], []);

        return response()->json($task->load(['assignees:id,name,avatar']));
    }

    /**
     * POST /tasks/{id}/mentions
     * Normal task: loop in another department's manager (or an admin) so they
     * can view the task, chat on it, and assign their own team.
     * Sub-task inside a group: tag a fellow member of that same group — the
     * mention itself never reaches outside the group, so it's allowed (unlike
     * the group task itself, whose members list already covers everyone).
     */
    public function addMention(Request $request, string $id)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $task = Task::with(['assignees', 'mentions', 'parentGroup', 'parentGroup.assignees'])->findOrFail($id);
        $target = User::with('role')->findOrFail($request->user_id);
        $user = $request->user();

        // Check membership/view rights before anything else — an outsider must
        // get the same "Unauthorized" a canView() failure would give them on any
        // other endpoint, not a 422 that confirms the task exists and is private.
        if (!TaskAccess::canView($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($task->is_private && !$task->parent_group_id) {
            return response()->json(['message' => "Private groups can't mention outsiders."], 422);
        }

        if (!TaskAccess::canEdit($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($task->parent_group_id) {
            $inGroup = $task->parentGroup
                && ($task->parentGroup->creator_id === $target->id || $task->parentGroup->assignees->contains('id', $target->id));

            if (!$inGroup) {
                return response()->json(['message' => 'You can only mention someone from this group.'], 422);
            }
        } elseif (!in_array($target->role?->name, ['manager', 'admin', 'super_admin'], true)) {
            return response()->json(['message' => 'Only managers and admins can be mentioned.'], 422);
        }

        $task->mentions()->syncWithoutDetaching([$target->id]);

        TaskNotification::create([
            'user_id' => $target->id,
            'type' => 'task_mentioned',
            'data' => [
                'task_id' => $task->id,
                'task_title' => $task->title,
                'mentioned_by' => $user->name,
            ],
        ]);

        ActivityLog::record('task_mention_added', $task, [], ['mentioned_id' => $target->id]);

        return response()->json($task->load(['mentions:id,name,avatar']));
    }

    /**
     * DELETE /tasks/{id}/mentions/{userId}
     */
    public function removeMention(Request $request, string $id, string $userId)
    {
        $task = Task::findOrFail($id);
        $user = $request->user();

        if (!TaskAccess::canEdit($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $task->mentions()->detach($userId);

        ActivityLog::record('task_mention_removed', $task, ['mentioned_id' => (int) $userId], []);

        return response()->json($task->load(['mentions:id,name,avatar']));
    }

    /**
     * POST /tasks/{id}/close — Super Admin only (route-gated). "Stop the group":
     * every write action on it 423s for everyone else until reopened.
     */
    public function close(string $id)
    {
        $task = Task::findOrFail($id);

        if ($task->parent_group_id) {
            return response()->json(['message' => 'Only the group itself can be closed.'], 422);
        }

        $task->update(['closed_at' => now()]);
        ActivityLog::record('task_closed', $task, [], ['closed_at' => (string) $task->closed_at]);

        return response()->json($task);
    }

    /**
     * POST /tasks/{id}/reopen — Super Admin only (route-gated).
     */
    public function reopen(string $id)
    {
        $task = Task::findOrFail($id);

        if ($task->parent_group_id) {
            return response()->json(['message' => 'Only the group itself can be reopened.'], 422);
        }

        $task->update(['closed_at' => null]);
        ActivityLog::record('task_reopened', $task, [], []);

        return response()->json($task);
    }

    /**
     * Board filters: search (title + description), status, priority, department,
     * assignee, creator, "mine", due-date presets and a custom due range.
     */
    private function applyFilters($query, Request $request, $user): void
    {
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->filled('search')) {
            // Escape LIKE wildcards so "100%" or "a_b" match literally. '!' is the escape
            // character because (unlike a backslash) it means the same on MySQL and SQLite.
            $term = '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $request->search) . '%';
            $query->where(fn($q) => $q->whereRaw("title LIKE ? ESCAPE '!'", [$term])
                ->orWhereRaw("description LIKE ? ESCAPE '!'", [$term]));
        }

        if ($request->filled('assignee_id')) {
            $query->whereHas('assignees', fn($q) => $q->where('users.id', $request->assignee_id));
        }

        if ($request->filled('creator_id')) {
            $query->where('creator_id', $request->creator_id);
        }

        if ($request->boolean('mine')) {
            $query->where(fn($q) => $q->where('creator_id', $user->id)
                ->orWhereHas('assignees', fn($a) => $a->where('users.id', $user->id)));
        }

        match ($request->due) {
            'overdue' => $query->overdue(),
            'today'   => $query->whereDate('due_date', today()),
            'week'    => $query->whereDate('due_date', '>=', today())->whereDate('due_date', '<=', today()->addDays(7)),
            'none'    => $query->whereNull('due_date'),
            default   => null,
        };

        if ($request->filled('due_from')) {
            $query->whereDate('due_date', '>=', $request->due_from);
        }

        if ($request->filled('due_to')) {
            $query->whereDate('due_date', '<=', $request->due_to);
        }
    }

    /**
     * POST /tasks/{id}/archive and /unarchive — the group's creator (or the Super Admin)
     * tucks a finished group away. Archived groups leave the main list and become read-only.
     */
    public function archive(Request $request, string $id)
    {
        return $this->setArchived($request, $id, true);
    }

    public function unarchive(Request $request, string $id)
    {
        return $this->setArchived($request, $id, false);
    }

    private function setArchived(Request $request, string $id, bool $archive)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $user = $request->user();

        if (!TaskAccess::canView($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!$task->is_private || $task->parent_group_id) {
            return response()->json(['message' => 'Only a group can be archived.'], 422);
        }

        if (!$user->isSuperAdmin() && $task->creator_id !== $user->id) {
            return response()->json(['message' => 'Only the group creator can archive it.'], 403);
        }

        $task->update(['archived_at' => $archive ? now() : null]);
        ActivityLog::record($archive ? 'group_archived' : 'group_unarchived', $task);

        return response()->json($task);
    }

    /**
     * POST /tasks/{id}/leave — a member walks out of a group (and its tasks). The creator
     * can't: that would orphan the group, so they archive or delete it instead.
     */
    public function leave(Request $request, string $id)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $user = $request->user();

        $isCreator = $task->creator_id === $user->id;
        if (!$isCreator && !$task->assignees->contains('id', $user->id)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!$task->is_private || $task->parent_group_id) {
            return response()->json(['message' => 'Only a group can be left.'], 422);
        }

        if ($isCreator) {
            return response()->json(['message' => "You created this group, so you can't leave it. Archive or delete it instead."], 422);
        }

        if (TaskAccess::isLocked($task)) {
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        DB::transaction(function () use ($task, $user) {
            $taskIds = Task::where('parent_group_id', $task->id)->pluck('id')->push($task->id);

            DB::table('task_assignees')->whereIn('task_id', $taskIds)->where('user_id', $user->id)->delete();
            TaskRead::whereIn('task_id', $taskIds)->where('user_id', $user->id)->delete();
        });

        TaskNotification::create([
            'user_id' => $task->creator_id,
            'type'    => 'group_member_left',
            'data'    => ['task_id' => $task->id, 'task_title' => $task->title, 'user_name' => $user->name],
        ]);
        ActivityLog::record('group_member_left', $task, ['user_id' => $user->id], []);

        return response()->json(['message' => 'You left the group.']);
    }

    private function canManageAssignee($user, Task $task, User $target): bool
    {
        if ($user->isAdminOrAbove()) {
            return true;
        }

        if (!$user->isManager() || !$user->department_id) {
            return false;
        }

        $ownDeptTask = $task->department_id === $user->department_id;
        $mentioned   = $task->mentions->contains('id', $user->id);
        $ownDeptUser = $target->department_id === $user->department_id;

        return ($ownDeptTask || $mentioned) && $ownDeptUser;
    }

    public function destroy(string $id)
    {
        $task = Task::findOrFail($id);
        $user = auth()->user();

        $canDelete = $task->is_private
            ? (
                $user->isSuperAdmin()
                || $task->creator_id === $user->id
                || ($task->parent_group_id && $task->parentGroup->creator_id === $user->id)
              )
            : ($task->creator_id === $user->id || $user->isAdminOrAbove());

        if (!$canDelete) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        ActivityLog::record('task_deleted', $task, $task->toArray());
        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }
}
