<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\TaskNotification;
use App\Models\User;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $query = Task::with(['creator:id,name,avatar', 'assignees:id,name,avatar', 'department:id,name', 'attachments']);

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->department_id) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->search) {
            $query->where('title', 'like', "%{$request->search}%");
        }

        if ($request->priority) {
            $query->where('priority', $request->priority);
        }

        $user = $request->user();

        if ($user->isAdminOrAbove()) {
            // Admin / Super Admin see everything — no filter
        } elseif ($user->isManager()) {
            // Manager sees their department's tasks, tasks they created, and tasks they've been mentioned on
            $query->where(function ($q) use ($user) {
                if ($user->department_id) {
                    $q->where('department_id', $user->department_id);
                }
                $q->orWhere('creator_id', $user->id)
                  ->orWhereHas('mentions', fn($q2) => $q2->where('users.id', $user->id));
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

        return response()->json($query->latest()->paginate(20));
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
        ]);

        $task = Task::create([
            'title'            => $request->title,
            'description'      => $request->description,
            'status'           => $request->status ?? 'pending',
            'priority'         => $request->priority ?? 'medium',
            'creator_id'       => $request->user()->id,
            'department_id'    => $request->department_id,
            'due_date'         => $request->due_date,
            'workflow_enabled' => false,
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

        if ($request->mentions) {
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

    public function show(string $id)
    {
        $task = Task::with([
            'creator:id,name,avatar',
            'assignees:id,name,avatar',
            'mentions:id,name,avatar',
            'department:id,name',
            'attachments.user:id,name',
            'workflowSteps.user:id,name,avatar',
        ])->findOrFail($id);

        $user = auth()->user();

        if (!$user->isAdminOrAbove() && !$user->isManager()) {
            $isAssigned = $task->assignees->contains('id', $user->id);
            $isCreator  = $task->creator_id === $user->id;
            if (!$isAssigned && !$isCreator) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
        } elseif ($user->isManager()) {
            $ownDept   = $user->department_id && $task->department_id === $user->department_id;
            $isCreator = $task->creator_id === $user->id;
            $mentioned = $task->mentions->contains('id', $user->id);
            if (!$ownDept && !$isCreator && !$mentioned) {
                return response()->json(['message' => 'Unauthorized.'], 403);
            }
        }

        return response()->json($task);
    }

    public function update(Request $request, string $id)
    {
        $task = Task::findOrFail($id);
        $user = $request->user();

        if (!$this->canEditTask($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
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
        ]);

        $old = $task->toArray();
        $task->update($request->only(['title', 'description', 'priority', 'department_id', 'due_date']));

        if ($request->has('assignees')) {
            $task->assignees()->sync($request->assignees ?? []);
        }

        if ($request->has('mentions')) {
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

        $canChange = $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || $task->assignees->contains('id', $user->id)
            || ($user->isManager() && (
                ($user->department_id && $task->department_id === $user->department_id)
                || $task->mentions->contains('id', $user->id)
            ));

        if (!$canChange) {
            return response()->json(['message' => 'Unauthorized.'], 403);
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
     * Attach a single assignee. Admin/Super Admin: any user. Manager: only their
     * own department's people, and only on a task in their department or one
     * they've been mentioned on (cross-department collaboration).
     */
    public function addAssignee(Request $request, string $id)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $target = User::findOrFail($request->user_id);
        $user = $request->user();

        if (!$this->canManageAssignee($user, $task, $target)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
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

        if (!$this->canManageAssignee($user, $task, $target)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $task->assignees()->detach($target->id);

        ActivityLog::record('task_assignee_removed', $task, ['assignee_id' => $target->id], []);

        return response()->json($task->load(['assignees:id,name,avatar']));
    }

    /**
     * POST /tasks/{id}/mentions
     * Loop in another department's manager (or an admin) so they can view the
     * task, chat on it, and assign their own team. Only whoever can edit the
     * task (creator, its own department's manager, or admin/super admin) may
     * add a mention — mentioned managers don't get to chain-invite others.
     */
    public function addMention(Request $request, string $id)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $task = Task::findOrFail($id);
        $target = User::with('role')->findOrFail($request->user_id);
        $user = $request->user();

        if (!$this->canEditTask($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!in_array($target->role?->name, ['manager', 'admin', 'super_admin'], true)) {
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

        if (!$this->canEditTask($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $task->mentions()->detach($userId);

        ActivityLog::record('task_mention_removed', $task, ['mentioned_id' => (int) $userId], []);

        return response()->json($task->load(['mentions:id,name,avatar']));
    }

    private function canEditTask($user, Task $task): bool
    {
        return $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || ($user->isManager() && $user->department_id && $task->department_id === $user->department_id);
    }

    private function canManageAssignee($user, Task $task, \App\Models\User $target): bool
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

        if ($task->creator_id !== auth()->id() && !auth()->user()->isAdminOrAbove()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        ActivityLog::record('task_deleted', $task, $task->toArray());
        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }
}
