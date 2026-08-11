<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskNotification;
use App\Support\TaskAccess;
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

        if (!TaskAccess::canView(auth()->user(), $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $comments = TaskComment::with(['user:id,name,avatar', 'mentionedUser:id,name', 'replies.user:id,name,avatar'])
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
            return response()->json(['message' => 'This group is closed.'], 423);
        }

        $request->validate([
            'content'            => 'required|string|max:2000',
            'is_question'        => 'sometimes|boolean',
            'parent_id'          => 'nullable|exists:task_comments,id',
            'mentioned_user_id'  => 'nullable|exists:users,id',
        ]);

        // A tag can only reach someone already on the task — its own creator or
        // one of its assignees. This mirrors TaskAccess membership so a mention
        // can never be used to notify (or reveal a private task to) an outsider.
        // Inside a group's sub-task, the taggable pool widens to the *whole*
        // group's membership, not just this sub-task's own (narrower) assignees
        // — you can tag anyone in the group from any task inside it.
        if ($request->mentioned_user_id) {
            $taggable = $task->creator_id === (int) $request->mentioned_user_id
                || $task->assignees->contains('id', $request->mentioned_user_id);

            if (!$taggable && $task->parent_group_id && $task->parentGroup) {
                $taggable = $task->parentGroup->creator_id === (int) $request->mentioned_user_id
                    || $task->parentGroup->assignees->contains('id', $request->mentioned_user_id);
            }

            if (!$taggable) {
                return response()->json(['message' => 'You can only tag someone on this task.'], 422);
            }
        }

        $comment = TaskComment::create([
            'task_id'            => $taskId,
            'user_id'            => auth()->id(),
            'parent_id'          => $request->parent_id,
            'content'            => $request->content,
            'is_question'        => $request->is_question ?? false,
            'is_answered'        => false,
            'mentioned_user_id'  => $request->mentioned_user_id,
        ]);

        $comment->load('user:id,name,avatar', 'mentionedUser:id,name', 'replies.user:id,name,avatar');

        if ($request->mentioned_user_id && (int) $request->mentioned_user_id !== auth()->id()) {
            TaskNotification::create([
                'user_id' => $request->mentioned_user_id,
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
