<?php

namespace Tests\Feature;

use App\Models\TaskNotification;
use Illuminate\Support\Carbon;

class NotificationInboxTest extends ApiTestCase
{
    private function note($user, string $type = 'task_assigned', array $attrs = []): TaskNotification
    {
        return TaskNotification::create(array_merge(['user_id' => $user->id, 'type' => $type, 'data' => ['task_title' => 'T']], $attrs));
    }

    private function list($user, string $query = ''): array
    {
        return $this->actAs($user)->getJson('/api/v1/notifications' . $query)->assertOk()->json();
    }

    private function ids(array $response): array
    {
        return collect($response['notifications']['data'])->pluck('id')->sort()->values()->all();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_primary_and_other_tabs_split_by_how_much_attention_the_event_needs(): void
    {
        $me = $this->makeUser('employee');
        $assigned = $this->note($me, 'task_assigned');
        $mention  = $this->note($me, 'comment_mention');
        $done     = $this->note($me, 'task_completed');
        $left     = $this->note($me, 'group_member_left');

        $this->assertSame([$assigned->id, $mention->id], $this->ids($this->list($me, '?tab=primary')));
        $this->assertSame([$done->id, $left->id], $this->ids($this->list($me, '?tab=other')));
        $this->assertCount(4, $this->list($me)['notifications']['data'], 'no tab = the whole inbox, as before');
    }

    public function test_tab_counts_and_bell_cover_only_the_inbox(): void
    {
        $me = $this->makeUser('employee');
        $this->note($me, 'task_assigned');
        $this->note($me, 'task_completed');
        $parked = $this->note($me, 'task_assigned');
        $gone = $this->note($me, 'task_assigned');
        $this->actAs($me)->putJson("/api/v1/notifications/{$parked->id}/snooze", ['until' => 'someday'])->assertOk();
        $this->actAs($me)->putJson("/api/v1/notifications/{$gone->id}/clear")->assertOk();

        $r = $this->list($me);
        $this->assertSame(2, $r['unread_count']);
        $this->assertSame(['primary_unread' => 1, 'other_unread' => 1, 'later' => 1], $r['counts']);
        $this->assertSame(2, $this->actAs($me)->getJson('/api/v1/notifications/summary')->json('unread_count'), 'the bell ignores Later and Cleared');
    }

    public function test_clearing_moves_it_to_cleared_marks_it_read_and_restoring_brings_it_back(): void
    {
        $me = $this->makeUser('employee');
        $n = $this->note($me);

        $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/clear")->assertOk();
        $this->assertNotNull($n->fresh()->cleared_at);
        $this->assertNotNull($n->fresh()->read_at);
        $this->assertSame([], $this->ids($this->list($me)));
        $this->assertSame([$n->id], $this->ids($this->list($me, '?tab=cleared')));

        $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/restore")->assertOk();
        $this->assertSame([$n->id], $this->ids($this->list($me)));
        $this->assertSame([], $this->ids($this->list($me, '?tab=cleared')));
    }

    public function test_snoozed_items_wait_in_later_and_return_unread_when_the_time_comes(): void
    {
        Carbon::setTestNow('2026-03-02 10:00:00');   // a Monday
        $me = $this->makeUser('employee');
        $n = $this->note($me, 'task_assigned', ['read_at' => now()]);

        $r = $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/snooze", ['until' => 'later_today'])->assertOk();
        $this->assertSame('2026-03-02 13:00:00', Carbon::parse($r->json('snoozed_until'))->format('Y-m-d H:i:s'));
        $this->assertSame([], $this->ids($this->list($me)));
        $this->assertSame([$n->id], $this->ids($this->list($me, '?tab=later')));

        Carbon::setTestNow('2026-03-02 13:00:01');
        $back = $this->list($me);
        $this->assertSame([$n->id], $this->ids($back), 'back in the inbox once the snooze runs out');
        $this->assertSame(1, $back['unread_count'], 'and it is unread again');
        $this->assertSame([], $this->ids($this->list($me, '?tab=later')));
    }

    public function test_snooze_options_land_on_the_expected_times(): void
    {
        Carbon::setTestNow('2026-03-04 15:30:00');   // a Wednesday
        $me = $this->makeUser('employee');
        $expected = ['tomorrow' => '2026-03-05 09:00:00', 'next_week' => '2026-03-09 09:00:00', 'someday' => null];

        foreach ($expected as $until => $when) {
            $n = $this->note($me);
            $r = $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/snooze", ['until' => $until])->assertOk();
            $this->assertSame($when, $r->json('snoozed_until') ? Carbon::parse($r->json('snoozed_until'))->format('Y-m-d H:i:s') : null, $until);
        }

        $this->actAs($me)->putJson("/api/v1/notifications/{$this->note($me)->id}/snooze", ['until' => 'never'])->assertStatus(422);
    }

    public function test_someday_stays_in_later_until_you_move_it_back(): void
    {
        $me = $this->makeUser('employee');
        $n = $this->note($me);
        $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/snooze", ['until' => 'someday'])->assertOk();

        Carbon::setTestNow(now()->addYears(2));
        $this->assertSame([$n->id], $this->ids($this->list($me, '?tab=later')));

        $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/restore")->assertOk();
        $this->assertSame([$n->id], $this->ids($this->list($me)));
    }

    public function test_clear_all_respects_the_tab_and_never_touches_other_people(): void
    {
        $me = $this->makeUser('employee');
        $other = $this->makeUser('employee');
        $p = $this->note($me, 'task_assigned');
        $o = $this->note($me, 'task_completed');
        $theirs = $this->note($other, 'task_assigned');
        $parked = $this->note($me, 'task_assigned');
        $this->actAs($me)->putJson("/api/v1/notifications/{$parked->id}/snooze", ['until' => 'someday']);

        $this->actAs($me)->postJson('/api/v1/notifications/clear-all', ['tab' => 'primary'])->assertOk()->assertJsonPath('cleared', 1);
        $this->assertNotNull($p->fresh()->cleared_at);
        $this->assertNull($o->fresh()->cleared_at, 'the Other tab was not cleared');
        $this->assertNull($parked->fresh()->cleared_at, 'Later items are not swept up');
        $this->assertNull($theirs->fresh()->cleared_at);

        $this->actAs($me)->postJson('/api/v1/notifications/clear-all')->assertOk();
        $this->assertNotNull($o->fresh()->cleared_at);
        $this->assertNull($theirs->fresh()->cleared_at);
        $this->actAs($me)->postJson('/api/v1/notifications/clear-all', ['tab' => 'bogus'])->assertStatus(422);
    }

    public function test_mark_all_read_leaves_parked_items_alone(): void
    {
        $me = $this->makeUser('employee');
        $a = $this->note($me);
        $parked = $this->note($me);
        $this->actAs($me)->putJson("/api/v1/notifications/{$parked->id}/snooze", ['until' => 'someday']);

        $this->actAs($me)->putJson('/api/v1/notifications/read-all')->assertOk();

        $this->assertNotNull($a->fresh()->read_at);
        $this->assertNull($parked->fresh()->read_at);
    }

    public function test_filter_chips_narrow_by_kind(): void
    {
        $me = $this->makeUser('employee');
        $mention = $this->note($me, 'task_mentioned');
        $tag = $this->note($me, 'comment_mention');
        $this->note($me, 'task_assigned');
        $due = $this->note($me, 'task_overdue');

        $this->assertSame([$mention->id, $tag->id], $this->ids($this->list($me, '?group=mentions')));
        $this->assertSame([$due->id], $this->ids($this->list($me, '?tab=primary&group=reminders')));
        $this->actAs($me)->getJson('/api/v1/notifications?group=nonsense')->assertStatus(422);
    }

    public function test_nobody_can_act_on_someone_elses_notification(): void
    {
        $me = $this->makeUser('employee');
        $n = $this->note($this->makeUser('employee'));

        foreach (['clear', 'restore'] as $verb) {
            $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/{$verb}")->assertNotFound();
        }
        $this->actAs($me)->putJson("/api/v1/notifications/{$n->id}/snooze", ['until' => 'someday'])->assertNotFound();
        $this->assertNull($n->fresh()->cleared_at);
        $this->assertNull($n->fresh()->later_at);
    }

    public function test_the_list_is_paginated_newest_first(): void
    {
        $me = $this->makeUser('employee');
        foreach (range(1, 25) as $i) {
            $this->note($me);
        }

        $page1 = $this->list($me)['notifications'];
        $this->assertCount(20, $page1['data']);
        $this->assertSame(2, $page1['last_page']);
        $this->assertGreaterThan($page1['data'][19]['id'], $page1['data'][0]['id']);
        $this->assertCount(5, $this->list($me, '?page=2')['notifications']['data']);
    }

    public function test_newest_first_follows_the_notification_date_not_the_row_id(): void
    {
        $me = $this->makeUser('employee');
        $new = $this->note($me);
        $old = $this->note($me);   // inserted later, so it has the higher id…
        $old->forceFill(['created_at' => now()->subDays(30)])->save();   // …but it is the older notification
        $this->assertGreaterThan($new->id, $old->id);

        $this->assertSame([$new->id, $old->id], collect($this->list($me)['notifications']['data'])->pluck('id')->all());
    }
}
