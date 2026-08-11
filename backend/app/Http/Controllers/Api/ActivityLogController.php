<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Task;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $query = ActivityLog::with('user:id,name,avatar')->latest();

        // Even an Admin (not just Super Admin) doesn't get to see private-group
        // activity they're not part of — this audit page would otherwise leak
        // group titles/content straight through the old/new value snapshots.
        if (!$request->user()->isSuperAdmin()) {
            $privateTaskIds = Task::where('is_private', true)->pluck('id');
            if ($privateTaskIds->isNotEmpty()) {
                $query->where(function ($q) use ($privateTaskIds) {
                    $q->where('model_type', '!=', 'Task')
                      ->orWhereNotIn('model_id', $privateTaskIds);
                });
            }
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->action) {
            $query->where('action', 'like', "%{$request->action}%");
        }

        if ($request->model_type) {
            $query->where('model_type', $request->model_type);
        }

        return response()->json($query->paginate(25));
    }
}
