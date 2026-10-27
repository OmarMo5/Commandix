<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Shared setup for API feature tests: seeded roles/permissions and a tiny
 * helper to mint users in a given role/department and act as them.
 */
abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
    }

    protected function makeUser(string $role, ?Department $department = null, array $attrs = []): User
    {
        return User::factory()->create(array_merge([
            'role_id'       => Role::where('name', $role)->value('id'),
            'department_id' => $department?->id,
            'is_active'     => true,
        ], $attrs));
    }

    protected function actAs(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
    }

    protected function department(string $name = 'Engineering'): Department
    {
        return Department::create(['name' => $name]);
    }

    /** A private group created through the real endpoint, with the given members. */
    protected function makeGroup(User $creator, array $members, string $title = 'Secret Project'): Task
    {
        $response = $this->actAs($creator)->postJson('/api/v1/tasks/groups', [
            'title'     => $title,
            'assignees' => collect($members)->pluck('id')->all(),
        ])->assertCreated();

        return Task::findOrFail($response->json('id'));
    }
}
