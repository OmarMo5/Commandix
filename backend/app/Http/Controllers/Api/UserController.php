<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $authUser = $request->user();
        $query    = User::with(['role', 'department']);

        // Manager sees only their department's users
        if ($authUser->isManager() && !$authUser->isAdmin()) {
            $query->where('department_id', $authUser->department_id);
        }

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%");
            });
        }

        if ($request->department_id) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->role_id) {
            $query->where('role_id', $request->role_id);
        }

        return response()->json($query->paginate(15));
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
            'role_id' => 'nullable|exists:roles,id',
            'department_id' => 'nullable|exists:departments,id',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role_id' => $request->role_id,
            'department_id' => $request->department_id,
            'is_active' => true,
        ]);

        ActivityLog::record('user_created', $user, [], $user->toArray());

        return response()->json($user->load(['role', 'department']), 201);
    }

    public function show(string $id)
    {
        $user = User::with(['role.permissions', 'department', 'assignedTasks', 'createdTasks'])->findOrFail($id);
        return response()->json($user);
    }

    public function update(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'role_id' => 'nullable|exists:roles,id',
            'department_id' => 'nullable|exists:departments,id',
            'is_active' => 'sometimes|boolean',
        ]);

        $old = $user->toArray();
        $user->update($request->only(['name', 'email', 'role_id', 'department_id', 'is_active']));
        ActivityLog::record('user_updated', $user, $old, $user->fresh()->toArray());

        return response()->json($user->load(['role', 'department']));
    }

    public function destroy(string $id)
    {
        $user = User::findOrFail($id);

        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Cannot delete yourself.'], 403);
        }

        ActivityLog::record('user_deleted', $user, $user->toArray());
        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    public function updatePassword(Request $request, string $id)
    {
        $request->validate(['password' => 'required|min:8|confirmed']);
        $user = User::findOrFail($id);
        $user->update(['password' => Hash::make($request->password)]);
        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function updateAvatar(Request $request)
    {
        $request->validate(['avatar' => 'required|image|max:2048']);
        $path = $request->file('avatar')->store('avatars', 'public');
        $request->user()->update(['avatar' => $path]);
        return response()->json(['avatar' => asset('storage/' . $path)]);
    }
}
