<?php

namespace Tests\Feature;

use App\Models\Task;
use App\Models\TaskNotification;

class DueDatesTest extends ApiTestCase
{
    private function task(array $attrs, $assignee = null): Task
    {
        $creator = $attrs['creator'] ?? $this->makeUser('manager');
        unset($attrs['creator']);

        $task = Task::create(array_merge(['title' => 'T', 'creator_id' => $creator->id], $attrs));
        if ($assignee) {
            $task->assignees()->attach($assignee->id);
        }

        return $task;
    }

    public function test_is_overdue_flag_only_applies_to_unfinished_tasks_past_their_date(): void
    {
        $admin = $this->makeUser('admin');
        $late = $this->task(['title' => 'late', 'due_date' => today()->subDays(2)]);
        $done = $this->task(['title' => 'done', 'due_date' => today()->subDays(2), 'status' => 'completed']);
        $today = $this->task(['title' => 'today', 'due_date' => today()]);
        $none = $this->task(['title' => 'none']);

        $byTitle = collect($this->actAs($admin)->getJson('/api/v1/tasks?per_page=100')->json('data'))->keyBy('title');

        $this->assertTrue($byTitle['late']['is_overdue']);
        $this->assertFalse($byTitle['done']['is_overdue']);
        $this->assertFalse($byTitle['today']['is_overdue']);
        $this->assertFalse($byTitle['none']['is_overdue']);
    }

    public function test_dashboard_counts_overdue_within_each_users_scope_and_ignores_private_groups(): void
    {
        $dept = $this->department();
        $manager = $this->makeUser('manager', $dept);
        $other = $this->makeUser('manager', $this->department('Other'));
        $this->task(['department_id' => $dept->id, 'due_date' => today()->subDay(), 'creator' => $other]);
        $this->task(['department_id' => $dept->id, 'due_date' => today()->subDay(), 'creator' => $other, 'status' => 'completed']);
        $this->task(['department_id' => $other->department_id, 'due_date' => today()->subDay(), 'creator' => $other]);
        $this->task(['is_private' => true, 'due_date' => today()->subDay(), 'creator' => $other]);

        $this->actAs($manager)->getJson('/api/v1/dashboard/stats')->assertJsonPath('tasks.overdue', 1);
        $this->actAs($this->makeUser('admin'))->getJson('/api/v1/dashboard/stats')->assertJsonPath('tasks.overdue', 2);
    }

    public function test_notify_due_sends_each_reminder_once(): void
    {
        $manager = $this->makeUser('manager');
        $worker = $this->makeUser('employee');

        $tomorrow = $this->task(['title' => 'tomorrow', 'due_date' => today()->addDay(), 'creator' => $manager], $worker);
        $late = $this->task(['title' => 'late', 'due_date' => today()->subDays(3), 'creator' => $manager], $worker);
        $this->task(['title' => 'far', 'due_date' => today()->addDays(10), 'creator' => $manager], $worker);
        $this->task(['title' => 'finished', 'due_date' => today()->subDays(3), 'status' => 'completed', 'creator' => $manager], $worker);

        $this->artisan('tasks:notify-due')->assertSuccessful();

        $soon = TaskNotification::where('type', 'task_due_soon')->get();
        $this->assertCount(1, $soon);
        $this->assertSame($worker->id, $soon->first()->user_id);
        $this->assertSame('tomorrow', $soon->first()->data['when']);

        $overdue = TaskNotification::where('type', 'task_overdue')->get();
        $this->assertCount(2, $overdue, 'assignee and creator are both told');
        $this->assertEqualsCanonicalizing([$worker->id, $manager->id], $overdue->pluck('user_id')->all());
        $this->assertSame(3, $overdue->first()->data['days_overdue']);

        // Second run is a no-op.
        $this->artisan('tasks:notify-due')->assertSuccessful();
        $this->assertSame(1, TaskNotification::where('type', 'task_due_soon')->count());
        $this->assertSame(2, TaskNotification::where('type', 'task_overdue')->count());
    }

    public function test_changing_the_due_date_rearms_the_reminders(): void
    {
        $manager = $this->makeUser('manager');
        $worker = $this->makeUser('employee');
        $task = $this->task(['due_date' => today()->subDay(), 'creator' => $manager], $worker);

        $this->artisan('tasks:notify-due');
        $this->assertNotNull($task->fresh()->overdue_notified_at);

        // Same date saved again: stays stamped.
        $this->actAs($manager)->putJson("/api/v1/tasks/{$task->id}", ['due_date' => today()->subDay()->toDateString()])->assertOk();
        $this->assertNotNull($task->fresh()->overdue_notified_at);

        // New date: re-armed.
        $this->actAs($manager)->putJson("/api/v1/tasks/{$task->id}", ['due_date' => today()->addDay()->toDateString()])->assertOk();
        $fresh = $task->fresh();
        $this->assertNull($fresh->overdue_notified_at);
        $this->assertNull($fresh->due_reminder_sent_at);

        $this->artisan('tasks:notify-due');
        $this->assertSame(1, TaskNotification::where('type', 'task_due_soon')->count());
    }

    public function test_group_subtask_reminders_reach_members_only(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $outsider = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member]);

        $this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Group deadline', 'assignees' => [$member->id], 'due_date' => today()->subDay()->toDateString(),
        ])->assertCreated();

        $this->artisan('tasks:notify-due');

        $recipients = TaskNotification::where('type', 'task_overdue')->pluck('user_id');
        $this->assertTrue($recipients->contains($member->id));
        $this->assertFalse($recipients->contains($outsider->id));
    }
}
