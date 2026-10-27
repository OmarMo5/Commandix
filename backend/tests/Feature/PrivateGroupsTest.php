<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Attachment;
use App\Models\Task;

class PrivateGroupsTest extends ApiTestCase
{
    private function fixture(): array
    {
        $dev = $this->department('Dev');
        $mkt = $this->department('Marketing');

        return [
            'creator'  => $this->makeUser('employee', $dev),
            'member'   => $this->makeUser('employee', $mkt),
            'outsider' => $this->makeUser('employee', $dev),
            'manager'  => $this->makeUser('manager', $dev),
            'admin'    => $this->makeUser('admin'),
            'super'    => $this->makeUser('super_admin'),
        ];
    }

    public function test_any_employee_can_create_a_group_and_members_can_cross_departments(): void
    {
        $u = $this->fixture();

        $group = $this->makeGroup($u['creator'], [$u['member']]);

        $this->assertTrue($group->is_private);
        $this->actAs($u['member'])->getJson("/api/v1/tasks/{$group->id}")->assertOk();
    }

    public function test_outsiders_managers_and_admins_cannot_see_a_group_but_super_admin_can(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);

        foreach (['outsider', 'manager', 'admin'] as $who) {
            $this->actAs($u[$who])->getJson("/api/v1/tasks/{$group->id}")->assertForbidden();
            $this->actAs($u[$who])->getJson('/api/v1/tasks?scope=groups&per_page=100')
                ->assertOk()->assertJsonMissing(['id' => $group->id]);
            $this->actAs($u[$who])->getJson('/api/v1/tasks?per_page=100')
                ->assertOk()->assertJsonMissing(['id' => $group->id]);
        }

        $this->actAs($u['super'])->getJson("/api/v1/tasks/{$group->id}")->assertOk();
        $this->actAs($u['super'])->getJson('/api/v1/tasks?scope=groups')->assertJsonFragment(['id' => $group->id]);
    }

    public function test_groups_never_reach_the_dashboard_or_a_non_super_admins_activity_log(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']], 'Top Secret Budget');

        $this->actAs($u['admin'])->getJson('/api/v1/dashboard/stats')
            ->assertOk()->assertJsonPath('tasks.total', 0);

        $this->actAs($u['admin'])->getJson('/api/v1/activity-logs')
            ->assertOk()->assertJsonMissing(['title' => 'Top Secret Budget']);

        $this->actAs($u['super'])->getJson('/api/v1/activity-logs')
            ->assertOk()->assertJsonFragment(['model_id' => $group->id]);
    }

    public function test_group_files_are_visible_to_members_only_even_for_admins(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);

        Attachment::create([
            'task_id' => $group->id, 'user_id' => $u['creator']->id,
            'file_name' => 'budget.pdf', 'file_path' => 'attachments/x/budget.pdf',
            'file_type' => 'application/pdf', 'file_size' => 10,
        ]);

        $this->actAs($u['admin'])->getJson('/api/v1/files')->assertOk()->assertJsonMissing(['file_name' => 'budget.pdf']);
        $this->actAs($u['outsider'])->getJson('/api/v1/files')->assertJsonMissing(['file_name' => 'budget.pdf']);
        $this->actAs($u['member'])->getJson('/api/v1/files')->assertJsonFragment(['file_name' => 'budget.pdf']);
        $this->actAs($u['super'])->getJson('/api/v1/files')->assertJsonFragment(['file_name' => 'budget.pdf']);

        $attachment = Attachment::first();
        $this->actAs($u['admin'])->deleteJson("/api/v1/files/{$attachment->id}")->assertForbidden();
    }

    public function test_only_the_creator_manages_membership_and_nobody_can_mention_on_the_group_itself(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);

        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/assignees", ['user_id' => $u['outsider']->id])
            ->assertForbidden();
        $this->actAs($u['creator'])->postJson("/api/v1/tasks/{$group->id}/assignees", ['user_id' => $u['outsider']->id])
            ->assertOk();

        $this->actAs($u['creator'])->postJson("/api/v1/tasks/{$group->id}/mentions", ['user_id' => $u['manager']->id])
            ->assertStatus(422);
        // An outsider probing the endpoint learns nothing — same 403 as everywhere else.
        $this->actAs($u['manager'])->postJson("/api/v1/tasks/{$group->id}/mentions", ['user_id' => $u['creator']->id])
            ->assertForbidden();
    }

    public function test_any_member_can_create_a_task_inside_the_group_for_other_members_only(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);

        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Draft the deck', 'assignees' => [$u['outsider']->id],
        ])->assertStatus(422);

        $this->actAs($u['outsider'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Sneaky', 'assignees' => [$u['member']->id],
        ])->assertForbidden();

        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Draft the deck', 'assignees' => [$u['member']->id], 'mentions' => [$u['creator']->id],
        ])->assertCreated()->assertJsonPath('mentions.0.id', $u['creator']->id);

        // Channel-style: the creator (not assigned) still sees it; the top-level list does not.
        $sub = Task::where('title', 'Draft the deck')->first();
        $this->actAs($u['creator'])->getJson("/api/v1/tasks/{$sub->id}")->assertOk();
        $this->actAs($u['creator'])->getJson("/api/v1/tasks/{$group->id}/subtasks")->assertJsonFragment(['id' => $sub->id]);
        $listed = collect($this->actAs($u['creator'])->getJson('/api/v1/tasks?scope=groups')->json('data'))->pluck('id');
        $this->assertTrue($listed->contains($group->id));
        $this->assertFalse($listed->contains($sub->id), 'tasks inside a group must not appear in the top-level groups list');
        $this->actAs($u['outsider'])->getJson("/api/v1/tasks/{$sub->id}")->assertForbidden();
    }

    public function test_a_subtask_mention_must_be_someone_in_the_group(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);
        $sub = Task::find($this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Narrow task', 'assignees' => [$u['member']->id],
        ])->json('id'));

        // The group's creator is in the group even though not assigned to this sub-task.
        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$sub->id}/mentions", ['user_id' => $u['creator']->id])
            ->assertOk();
        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$sub->id}/mentions", ['user_id' => $u['outsider']->id])
            ->assertStatus(422);

        // Comment tags follow the same group-wide rule.
        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$sub->id}/comments", [
            'content' => 'ping', 'mentioned_user_id' => $u['creator']->id,
        ])->assertCreated();
        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$sub->id}/comments", [
            'content' => 'ping', 'mentioned_user_id' => $u['outsider']->id,
        ])->assertStatus(422);
    }

    public function test_closing_a_group_locks_its_tasks_and_reopening_unlocks_them(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);
        $sub = Task::find($this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Work item', 'assignees' => [$u['member']->id],
        ])->json('id'));

        $this->actAs($u['admin'])->postJson("/api/v1/tasks/{$group->id}/close")->assertForbidden();
        $this->actAs($u['super'])->postJson("/api/v1/tasks/{$sub->id}/close")->assertStatus(422);
        $this->actAs($u['super'])->postJson("/api/v1/tasks/{$group->id}/close")->assertOk();

        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$sub->id}/comments", ['content' => 'hi'])->assertStatus(423);
        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Late', 'assignees' => [$u['member']->id],
        ])->assertStatus(423);

        $this->actAs($u['super'])->postJson("/api/v1/tasks/{$group->id}/reopen")->assertOk();
        $this->actAs($u['member'])->postJson("/api/v1/tasks/{$sub->id}/comments", ['content' => 'back'])->assertCreated();
    }

    public function test_deleting_a_group_deletes_its_tasks(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);
        $sub = Task::find($this->actAs($u['member'])->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Work item', 'assignees' => [$u['member']->id],
        ])->json('id'));

        $this->actAs($u['creator'])->deleteJson("/api/v1/tasks/{$group->id}")->assertOk();
        $this->assertNull(Task::find($sub->id));
    }

    public function test_reports_and_department_views_exclude_private_groups(): void
    {
        $u = $this->fixture();
        $group = $this->makeGroup($u['creator'], [$u['member']]);
        $group->update(['status' => 'completed']);

        $report = $this->actAs($u['admin'])->getJson('/api/v1/reports/performance')->assertOk()->json();
        $this->assertSame([], $report['employees'], 'a completed private task must not count towards anyone\'s performance');
    }
}
