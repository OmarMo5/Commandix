<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $authUser = $request->user();
        $query    = User::with(['role', 'department']);

        // Anyone below Admin only sees their own department (or just themselves
        // if they have none) — the company-wide picker is /users/directory.
        if (!$authUser->isAdminOrAbove()) {
            $authUser->department_id
                ? $query->where('department_id', $authUser->department_id)
                : $query->where('id', $authUser->id);
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

        // Honour ?per_page= (the pickers ask for 100–200) but cap it, instead of
        // silently truncating every dropdown to the first 15 people.
        $perPage = $request->filled('per_page') ? min(max((int) $request->per_page, 1), 200) : 15;

        return response()->json($query->paginate($perPage));
    }

    /**
     * GET /users/directory — minimal, company-wide, for the private-group
     * member picker. Any authenticated user (name + department only, nothing
     * else) — deliberately not department-scoped like index() above, since a
     * group is meant to be able to cross departments.
     */
    public function directory(Request $request)
    {
        $users = User::where('is_active', true)
            ->where('id', '!=', $request->user()->id)
            ->with('department:id,name')
            ->select('id', 'name', 'avatar', 'department_id')
            ->orderBy('name')
            ->get();

        return response()->json($users);
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

        if ($response = $this->guardElevatedRole($request)) {
            return $response;
        }

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

    public function show(Request $request, string $id)
    {
        $authUser = $request->user();

        $user = User::with([
            'role.permissions',
            'department',
            // Private groups never surface through someone else's profile.
            'assignedTasks' => fn($q) => $q->where('is_private', false),
            'createdTasks'  => fn($q) => $q->where('is_private', false),
        ])->findOrFail($id);

        $sameDepartment = $authUser->department_id && $user->department_id === $authUser->department_id;
        if (!$authUser->isAdminOrAbove() && $user->id !== $authUser->id && !$sameDepartment) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json($user);
    }

    public function update(Request $request, string $id)
    {
        $user = User::with('role')->findOrFail($id);
        $authUser = $request->user();

        if ($user->isAdminOrAbove() && !$authUser->isSuperAdmin()) {
            return response()->json(['message' => 'Only a Super Admin can modify an Admin or Super Admin account.'], 403);
        }

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $id,
            'role_id' => 'nullable|exists:roles,id',
            'department_id' => 'nullable|exists:departments,id',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($response = $this->guardElevatedRole($request)) {
            return $response;
        }

        if ($request->has('is_active') && !$request->boolean('is_active') && $user->id === $authUser->id) {
            return response()->json(['message' => 'You cannot deactivate your own account.'], 422);
        }

        $old = $user->toArray();
        $user->update($request->only(['name', 'email', 'role_id', 'department_id', 'is_active']));

        // A deactivated account must lose access immediately — login already
        // refuses it, but tokens issued earlier would otherwise keep working.
        if ($request->has('is_active') && !$request->boolean('is_active')) {
            $user->tokens()->delete();
        }

        ActivityLog::record('user_updated', $user, $old, $user->fresh()->toArray());

        return response()->json($user->load(['role', 'department']));
    }

    public function destroy(Request $request, string $id)
    {
        $user = User::with('role')->findOrFail($id);

        if ($user->id === auth()->id()) {
            return response()->json(['message' => 'Cannot delete yourself.'], 403);
        }

        if ($user->isAdminOrAbove() && !$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Only a Super Admin can delete an Admin or Super Admin account.'], 403);
        }

        ActivityLog::record('user_deleted', $user, $user->toArray());
        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    /**
     * Only a Super Admin may create/promote a user into the admin or super_admin role.
     */
    private function guardElevatedRole(Request $request)
    {
        if (!$request->filled('role_id')) {
            return null;
        }

        $targetRole = Role::find($request->role_id);

        if ($targetRole && in_array($targetRole->name, ['admin', 'super_admin'], true) && !$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Only a Super Admin can assign the ' . $targetRole->display_name . ' role.'], 403);
        }

        return null;
    }

    /**
     * Admin-initiated password reset. Same rule as update()/destroy(): only a
     * Super Admin may touch an Admin or Super Admin account — otherwise any
     * Admin could reset the Super Admin's password and take the system over.
     * (Changing your *own* password goes through PUT /auth/password instead.)
     */
    public function updatePassword(Request $request, string $id)
    {
        $request->validate(['password' => 'required|min:8|confirmed']);
        $user = User::with('role')->findOrFail($id);

        if ($user->isAdminOrAbove() && !$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Only a Super Admin can reset an Admin or Super Admin password.'], 403);
        }

        $user->update(['password' => Hash::make($request->password)]);
        $user->tokens()->delete();
        ActivityLog::record('password_reset', $user);

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
