<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskRead;
use App\Support\TaskAccess;
use Illuminate\Http\Request;

/**
 * Read pointers for private-group chats: "I've read up to comment N".
 * Feeds the unread badges (and the "seen by" markers on messages).
 */
class TaskReadController extends Controller
{
    /** POST /tasks/{id}/read — advance my pointer to the newest comment (never backwards). */
    public function markRead(Request $request, string $id)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($id);
        $user = $request->user();

        if (!TaskAccess::canView($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Only private chats keep read state; for normal tasks this is a harmless no-op.
        if (!$task->is_private) {
            return response()->json(['last_read_comment_id' => 0]);
        }

        $latest = (int) TaskComment::where('task_id', $task->id)->max('id');
        $read = TaskRead::firstOrCreate(['user_id' => $user->id, 'task_id' => $task->id], ['last_read_comment_id' => 0]);

        if ($latest > $read->last_read_comment_id) {
            $read->update(['last_read_comment_id' => $latest]);
        }

        return response()->json(['last_read_comment_id' => $read->last_read_comment_id]);
    }

    /**
     * GET /tasks/{id}/readers — every member of the chat with how far they've read, so the
     * UI can show "seen by" under messages. Private chats only (normal tasks get an empty list).
     */
    public function readers(Request $request, string $id)
    {
        $task = Task::with(['assignees', 'mentions', 'parentGroup'])->findOrFail($id);

        if (!TaskAccess::canView($request->user(), $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (!$task->is_private) {
            return response()->json([]);
        }

        // A task inside a group is visible to the whole group, so its audience is the group's members.
        $group = $task->parent_group_id ? $task->parentGroup : $task;
        $group->loadMissing(['creator:id,name,avatar', 'assignees:id,name,avatar']);

        $members = $group->assignees->prepend($group->creator)->unique('id')->values();
        $pointers = TaskRead::where('task_id', $task->id)->pluck('last_read_comment_id', 'user_id');

        return response()->json($members->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'avatar' => $u->avatar,
            'last_read_comment_id' => (int) ($pointers[$u->id] ?? 0),
        ]));
    }
}
