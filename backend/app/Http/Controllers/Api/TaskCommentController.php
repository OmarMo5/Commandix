<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskNotification;
use App\Support\TaskAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TaskCommentController extends Controller
{
    /**
     * GET /tasks/{taskId}/comments
     * Returns top-level comments (with replies nested).
     */
    public function index(string $taskId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);

        if (!TaskAccess::canView(auth()->user(), $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $comments = TaskComment::with(['user:id,name,avatar', 'mentionedUsers:id,name', 'replies.user:id,name,avatar'])
            ->where('task_id', $taskId)
            ->whereNull('parent_id')   // top-level only
            ->latest()
            ->get();

        return response()->json($comments);
    }

    /**
     * POST /tasks/{taskId}/comments
     * Body: { content, is_question, parent_id? }
     */
    public function store(Request $request, string $taskId)
    {
        $task = Task::with(['creator', 'assignees', 'mentions', 'workflowSteps', 'parentGroup', 'parentGroup.assignees'])->findOrFail($taskId);
        $user = auth()->user();

        if (!TaskAccess::canView($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($task) && !$user->isSuperAdmin()) {
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        $request->validate([
            'content'              => 'required|string|max:2000',
            'is_question'          => 'sometimes|boolean',
            // A reply must hang off a comment of *this* task, never one from somewhere else.
            'parent_id'            => ['nullable', Rule::exists('task_comments', 'id')->where('task_id', $taskId)],
            'mentioned_user_ids'   => 'nullable|array|max:20',
            'mentioned_user_ids.*' => 'integer|exists:users,id',
            'mentioned_user_id'    => 'nullable|integer|exists:users,id',   // older single-tag form
        ]);

        // @-tags can only reach someone already inside the task — never an outsider.
        $mentionedIds = collect($request->mentioned_user_ids ?? [])
            ->push($request->mentioned_user_id)
            ->filter()->map(fn($id) => (int) $id)->unique()->values();

        if ($mentionedIds->diff($this->taggableIds($task))->isNotEmpty()) {
            return response()->json(['message' => 'You can only tag someone on this task.'], 422);
        }

        $comment = TaskComment::create([
            'task_id'     => $taskId,
            'user_id'     => auth()->id(),
            'parent_id'   => $request->parent_id,
            'content'     => $request->content,
            'is_question' => $request->is_question ?? false,
            'is_answered' => false,
        ]);

        $comment->mentionedUsers()->sync($mentionedIds);
        $comment->load('user:id,name,avatar', 'mentionedUsers:id,name', 'replies.user:id,name,avatar');

        foreach ($mentionedIds->reject(fn($id) => $id === auth()->id()) as $userId) {
            TaskNotification::create([
                'user_id' => $userId,
                'type'    => 'comment_mention',
                'data'    => [
                    'task_id'    => $task->id,
                    'task_title' => $task->title,
                    'from'       => $user->name,
                    'preview'    => mb_substr($request->content, 0, 80),
                ],
            ]);
        }

        // Collect people to notify (everyone on the task except the commenter)
        $notifyIds = collect();

        // Task creator
        $notifyIds->push($task->creator_id);

        // Assignees
        $notifyIds = $notifyIds->merge($task->assignees->pluck('id'));

        // Mentioned users (e.g. another department's manager looped in)
        $notifyIds = $notifyIds->merge($task->mentions->pluck('id'));

        // Workflow step users
        $notifyIds = $notifyIds->merge($task->workflowSteps->pluck('user_id'));

        // If it's a reply, notify the parent comment author too
        if ($request->parent_id) {
            $parent = TaskComment::find($request->parent_id);
            if ($parent) $notifyIds->push($parent->user_id);
        }

        // Remove duplicates and the commenter themselves
        $notifyIds = $notifyIds->unique()->filter(fn($id) => $id !== auth()->id() && !$mentionedIds->contains($id));

        $type = $request->is_question ? 'task_question' : 'task_comment';

        foreach ($notifyIds as $userId) {
            TaskNotification::create([
                'user_id' => $userId,
                'type'    => $type,
                'data'    => [
                    'task_id'    => $task->id,
                    'task_title' => $task->title,
                    'from'       => auth()->user()->name,
                    'preview'    => mb_substr($request->content, 0, 80),
                    'is_reply'   => (bool) $request->parent_id,
                ],
            ]);
        }

        return response()->json($comment, 201);
    }

    /**
     * Who may be @-tagged on this task: its creator and assignees — and, inside a
     * group's task, anyone in the whole group (not only that task's own assignees).
     */
    private function taggableIds(Task $task)
    {
        $ids = $task->assignees->pluck('id')->push($task->creator_id);

        if ($task->parent_group_id && $task->parentGroup) {
            $ids = $ids->merge($task->parentGroup->assignees->pluck('id'))->push($task->parentGroup->creator_id);
        }

        return $ids->map(fn($id) => (int) $id)->unique()->values();
    }

    /**
     * PUT /tasks/{taskId}/comments/{commentId}/resolve
     * Mark a question as answered (creator/admin/manager only).
     */
    public function resolve(string $taskId, string $commentId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);

        if (!TaskAccess::canView(auth()->user(), $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $comment = TaskComment::where('task_id', $taskId)->findOrFail($commentId);

        if (!$comment->is_question) {
            return response()->json(['message' => 'This is not a question.'], 422);
        }

        $comment->update(['is_answered' => true]);

        return response()->json($comment->load('user:id,name,avatar'));
    }

    /**
     * DELETE /tasks/{taskId}/comments/{commentId}
     * Only the author, or someone with edit rights on the task, can delete.
     */
    public function destroy(string $taskId, string $commentId)
    {
        $task    = Task::findOrFail($taskId);
        $comment = TaskComment::where('task_id', $taskId)->findOrFail($commentId);
        $user    = auth()->user();

        if ($comment->user_id !== $user->id && !TaskAccess::canEdit($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Deleted.']);
    }
}
