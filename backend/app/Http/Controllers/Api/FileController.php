<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Attachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FileController extends Controller
{
    public function index(Request $request)
    {
        $query = Attachment::with(['task:id,title', 'user:id,name']);

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->task_id) {
            $query->where('task_id', $request->task_id);
        }

        if ($request->search) {
            $query->where('file_name', 'like', "%{$request->search}%");
        }

        if ($request->type) {
            $query->where('file_type', 'like', "%{$request->type}%");
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function destroy(string $id)
    {
        $attachment = Attachment::findOrFail($id);

        if (!auth()->user()->isAdmin() && $attachment->user_id !== auth()->id()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();

        return response()->json(['message' => 'File deleted successfully.']);
    }
}
