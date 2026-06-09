<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index()
    {
        return response()->json(Role::with('permissions')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|unique:roles',
            'display_name' => 'required|string',
            'description' => 'nullable|string',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $role = Role::create($request->only(['name', 'display_name', 'description']));

        if ($request->permissions) {
            $role->permissions()->sync($request->permissions);
        }

        ActivityLog::record('role_created', $role, [], $role->toArray());

        return response()->json($role->load('permissions'), 201);
    }

    public function show(string $id)
    {
        return response()->json(Role::with('permissions')->findOrFail($id));
    }

    public function update(Request $request, string $id)
    {
        $role = Role::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|unique:roles,name,' . $id,
            'display_name' => 'sometimes|string',
            'description' => 'nullable|string',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,id',
        ]);

        $old = $role->toArray();
        $role->update($request->only(['name', 'display_name', 'description']));

        if ($request->has('permissions')) {
            $role->permissions()->sync($request->permissions ?? []);
        }

        ActivityLog::record('role_updated', $role, $old, $role->fresh()->toArray());

        return response()->json($role->load('permissions'));
    }

    public function destroy(string $id)
    {
        $role = Role::findOrFail($id);
        ActivityLog::record('role_deleted', $role, $role->toArray());
        $role->delete();
        return response()->json(['message' => 'Role deleted successfully.']);
    }

    public function permissions()
    {
        return response()->json(Permission::orderBy('group')->orderBy('display_name')->get());
    }
}
