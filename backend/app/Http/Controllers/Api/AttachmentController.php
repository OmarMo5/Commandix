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
    /** Disk for new uploads: private (storage/app/private), never exposed under /storage. */
    public const DISK = 'local';

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
            return response()->json(['message' => TaskAccess::lockedMessage($task)], 423);
        }

        $file = $request->file('file');
        $path = $file->store('attachments/' . $taskId, self::DISK);

        $attachment = Attachment::create([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'disk' => self::DISK,
            'file_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
        ]);

        return response()->json($attachment, 201);
    }

    /**
     * GET /attachments/{id}/download — the only way to read a file. Access follows
     * the task: private-group files are members-only (Admins included), and a
     * normal task's file is visible to whoever can view the task, plus its uploader.
     */
    public function download(string $id)
    {
        $attachment = Attachment::with('task')->findOrFail($id);
        $user = auth()->user();
        $task = $attachment->task;

        $allowed = $task && (
            TaskAccess::canView($user, $task)
            || (!$task->is_private && $attachment->user_id === $user->id)
        );

        if (!$allowed) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $disk = Storage::disk($attachment->disk);
        if (!$disk->exists($attachment->file_path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        // Images and PDFs open in the browser; everything else downloads.
        $inline = str_starts_with((string) $attachment->file_type, 'image/') || $attachment->file_type === 'application/pdf';

        return $disk->response($attachment->file_path, $attachment->file_name, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ], $inline ? 'inline' : 'attachment');
    }

    public function destroy(string $id)
    {
        $attachment = Attachment::with('task')->findOrFail($id);
        $user = auth()->user();

        if ($attachment->user_id !== $user->id && !TaskAccess::canEdit($user, $attachment->task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Storage::disk($attachment->disk)->delete($attachment->file_path);
        $attachment->delete();

        return response()->json(['message' => 'File deleted successfully.']);
    }
}
