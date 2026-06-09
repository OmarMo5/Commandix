<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Department;
use App\Models\TaskNotification;
use App\Models\User;
use Illuminate\Http\Request;

class DepartmentController extends Controller
{
    public function index()
    {
        $user  = auth()->user();

        $query = Department::with([
            'manager:id,name,email,avatar',
            'users' => fn($q) => $q->with('role:id,name,display_name')
                                   ->select('users.id','users.name','users.email','users.avatar','users.role_id','users.department_id','users.is_active'),
        ])->withCount('tasks');

        if ($user->isAdmin()) {
            // Admin sees everything
        } elseif ($user->isManager()) {
            // Manager sees only their own department
            if ($user->department_id) {
                $query->where('id', $user->department_id);
            } else {
                return response()->json([]);
            }
        } else {
            // Employee sees only their department
            if ($user->department_id) {
                $query->where('id', $user->department_id);
            } else {
                return response()->json([]);
            }
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name'       => 'required|string|max:255',
            'description'=> 'nullable|string',
            'manager_id' => 'nullable|exists:users,id',
        ]);

        $department = Department::create($request->only(['name', 'description', 'manager_id']));

        // If a manager is set, update that user's department_id too
        if ($request->manager_id) {
            User::where('id', $request->manager_id)->update(['department_id' => $department->id]);
        }

        ActivityLog::record('department_created', $department, [], $department->toArray());

        return response()->json(
            $department->load(['manager:id,name,email,avatar', 'users.role:id,name,display_name']),
            201
        );
    }

    public function show(string $id)
    {
        $department = Department::with(['manager', 'users.role', 'tasks'])->findOrFail($id);
        return response()->json($department);
    }

    public function update(Request $request, string $id)
    {
        $department = Department::findOrFail($id);

        $request->validate([
            'name'       => 'sometimes|string|max:255',
            'description'=> 'nullable|string',
            'manager_id' => 'nullable|exists:users,id',
        ]);

        $old = $department->toArray();

        // If manager changed, update the new manager's department_id
        if ($request->has('manager_id') && $request->manager_id != $department->manager_id) {
            if ($request->manager_id) {
                User::where('id', $request->manager_id)->update(['department_id' => $department->id]);
            }
        }

        $department->update($request->only(['name', 'description', 'manager_id']));
        ActivityLog::record('department_updated', $department, $old, $department->fresh()->toArray());

        return response()->json(
            $department->load(['manager:id,name,email,avatar', 'users.role:id,name,display_name'])
        );
    }

    public function destroy(string $id)
    {
        $department = Department::findOrFail($id);
        ActivityLog::record('department_deleted', $department, $department->toArray());
        $department->delete();
        return response()->json(['message' => 'Department deleted successfully.']);
    }

    /**
     * GET /departments/managers-list
     * Returns all users with the 'manager' role (for the message selector).
     */
    public function managersList(Request $request)
    {
        $sender = $request->user();

        $managers = User::where('id', '!=', $sender->id)          // exclude self — FIRST
            ->where('is_active', true)
            ->where(function ($q) {                                // group the OR inside
                $q->whereHas('role', fn($r) => $r->where('name', 'manager'))
                  ->orWhereHas('role', fn($r) => $r->where('name', 'admin'));
            })
            ->with('department:id,name')
            ->select('id', 'name', 'email', 'avatar', 'department_id')
            ->orderBy('name')
            ->get();

        return response()->json($managers);
    }

    /**
     * POST /departments/message-manager
     * Send a message notification to a specific manager.
     * Body: { to_manager_id, message }
     */
    public function messageManager(Request $request)
    {
        $request->validate([
            'to_manager_id' => 'required|exists:users,id',
            'message'       => 'required|string|max:1000',
        ]);

        $sender    = $request->user();
        $recipient = User::with('department:id,name')->findOrFail($request->to_manager_id);

        if (!$sender->isAdmin() && !$sender->isManager()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Don't send to yourself
        if ($recipient->id === $sender->id) {
            return response()->json(['message' => 'Cannot send a message to yourself.'], 422);
        }

        $sender->load('department:id,name');

        TaskNotification::create([
            'user_id' => $recipient->id,
            'type'    => 'manager_message',
            'data'    => [
                'from_id'    => $sender->id,
                'from_name'  => $sender->name,
                'from_dept'  => $sender->department?->name ?? '—',
                'to_name'    => $recipient->name,
                'message'    => $request->message,
            ],
        ]);

        ActivityLog::record('manager_message_sent', null, [], [
            'to'   => $recipient->name,
            'from' => $sender->name,
        ]);

        return response()->json(['message' => "Message sent to {$recipient->name} successfully."]);
    }
}
