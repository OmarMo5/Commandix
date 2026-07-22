<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        // Drop the old placeholder account from earlier seed runs, if present.
        User::where('email', 'admin@portal.com')->delete();

        $superAdminRole = Role::where('name', 'super_admin')->first();
        $adminRole = Role::where('name', 'admin')->first();

        User::updateOrCreate(
            ['email' => 'omarmo5tar12@gmail.com'],
            [
                'name' => 'Omar Mokhtar',
                'password' => Hash::make('12345678'),
                'role_id' => $superAdminRole?->id,
                'is_active' => true,
            ]
        );

        User::updateOrCreate(
            ['email' => 'omar@asc.com.sa'],
            [
                'name' => 'it management',
                'password' => Hash::make('asc12345'),
                'role_id' => $adminRole?->id,
                'is_active' => true,
            ]
        );
    }
}
