<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Task;
use App\Models\User;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * GET /reports/performance — completion-rate breakdown per department & employee.
     */
    public function performance(Request $request)
    {
        if (!$request->user()->isAdminOrAbove()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json([
            'departments' => $this->departmentStats($request),
            'employees'   => $this->employeeStats($request),
        ]);
    }

    /**
     * GET /reports/export — same data as a downloadable CSV (opens directly in Excel/Sheets).
     */
    public function export(Request $request)
    {
        if (!$request->user()->isAdminOrAbove()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $departments = $this->departmentStats($request);
        $employees = $this->employeeStats($request);
        $filename = 'task-performance-report-' . now()->format('Y-m-d') . '.csv';

        return new StreamedResponse(function () use ($departments, $employees) {
            $handle = fopen('php://output', 'w');
            // Byte-order mark so Excel opens the UTF-8 file with correct encoding.
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, ['Department Performance']);
            fputcsv($handle, ['Department', 'Total Tasks', 'Pending', 'In Progress', 'Completed', 'Completion Rate']);
            foreach ($departments as $d) {
                fputcsv($handle, [$d['name'], $d['total'], $d['pending'], $d['in_progress'], $d['completed'], $d['completion_rate'] . '%']);
            }

            fputcsv($handle, []);
            fputcsv($handle, ['Employee Performance']);
            fputcsv($handle, ['Employee', 'Department', 'Assigned Tasks', 'Completed', 'Completion Rate']);
            foreach ($employees as $e) {
                fputcsv($handle, [$e['name'], $e['department'], $e['assigned'], $e['completed'], $e['completion_rate'] . '%']);
            }

            fclose($handle);
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    private function baseTaskQuery(Request $request)
    {
        $query = Task::query();

        if ($request->from) {
            $query->whereDate('created_at', '>=', $request->from);
        }
        if ($request->to) {
            $query->whereDate('created_at', '<=', $request->to);
        }

        return $query;
    }

    private function departmentStats(Request $request): array
    {
        $departments = Department::query()
            ->when($request->department_id, fn($q) => $q->where('id', $request->department_id))
            ->get(['id', 'name']);

        return $departments->map(function ($dept) use ($request) {
            $deptTasks = $this->baseTaskQuery($request)->where('department_id', $dept->id);
            $total      = (clone $deptTasks)->count();
            $pending    = (clone $deptTasks)->where('status', 'pending')->count();
            $inProgress = (clone $deptTasks)->where('status', 'in_progress')->count();
            $completed  = (clone $deptTasks)->where('status', 'completed')->count();

            return [
                'id'              => $dept->id,
                'name'            => $dept->name,
                'total'           => $total,
                'pending'         => $pending,
                'in_progress'     => $inProgress,
                'completed'       => $completed,
                'completion_rate' => $total > 0 ? round($completed / $total * 100, 1) : 0,
            ];
        })->values()->all();
    }

    private function employeeStats(Request $request): array
    {
        $users = User::query()
            ->with('department:id,name')
            ->whereHas('role', fn($r) => $r->whereIn('name', ['employee', 'manager']))
            ->when($request->department_id, fn($q) => $q->where('department_id', $request->department_id))
            ->get();

        $result = [];

        foreach ($users as $u) {
            $assignedIds = $this->baseTaskQuery($request)
                ->whereHas('assignees', fn($q) => $q->where('users.id', $u->id))
                ->pluck('id');

            $assigned = $assignedIds->count();
            if ($assigned === 0) {
                continue;
            }

            $completed = Task::whereIn('id', $assignedIds)->where('status', 'completed')->count();

            $result[] = [
                'id'              => $u->id,
                'name'            => $u->name,
                'department'      => $u->department?->name ?? '—',
                'assigned'        => $assigned,
                'completed'       => $completed,
                'completion_rate' => round($completed / $assigned * 100, 1),
            ];
        }

        return $result;
    }
}
