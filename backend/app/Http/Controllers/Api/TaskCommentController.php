<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskNotification;
use Illuminate\Http\Request;

class TaskCommentController extends Controller
{
    /**
     * GET /tasks/{taskId}/comments
     * Returns top-level comments (with replies nested).
     */
    public function index(string $taskId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);

        if (!$this->authorizeTaskAccess($task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $comments = TaskComment::with(['user:id,name,avatar', 'replies.user:id,name,avatar'])
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
        $task = Task::with(['creator', 'assignees', 'mentions', 'workflowSteps'])->findOrFail($taskId);

        if (!$this->authorizeTaskAccess($task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'content'     => 'required|string|max:2000',
            'is_question' => 'sometimes|boolean',
            'parent_id'   => 'nullable|exists:task_comments,id',
        ]);

        $comment = TaskComment::create([
            'task_id'     => $taskId,
            'user_id'     => auth()->id(),
            'parent_id'   => $request->parent_id,
            'content'     => $request->content,
            'is_question' => $request->is_question ?? false,
            'is_answered' => false,
        ]);

        $comment->load('user:id,name,avatar', 'replies.user:id,name,avatar');

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
        $notifyIds = $notifyIds->unique()->filter(fn($id) => $id !== auth()->id());

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
     * PUT /tasks/{taskId}/comments/{commentId}/resolve
     * Mark a question as answered (creator/admin/manager only).
     */
    public function resolve(string $taskId, string $commentId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);

        if (!$this->authorizeTaskAccess($task)) {
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
     * Only the author or admin can delete.
     */
    public function destroy(string $taskId, string $commentId)
    {
        $comment = TaskComment::where('task_id', $taskId)->findOrFail($commentId);
        $user    = auth()->user();

        if ($comment->user_id !== $user->id && !$user->isAdminOrAbove()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    /**
     * Only people involved in the task (plus Admin/Super Admin for oversight)
     * can read or post in its chat: creator, assignees, mentioned managers,
     * or the manager of the task's own department.
     */
    private function authorizeTaskAccess(Task $task): bool
    {
        $user = auth()->user();

        return $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || $task->assignees->contains('id', $user->id)
            || $task->mentions->contains('id', $user->id)
            || ($user->isManager() && $user->department_id && $task->department_id === $user->department_id);
    }
}
