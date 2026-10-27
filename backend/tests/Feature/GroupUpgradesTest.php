<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskNotification;

class GroupUpgradesTest extends ApiTestCase
{
    private function setup3(): array
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $other = $this->makeUser('employee');
        $outsider = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member, $other]);

        return compact('creator', 'member', 'other', 'outsider', 'group');
    }

    // ── Rename ──────────────────────────────────────────────────────────────

    public function test_only_the_creator_can_rename_a_group_and_a_task_creator_can_rename_their_task(): void
    {
        ['creator' => $creator, 'member' => $member, 'outsider' => $outsider, 'group' => $group] = $this->setup3();
        $super = $this->makeUser('super_admin');

        $this->actAs($creator)->putJson("/api/v1/tasks/{$group->id}", ['title' => 'Renamed', 'description' => 'New text'])
            ->assertOk()->assertJsonPath('title', 'Renamed');
        $this->actAs($member)->putJson("/api/v1/tasks/{$group->id}", ['title' => 'Hijack'])->assertForbidden();
        $this->actAs($outsider)->putJson("/api/v1/tasks/{$group->id}", ['title' => 'Hijack'])->assertForbidden();
        $this->actAs($super)->putJson("/api/v1/tasks/{$group->id}", ['title' => 'By admin'])->assertOk();

        // Renaming doesn't touch membership.
        $this->assertCount(2, $group->fresh()->assignees);

        $sub = Task::find($this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Mine', 'assignees' => [$member->id],
        ])->json('id'));
        $this->actAs($member)->putJson("/api/v1/tasks/{$sub->id}", ['title' => 'Mine v2'])->assertOk();
        $this->actAs($creator)->putJson("/api/v1/tasks/{$sub->id}", ['title' => 'Mine v3'])->assertOk(); // group owner may too
    }

    // ── Leave ───────────────────────────────────────────────────────────────

    public function test_a_member_can_leave_and_loses_access_everywhere_in_the_group(): void
    {
        ['creator' => $creator, 'member' => $member, 'other' => $other, 'group' => $group] = $this->setup3();
        $sub = Task::find($this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Shared', 'assignees' => [$member->id, $other->id],
        ])->json('id'));
        TaskComment::create(['task_id' => $group->id, 'user_id' => $creator->id, 'content' => 'hi']);
        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/read");

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/leave")->assertOk();

        $this->actAs($member)->getJson("/api/v1/tasks/{$group->id}")->assertForbidden();
        $this->actAs($member)->getJson("/api/v1/tasks/{$sub->id}")->assertForbidden();
        $this->assertFalse($sub->fresh()->assignees->contains('id', $member->id));
        $this->assertTrue($sub->fresh()->assignees->contains('id', $other->id), 'others are untouched');
        $this->assertSame(0, \App\Models\TaskRead::where('user_id', $member->id)->count());

        $note = TaskNotification::where('type', 'group_member_left')->first();
        $this->assertSame($creator->id, $note->user_id);
        $this->assertSame($member->name, $note->data['user_name']);
    }

    public function test_the_creator_cannot_leave_and_outsiders_and_locked_groups_are_refused(): void
    {
        ['creator' => $creator, 'member' => $member, 'outsider' => $outsider, 'group' => $group] = $this->setup3();
        $super = $this->makeUser('super_admin');

        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/leave")->assertStatus(422);
        $this->actAs($outsider)->postJson("/api/v1/tasks/{$group->id}/leave")->assertForbidden();

        $this->actAs($super)->postJson("/api/v1/tasks/{$group->id}/close")->assertOk();
        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/leave")->assertStatus(423);
    }

    // ── Archive ─────────────────────────────────────────────────────────────

    public function test_archiving_hides_the_group_locks_it_and_can_be_undone(): void
    {
        ['creator' => $creator, 'member' => $member, 'outsider' => $outsider, 'group' => $group] = $this->setup3();
        $sub = Task::find($this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Work', 'assignees' => [$member->id],
        ])->json('id'));

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/archive")->assertForbidden();
        $this->actAs($outsider)->postJson("/api/v1/tasks/{$group->id}/archive")->assertForbidden();
        $this->actAs($creator)->postJson("/api/v1/tasks/{$sub->id}/archive")->assertStatus(422);

        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/archive")->assertOk();

        // Gone from the default list, present on the archived tab.
        $active = collect($this->actAs($member)->getJson('/api/v1/tasks?scope=groups')->json('data'))->pluck('id');
        $archived = collect($this->actAs($member)->getJson('/api/v1/tasks?scope=groups&archived=1')->json('data'))->pluck('id');
        $this->assertFalse($active->contains($group->id));
        $this->assertTrue($archived->contains($group->id));

        // Read-only for everyone (including the sub-tasks), with an accurate message.
        $this->actAs($member)->postJson("/api/v1/tasks/{$sub->id}/comments", ['content' => 'late'])
            ->assertStatus(423)->assertJsonPath('message', 'This group is archived.');
        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/subtasks", ['title' => 'x', 'assignees' => [$member->id]])
            ->assertStatus(423);

        // Archived groups don't contribute unread badges.
        TaskComment::create(['task_id' => $group->id, 'user_id' => $creator->id, 'content' => 'x']);
        $this->assertEmpty((array) $this->actAs($member)->getJson('/api/v1/notifications/summary')->json('groups_unread'));

        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/unarchive")->assertOk();
        $this->actAs($member)->postJson("/api/v1/tasks/{$sub->id}/comments", ['content' => 'back'])->assertCreated();
    }

    public function test_a_closed_group_still_reports_closed_not_archived(): void
    {
        ['member' => $member, 'group' => $group] = $this->setup3();
        $this->actAs($this->makeUser('super_admin'))->postJson("/api/v1/tasks/{$group->id}/close")->assertOk();

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/comments", ['content' => 'x'])
            ->assertStatus(423)->assertJsonPath('message', 'This group is closed.');
    }

    // ── Seen by ─────────────────────────────────────────────────────────────

    public function test_readers_list_members_with_how_far_each_has_read(): void
    {
        ['creator' => $creator, 'member' => $member, 'outsider' => $outsider, 'group' => $group] = $this->setup3();
        $first = TaskComment::create(['task_id' => $group->id, 'user_id' => $creator->id, 'content' => 'one']);

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/read")->assertOk();

        $readers = collect($this->actAs($creator)->getJson("/api/v1/tasks/{$group->id}/readers")->assertOk()->json())->keyBy('id');
        $this->assertCount(3, $readers, 'creator + both members');
        $this->assertSame($first->id, $readers[$member->id]['last_read_comment_id']);
        $this->assertSame(0, $readers[$creator->id]['last_read_comment_id']);

        $this->actAs($outsider)->getJson("/api/v1/tasks/{$group->id}/readers")->assertForbidden();

        $normal = Task::create(['title' => 'Normal', 'creator_id' => $creator->id]);
        $this->actAs($creator)->getJson("/api/v1/tasks/{$normal->id}/readers")->assertOk()->assertExactJson([]);
    }

    // ── @mentions ───────────────────────────────────────────────────────────

    public function test_a_message_can_tag_several_people_and_each_is_notified_once(): void
    {
        ['creator' => $creator, 'member' => $member, 'other' => $other, 'group' => $group] = $this->setup3();

        $response = $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/comments", [
            'content' => "@{$member->name} and @{$other->name} please look",
            'mentioned_user_ids' => [$member->id, $other->id, $member->id, $creator->id],
        ])->assertCreated();

        $this->assertEqualsCanonicalizing([$member->id, $other->id, $creator->id], collect($response->json('mentioned_users'))->pluck('id')->all());

        $mentions = TaskNotification::where('type', 'comment_mention')->pluck('user_id');
        $this->assertEqualsCanonicalizing([$member->id, $other->id], $mentions->all(), 'self-tag and duplicates are ignored');

        // Tagged people get the mention, not a second generic "new comment" ping.
        $generic = TaskNotification::where('type', 'task_comment')->pluck('user_id');
        $this->assertFalse($generic->contains($member->id));
        $this->assertFalse($generic->contains($other->id));
    }

    public function test_tagging_someone_outside_the_group_is_rejected_and_the_legacy_field_still_works(): void
    {
        ['creator' => $creator, 'member' => $member, 'outsider' => $outsider, 'group' => $group] = $this->setup3();

        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/comments", [
            'content' => 'hey', 'mentioned_user_ids' => [$member->id, $outsider->id],
        ])->assertStatus(422);
        $this->assertSame(0, TaskComment::count());

        $this->actAs($creator)->postJson("/api/v1/tasks/{$group->id}/comments", [
            'content' => 'hey', 'mentioned_user_id' => $member->id,
        ])->assertCreated()->assertJsonPath('mentioned_users.0.id', $member->id);
    }

    public function test_a_reply_must_belong_to_a_comment_of_the_same_task(): void
    {
        ['creator' => $creator, 'member' => $member, 'group' => $group] = $this->setup3();
        $secret = TaskComment::create(['task_id' => $group->id, 'user_id' => $creator->id, 'content' => 'private chat']);

        // Someone with access to a *different* task tries to inject a reply under the group's comment.
        $dept = $this->department();
        $manager = $this->makeUser('manager', $dept);
        $worker = $this->makeUser('employee', $dept);
        $normal = Task::create(['title' => 'Normal', 'creator_id' => $manager->id, 'department_id' => $dept->id]);
        $normal->assignees()->attach($worker->id);

        $this->actAs($worker)->postJson("/api/v1/tasks/{$normal->id}/comments", [
            'content' => 'injected', 'parent_id' => $secret->id,
        ])->assertStatus(422);

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/comments", [
            'content' => 'legit reply', 'parent_id' => $secret->id,
        ])->assertCreated();
    }
}
