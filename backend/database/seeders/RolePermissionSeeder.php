<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            // Users
            ['name' => 'users.view', 'display_name' => 'View Users', 'group' => 'Users'],
            ['name' => 'users.create', 'display_name' => 'Create Users', 'group' => 'Users'],
            ['name' => 'users.edit', 'display_name' => 'Edit Users', 'group' => 'Users'],
            ['name' => 'users.delete', 'display_name' => 'Delete Users', 'group' => 'Users'],
            // Tasks
            ['name' => 'tasks.view', 'display_name' => 'View Tasks', 'group' => 'Tasks'],
            ['name' => 'tasks.create', 'display_name' => 'Create Tasks', 'group' => 'Tasks'],
            ['name' => 'tasks.edit', 'display_name' => 'Edit Tasks', 'group' => 'Tasks'],
            ['name' => 'tasks.delete', 'display_name' => 'Delete Tasks', 'group' => 'Tasks'],
            ['name' => 'tasks.assign', 'display_name' => 'Assign Tasks', 'group' => 'Tasks'],
            // Departments
            ['name' => 'departments.view', 'display_name' => 'View Departments', 'group' => 'Departments'],
            ['name' => 'departments.create', 'display_name' => 'Create Departments', 'group' => 'Departments'],
            ['name' => 'departments.edit', 'display_name' => 'Edit Departments', 'group' => 'Departments'],
            ['name' => 'departments.delete', 'display_name' => 'Delete Departments', 'group' => 'Departments'],
            // Roles
            ['name' => 'roles.view', 'display_name' => 'View Roles', 'group' => 'Roles'],
            ['name' => 'roles.create', 'display_name' => 'Create Roles', 'group' => 'Roles'],
            ['name' => 'roles.edit', 'display_name' => 'Edit Roles', 'group' => 'Roles'],
            ['name' => 'roles.delete', 'display_name' => 'Delete Roles', 'group' => 'Roles'],
            // Reports
            ['name' => 'reports.view', 'display_name' => 'View Reports', 'group' => 'Reports'],
            ['name' => 'activity.view', 'display_name' => 'View Activity Logs', 'group' => 'Reports'],
            ['name' => 'files.manage', 'display_name' => 'Manage Files', 'group' => 'Files'],
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm['name']], $perm);
        }

        $allPermissions = Permission::pluck('id')->toArray();

        $managerPermissions = Permission::whereIn('name', [
            'tasks.view', 'tasks.create', 'tasks.edit', 'tasks.delete', 'tasks.assign',
            'departments.view', 'users.view', 'reports.view', 'files.manage',
        ])->pluck('id')->toArray();

        $employeePermissions = Permission::whereIn('name', [
            'tasks.view', 'departments.view', 'users.view',
        ])->pluck('id')->toArray();

        $adminRole = Role::firstOrCreate(
            ['name' => 'admin'],
            ['display_name' => 'Administrator', 'description' => 'Full access to all features']
        );
        $adminRole->permissions()->sync($allPermissions);

        $managerRole = Role::firstOrCreate(
            ['name' => 'manager'],
            ['display_name' => 'Manager', 'description' => 'Manage tasks and department']
        );
        $managerRole->permissions()->sync($managerPermissions);

        $employeeRole = Role::firstOrCreate(
            ['name' => 'employee'],
            ['display_name' => 'Employee', 'description' => 'View and update assigned tasks']
        );
        $employeeRole->permissions()->sync($employeePermissions);
    }
}
