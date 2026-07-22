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
        $user = $request->user();
        $query = Attachment::with(['task:id,title', 'user:id,name']);

        if (!$user->isAdminOrAbove()) {
            $query->where(function ($q) use ($user) {
                // Files the user uploaded themselves
                $q->where('user_id', $user->id);

                if ($user->isManager() && $user->department_id) {
                    // Plus files on any task in their department, or on tasks they've been mentioned on
                    $q->orWhereHas('task', function ($t) use ($user) {
                        $t->where('department_id', $user->department_id)
                          ->orWhereHas('mentions', fn($m) => $m->where('users.id', $user->id));
                    });
                } else {
                    // Employee: plus files on tasks they created or are assigned to
                    $q->orWhereHas('task', function ($t) use ($user) {
                        $t->where('creator_id', $user->id)
                          ->orWhereHas('assignees', fn($a) => $a->where('users.id', $user->id));
                    });
                }
            });
        }

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

        if (!auth()->user()->isAdminOrAbove() && $attachment->user_id !== auth()->id()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Storage::disk('public')->delete($attachment->file_path);
        $attachment->delete();

        return response()->json(['message' => 'File deleted successfully.']);
    }
}
