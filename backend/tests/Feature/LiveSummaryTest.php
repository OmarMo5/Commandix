<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskNotification;
use App\Models\TaskRead;

class LiveSummaryTest extends ApiTestCase
{
    private function say($user, Task $task, string $text): TaskComment
    {
        return TaskComment::create(['task_id' => $task->id, 'user_id' => $user->id, 'content' => $text]);
    }

    private function summary($user): array
    {
        return $this->actAs($user)->getJson('/api/v1/notifications/summary')->assertOk()->json();
    }

    public function test_summary_reports_bell_count_and_newest_notification_id(): void
    {
        $user = $this->makeUser('employee');
        $first = TaskNotification::create(['user_id' => $user->id, 'type' => 'task_assigned', 'data' => []]);
        $second = TaskNotification::create(['user_id' => $user->id, 'type' => 'task_assigned', 'data' => []]);
        $second->markAsRead();
        TaskNotification::create(['user_id' => $this->makeUser('employee')->id, 'type' => 'task_assigned', 'data' => []]);

        $s = $this->summary($user);
        $this->assertSame(1, $s['unread_count']);
        $this->assertSame($second->id, $s['latest_id']);
        $this->assertEmpty((array) $s['groups_unread']);
    }

    public function test_group_unread_counts_other_peoples_messages_across_the_group_and_its_tasks(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $outsider = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member]);
        $sub = Task::find($this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Child', 'assignees' => [$member->id],
        ])->json('id'));

        $this->say($creator, $group, 'hello');
        $this->say($creator, $group, 'anyone there?');
        $this->say($creator, $sub, 'about the child');
        $this->say($member, $group, 'my own message never counts for me');

        $s = $this->summary($member);
        $this->assertSame(3, $s['groups_unread'][$group->id]);
        $this->assertSame(2, $s['tasks_unread'][$group->id]);
        $this->assertSame(1, $s['tasks_unread'][$sub->id]);

        // The author sees only what others wrote (the member's message).
        $this->assertSame(1, $this->summary($creator)['groups_unread'][$group->id]);

        // Non-members get nothing, and normal tasks never produce group counters.
        $this->assertEmpty((array) $this->summary($outsider)['groups_unread']);
    }

    public function test_marking_read_clears_the_counter_and_the_pointer_never_moves_backwards(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member]);
        $this->say($creator, $group, 'one');
        $last = $this->say($creator, $group, 'two');

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/read")->assertOk()
            ->assertJsonPath('last_read_comment_id', $last->id);
        $this->assertEmpty((array) $this->summary($member)['groups_unread']);

        // A new message re-opens the counter…
        $this->say($creator, $group, 'three');
        $this->assertSame(1, $this->summary($member)['groups_unread'][$group->id]);

        // …and a pointer that is somehow ahead is left alone.
        TaskRead::where('user_id', $member->id)->update(['last_read_comment_id' => 9999]);
        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/read")->assertJsonPath('last_read_comment_id', 9999);
    }

    public function test_only_people_who_can_view_a_task_can_mark_it_read_and_normal_tasks_keep_no_state(): void
    {
        $creator = $this->makeUser('employee');
        $outsider = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$this->makeUser('employee')]);

        $this->actAs($outsider)->postJson("/api/v1/tasks/{$group->id}/read")->assertForbidden();

        $normal = Task::create(['title' => 'Normal', 'creator_id' => $creator->id]);
        $this->actAs($creator)->postJson("/api/v1/tasks/{$normal->id}/read")->assertOk();
        $this->assertSame(0, TaskRead::count());
    }
}
