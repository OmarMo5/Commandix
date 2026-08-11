<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use App\Models\Task;
use App\Support\TaskAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AttachmentController extends Controller
{
    public function store(Request $request, string $taskId)
    {
        $request->validate([
            'file' => 'required|file|max:10240|mimes:jpg,jpeg,png,gif,pdf,doc,docx,xls,xlsx,txt,zip',
        ]);

        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);
        $user = $request->user();

        if (!TaskAccess::canView($user, $task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if (TaskAccess::isLocked($task) && !$user->isSuperAdmin()) {
            return response()->json(['message' => 'This group is closed.'], 423);
        }

        $file = $request->file('file');
        $path = $file->store('attachments/' . $taskId, 'public');

        $attachment = Attachment::create([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
        ]);

        return response()->json($attachment, 201);
    }

    public function destroy(string $id)
    {
        $attachment = Attachment::with('task')->findOrFail($id);
        $user = auth()->user();

        if ($attachment->user_id !== $user->id && !TaskAccess::canEdit($user, $attachment->task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();

        return response()->json(['message' => 'File deleted successfully.']);
    }
}
