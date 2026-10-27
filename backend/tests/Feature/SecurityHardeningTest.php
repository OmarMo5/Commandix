<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Task;
use Illuminate\Support\Facades\Hash;

class SecurityHardeningTest extends ApiTestCase
{
    // ── Passwords & accounts ────────────────────────────────────────────────

    public function test_an_admin_cannot_reset_the_super_admins_password_but_a_super_admin_can(): void
    {
        $admin = $this->makeUser('admin');
        $super = $this->makeUser('super_admin');
        $other = $this->makeUser('employee');

        $payload = ['password' => 'new-password-1', 'password_confirmation' => 'new-password-1'];

        $this->actAs($admin)->putJson("/api/v1/users/{$super->id}/password", $payload)->assertForbidden();
        $this->actAs($admin)->putJson("/api/v1/users/{$other->id}/password", $payload)->assertOk();
        $this->actAs($super)->putJson("/api/v1/users/{$admin->id}/password", $payload)->assertOk();

        $this->assertFalse(Hash::check('new-password-1', $super->fresh()->password));
    }

    public function test_every_role_can_edit_their_own_profile_but_not_their_role(): void
    {
        $dept = $this->department();
        $employee = $this->makeUser('employee', $dept);
        $adminRoleId = Role::where('name', 'admin')->value('id');

        $this->actAs($employee)->putJson('/api/v1/auth/profile', [
            'name' => 'New Name', 'email' => 'new@example.com', 'role_id' => $adminRoleId,
        ])->assertOk()->assertJsonPath('name', 'New Name');

        $employee->refresh();
        $this->assertSame('New Name', $employee->name);
        $this->assertNotEquals($adminRoleId, $employee->role_id, 'self-service must never allow promoting yourself');
    }

    public function test_changing_your_own_password_needs_the_current_one(): void
    {
        $employee = $this->makeUser('employee');

        $this->actAs($employee)->putJson('/api/v1/auth/password', [
            'current_password' => 'wrong', 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass',
        ])->assertStatus(422);

        $employee->createToken('other-device');

        $this->actAs($employee)->putJson('/api/v1/auth/password', [
            'current_password' => 'password', 'password' => 'brand-new-pass', 'password_confirmation' => 'brand-new-pass',
        ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-pass', $employee->fresh()->password));
        $this->assertSame(0, $employee->tokens()->count(), 'other devices are signed out');
    }

    public function test_deactivating_a_user_revokes_their_tokens_and_you_cannot_deactivate_yourself(): void
    {
        $admin = $this->makeUser('admin');
        $employee = $this->makeUser('employee');
        $employee->createToken('device');

        $this->actAs($admin)->putJson("/api/v1/users/{$employee->id}", ['is_active' => false])->assertOk();
        $this->assertSame(0, $employee->tokens()->count());

        // A Super Admin can't lock themselves out; an Admin can't edit an Admin record at all.
        $super = $this->makeUser('super_admin');
        $this->actAs($super)->putJson("/api/v1/users/{$super->id}", ['is_active' => false])->assertStatus(422);
        $this->actAs($admin)->putJson("/api/v1/users/{$admin->id}", ['is_active' => false])->assertForbidden();
    }

    // ── Data exposure ───────────────────────────────────────────────────────

    public function test_employees_only_see_their_own_department_in_user_and_department_endpoints(): void
    {
        $dev = $this->department('Dev');
        $mkt = $this->department('Marketing');
        $me = $this->makeUser('employee', $dev);
        $teammate = $this->makeUser('employee', $dev);
        $stranger = $this->makeUser('employee', $mkt);

        $ids = collect($this->actAs($me)->getJson('/api/v1/users?per_page=100')->assertOk()->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($teammate->id));
        $this->assertFalse($ids->contains($stranger->id));

        $this->actAs($me)->getJson("/api/v1/users/{$stranger->id}")->assertForbidden();
        $this->actAs($me)->getJson("/api/v1/users/{$teammate->id}")->assertOk();

        $this->actAs($me)->getJson("/api/v1/departments/{$mkt->id}")->assertForbidden();
        $this->actAs($me)->getJson("/api/v1/departments/{$dev->id}")->assertOk();
    }

    public function test_a_users_profile_never_lists_their_private_groups(): void
    {
        $dev = $this->department('Dev');
        $creator = $this->makeUser('employee', $dev);
        $colleague = $this->makeUser('employee', $dev);
        $this->makeGroup($creator, [$colleague], 'Hidden Group Title');

        $this->actAs($colleague)->getJson("/api/v1/users/{$creator->id}")
            ->assertOk()->assertJsonMissing(['title' => 'Hidden Group Title']);
    }

    // ── Workflow authorization ──────────────────────────────────────────────

    public function test_only_someone_who_can_edit_a_task_can_define_its_workflow(): void
    {
        $dept = $this->department();
        $manager = $this->makeUser('manager', $dept);
        $employee = $this->makeUser('employee', $dept);
        $other = $this->makeUser('employee', $dept);
        $task = Task::create(['title' => 'Pipeline', 'creator_id' => $manager->id, 'department_id' => $dept->id]);

        $steps = ['steps' => [['user_id' => $employee->id], ['user_id' => $other->id]]];

        $this->actAs($employee)->postJson("/api/v1/tasks/{$task->id}/workflow", $steps)->assertForbidden();
        $this->actAs($manager)->postJson("/api/v1/tasks/{$task->id}/workflow", $steps)->assertOk();

        // A workflow participant who is neither assignee nor creator can still open the task.
        $this->actAs($employee)->getJson("/api/v1/tasks/{$task->id}")->assertOk();
        $this->actAs($employee)->deleteJson("/api/v1/tasks/{$task->id}/workflow")->assertForbidden();
    }

    public function test_workflows_are_refused_inside_private_groups(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member]);

        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/workflow", [
            'steps' => [['user_id' => $creator->id], ['user_id' => $member->id]],
        ])->assertStatus(422);
    }

    // ── Roles ───────────────────────────────────────────────────────────────

    public function test_built_in_roles_and_roles_with_users_cannot_be_deleted(): void
    {
        $super = $this->makeUser('super_admin');
        $employeeRole = Role::where('name', 'employee')->first();

        $this->actAs($super)->deleteJson("/api/v1/roles/{$employeeRole->id}")->assertStatus(422);

        $custom = Role::create(['name' => 'auditor', 'display_name' => 'Auditor']);
        $this->makeUser('auditor');
        $this->actAs($super)->deleteJson("/api/v1/roles/{$custom->id}")->assertStatus(422);

        $custom->users()->delete();
        $this->actAs($super)->deleteJson("/api/v1/roles/{$custom->id}")->assertOk();
    }

    public function test_renaming_a_built_in_role_is_ignored(): void
    {
        $super = $this->makeUser('super_admin');
        $managerRole = Role::where('name', 'manager')->first();

        $this->actAs($super)->putJson("/api/v1/roles/{$managerRole->id}", [
            'name' => 'renamed', 'display_name' => 'Team Lead',
        ])->assertOk();

        $managerRole->refresh();
        $this->assertSame('manager', $managerRole->name);
        $this->assertSame('Team Lead', $managerRole->display_name);
    }

    // ── Pagination ──────────────────────────────────────────────────────────

    public function test_per_page_is_honoured_and_capped(): void
    {
        $admin = $this->makeUser('admin');
        foreach (range(1, 25) as $i) {
            Task::create(['title' => "Task $i", 'creator_id' => $admin->id]);
        }

        $this->assertCount(20, $this->actAs($admin)->getJson('/api/v1/tasks')->json('data'));
        $this->assertCount(25, $this->actAs($admin)->getJson('/api/v1/tasks?per_page=100')->json('data'));
        $this->assertCount(5, $this->actAs($admin)->getJson('/api/v1/tasks?per_page=5')->json('data'));
    }
}
