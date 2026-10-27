<?php

namespace Tests\Feature;

use App\Models\SavedView;
use App\Models\Task;

class TaskFiltersTest extends ApiTestCase
{
    private function task(string $title, array $attrs = [], array $assignees = []): Task
    {
        $task = Task::create(array_merge(['title' => $title, 'creator_id' => $this->makeUser('manager')->id], $attrs));
        $task->assignees()->sync(collect($assignees)->pluck('id')->all());

        return $task;
    }

    private function titles($response): array
    {
        return collect($response->assertOk()->json('data'))->pluck('title')->sort()->values()->all();
    }

    public function test_search_matches_title_and_description_and_treats_wildcards_literally(): void
    {
        $admin = $this->makeUser('admin');
        $this->task('Quarterly report');
        $this->task('Other', ['description' => 'contains the quarterly numbers']);
        $this->task('Discount 100% off');
        $this->task('Discount 1000 off');

        $this->assertSame(['Other', 'Quarterly report'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?search=quarterly')));
        $this->assertSame(['Discount 100% off'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?search=100%25')));
    }

    public function test_status_priority_department_and_assignee_filters(): void
    {
        $admin = $this->makeUser('admin');
        $dept = $this->department();
        $ann = $this->makeUser('employee', $dept);
        $bob = $this->makeUser('employee', $dept);

        $this->task('A', ['priority' => 'high', 'department_id' => $dept->id], [$ann]);
        $this->task('B', ['priority' => 'low', 'status' => 'completed'], [$bob]);
        $this->task('C', ['priority' => 'high'], [$ann, $bob]);

        $this->assertSame(['A', 'C'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?priority=high')));
        $this->assertSame(['B'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?status=completed')));
        $this->assertSame(['A'], $this->titles($this->actAs($admin)->getJson("/api/v1/tasks?department_id={$dept->id}")));
        $this->assertSame(['A', 'C'], $this->titles($this->actAs($admin)->getJson("/api/v1/tasks?assignee_id={$ann->id}")));
        $this->assertSame(['C'], $this->titles($this->actAs($admin)->getJson("/api/v1/tasks?assignee_id={$ann->id}&priority=high&status=pending&search=C")));
    }

    public function test_mine_returns_tasks_assigned_to_or_created_by_me(): void
    {
        $me = $this->makeUser('manager');
        $other = $this->makeUser('employee');
        $this->task('Assigned to me', [], [$me]);
        $this->task('Created by me', ['creator_id' => $me->id]);
        $this->task('Not mine', [], [$other]);

        $this->assertSame(['Assigned to me', 'Created by me'], $this->titles($this->actAs($me)->getJson('/api/v1/tasks?mine=1&per_page=100')));
    }

    public function test_due_presets_and_custom_range(): void
    {
        $admin = $this->makeUser('admin');
        $this->task('late', ['due_date' => today()->subDays(2)]);
        $this->task('late but done', ['due_date' => today()->subDays(2), 'status' => 'completed']);
        $this->task('today', ['due_date' => today()]);
        $this->task('in 5 days', ['due_date' => today()->addDays(5)]);
        $this->task('in 30 days', ['due_date' => today()->addDays(30)]);
        $this->task('no date');

        $this->assertSame(['late'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?due=overdue')));
        $this->assertSame(['today'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?due=today')));
        $this->assertSame(['in 5 days', 'today'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?due=week')));
        $this->assertSame(['no date'], $this->titles($this->actAs($admin)->getJson('/api/v1/tasks?due=none')));

        $from = today()->addDays(3)->toDateString();
        $to = today()->addDays(40)->toDateString();
        $this->assertSame(['in 30 days', 'in 5 days'], $this->titles($this->actAs($admin)->getJson("/api/v1/tasks?due_from={$from}&due_to={$to}")));
    }

    public function test_filters_never_widen_what_a_user_is_allowed_to_see(): void
    {
        $dept = $this->department();
        $me = $this->makeUser('employee', $dept);
        $colleague = $this->makeUser('employee', $dept);

        $this->task('mine', ['department_id' => $dept->id], [$me]);
        $this->task('colleagues', ['department_id' => $dept->id], [$colleague]);

        // Asking for someone else's tasks, or the whole department, still only yields what I can see.
        $this->assertSame([], $this->titles($this->actAs($me)->getJson("/api/v1/tasks?assignee_id={$colleague->id}")));
        $this->assertSame(['mine'], $this->titles($this->actAs($me)->getJson("/api/v1/tasks?department_id={$dept->id}")));
    }

    public function test_invalid_filter_values_are_rejected(): void
    {
        $admin = $this->makeUser('admin');

        $this->actAs($admin)->getJson('/api/v1/tasks?due=someday')->assertStatus(422);
        $this->actAs($admin)->getJson('/api/v1/tasks?due_from=not-a-date')->assertStatus(422);
        $this->actAs($admin)->getJson('/api/v1/tasks?priority=urgent')->assertStatus(422);
    }

    public function test_saved_views_are_personal_unique_and_whitelist_their_filters(): void
    {
        $me = $this->makeUser('manager');
        $other = $this->makeUser('manager');

        $this->actAs($me)->postJson('/api/v1/saved-views', [
            'name' => 'Urgent mine', 'filters' => ['priority' => 'high', 'mine' => true, 'sql' => "'; drop table tasks;--"],
        ])->assertCreated()->assertJsonPath('filters.priority', 'high')->assertJsonMissingPath('filters.sql');

        // Same name overwrites instead of duplicating.
        $this->actAs($me)->postJson('/api/v1/saved-views', ['name' => 'Urgent mine', 'filters' => ['priority' => 'low']])->assertOk();
        $this->assertSame(1, SavedView::where('user_id', $me->id)->count());

        $this->actAs($me)->getJson('/api/v1/saved-views')->assertJsonCount(1);
        $this->actAs($other)->getJson('/api/v1/saved-views')->assertJsonCount(0);

        $view = SavedView::first();
        $this->actAs($other)->deleteJson("/api/v1/saved-views/{$view->id}")->assertNotFound();
        $this->actAs($me)->deleteJson("/api/v1/saved-views/{$view->id}")->assertOk();
        $this->assertSame(0, SavedView::count());
    }
}
