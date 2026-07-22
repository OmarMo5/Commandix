<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use App\Models\Department;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(Request $request)
    {
        $user = $request->user();

        $taskQuery = Task::query();

        if ($user->isAdminOrAbove()) {
            // no filter — sees everything
        } elseif ($user->isManager()) {
            // Team stats: scoped to the manager's own department
            if ($user->department_id) {
                $taskQuery->where('department_id', $user->department_id);
            }
        } else {
            $taskQuery->where(function ($q) use ($user) {
                $q->whereHas('assignees', fn($q2) => $q2->where('users.id', $user->id))
                  ->orWhere('creator_id', $user->id);
            });
        }

        $tasksByStatus = (clone $taskQuery)->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status');

        $tasksByPriority = (clone $taskQuery)->select('priority', DB::raw('count(*) as count'))
            ->groupBy('priority')
            ->pluck('count', 'priority');

        $recentTasks = (clone $taskQuery)->with(['creator:id,name', 'assignees:id,name,avatar'])
            ->latest()
            ->limit(5)
            ->get();

        $activityQuery = ActivityLog::with('user:id,name,avatar');

        if (!$user->isAdminOrAbove()) {
            if ($user->isManager() && $user->department_id) {
                $teamUserIds = User::where('department_id', $user->department_id)->pluck('id');
                $teamTaskIds = Task::where('department_id', $user->department_id)->pluck('id');
            } else {
                $teamUserIds = collect([$user->id]);
                $teamTaskIds = (clone $taskQuery)->pluck('id');
            }

            $activityQuery->where(function ($q) use ($teamUserIds, $teamTaskIds) {
                $q->whereIn('user_id', $teamUserIds)
                  ->orWhere(function ($q2) use ($teamTaskIds) {
                      $q2->where('model_type', 'Task')->whereIn('model_id', $teamTaskIds);
                  });
            });
        }

        $recentActivity = $activityQuery->latest()->limit(10)->get();

        $result = [
            'tasks' => [
                'total' => (clone $taskQuery)->count(),
                'pending' => $tasksByStatus['pending'] ?? 0,
                'in_progress' => $tasksByStatus['in_progress'] ?? 0,
                'completed' => $tasksByStatus['completed'] ?? 0,
            ],
            'tasks_by_priority' => [
                'low' => $tasksByPriority['low'] ?? 0,
                'medium' => $tasksByPriority['medium'] ?? 0,
                'high' => $tasksByPriority['high'] ?? 0,
            ],
            'recent_tasks' => $recentTasks,
            'recent_activity' => $recentActivity,
        ];

        if ($user->isAdminOrAbove()) {
            $result['users_count'] = User::count();
            $result['departments_count'] = Department::count();

            $result['tasks_per_department'] = Task::select('department_id', DB::raw('count(*) as count'))
                ->with('department:id,name')
                ->groupBy('department_id')
                ->get()
                ->map(fn($t) => [
                    'department' => $t->department?->name ?? 'Unassigned',
                    'count' => $t->count,
                ]);
        }

        return response()->json($result);
    }
}
