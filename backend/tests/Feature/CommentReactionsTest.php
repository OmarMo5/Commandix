<?php

namespace Tests\Feature;

use App\Models\CommentReaction;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskNotification;

class CommentReactionsTest extends ApiTestCase
{
    private function comment(Task $task, $author, string $text = 'Looks good', ?int $parent = null): TaskComment
    {
        return TaskComment::create(['task_id' => $task->id, 'user_id' => $author->id, 'content' => $text, 'parent_id' => $parent]);
    }

    private function react($user, Task $task, TaskComment $comment, string $emoji = '👍')
    {
        return $this->actAs($user)->postJson("/api/v1/tasks/{$task->id}/comments/{$comment->id}/reactions", ['emoji' => $emoji]);
    }

    public function test_reacting_toggles_on_and_off(): void
    {
        $author = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$member]);
        $comment = $this->comment($group, $author);

        $on = $this->react($member, $group, $comment)->assertOk()->json('reactions');
        $this->assertSame([['emoji' => '👍', 'count' => 1, 'reacted' => true, 'users' => [$member->name]]], $on);

        $off = $this->react($member, $group, $comment)->assertOk()->json('reactions');
        $this->assertSame([], $off);
        $this->assertSame(0, CommentReaction::count());
    }

    public function test_counts_group_by_emoji_and_reacted_is_per_viewer(): void
    {
        $author = $this->makeUser('employee');
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$a, $b]);
        $comment = $this->comment($group, $author);

        $this->react($a, $group, $comment, '👍');
        $this->react($b, $group, $comment, '👍');
        $this->react($b, $group, $comment, '🎉');

        $forA = collect($this->actAs($a)->getJson("/api/v1/tasks/{$group->id}/comments")->json('0.reaction_summary'))->keyBy('emoji');
        $this->assertSame(2, $forA['👍']['count']);
        $this->assertTrue($forA['👍']['reacted']);
        $this->assertFalse($forA['🎉']['reacted'], 'A did not react with 🎉');
        $this->assertEqualsCanonicalizing([$a->name, $b->name], $forA['👍']['users']);

        $forAuthor = collect($this->actAs($author)->getJson("/api/v1/tasks/{$group->id}/comments")->json('0.reaction_summary'))->keyBy('emoji');
        $this->assertFalse($forAuthor['👍']['reacted']);
    }

    public function test_replies_can_be_reacted_to_and_show_in_the_listing(): void
    {
        $author = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$member]);
        $parent = $this->comment($group, $author);
        $reply = $this->comment($group, $member, 'Thanks!', $parent->id);

        $this->react($author, $group, $reply, '❤️')->assertOk();

        $listed = $this->actAs($member)->getJson("/api/v1/tasks/{$group->id}/comments")->json();
        $this->assertSame('❤️', $listed[0]['replies'][0]['reaction_summary'][0]['emoji']);
        $this->assertArrayNotHasKey('reactions', $listed[0], 'the raw relation is not leaked');
    }

    public function test_only_the_allowed_emoji_are_accepted(): void
    {
        $author = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$this->makeUser('employee')]);
        $comment = $this->comment($group, $author);

        foreach (['🍕', '', 'thumbs', '<script>'] as $bad) {
            $this->react($author, $group, $comment, $bad)->assertStatus(422);
        }
        $this->actAs($author)->postJson("/api/v1/tasks/{$group->id}/comments/{$comment->id}/reactions", [])->assertStatus(422);
        $this->assertSame(0, CommentReaction::count());
    }

    public function test_people_outside_the_task_cannot_react(): void
    {
        $author = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$this->makeUser('employee')]);
        $comment = $this->comment($group, $author);

        $this->react($this->makeUser('employee'), $group, $comment)->assertForbidden();
        $this->assertSame(0, CommentReaction::count());
    }

    public function test_a_comment_from_another_task_cannot_be_reached_through_this_one(): void
    {
        $me = $this->makeUser('employee');
        $mine = $this->makeGroup($me, [$this->makeUser('employee')], 'Mine');
        $theirs = $this->makeGroup($this->makeUser('employee'), [$this->makeUser('employee')], 'Theirs');
        $foreign = $this->comment($theirs, $theirs->creator);

        $this->react($me, $mine, $foreign)->assertNotFound();
        $this->assertSame(0, CommentReaction::count());
    }

    public function test_archived_groups_are_read_only_but_the_super_admin_can_still_react(): void
    {
        $author = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$member]);
        $comment = $this->comment($group, $author);
        $group->update(['archived_at' => now()]);

        $this->react($member, $group, $comment)->assertStatus(423);
        $this->react($this->makeUser('super_admin'), $group, $comment)->assertOk();
    }

    public function test_the_author_is_notified_once_and_never_about_their_own_reaction(): void
    {
        $author = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$member], 'Launch');
        $comment = $this->comment($group, $author, 'Ship it on Friday');

        $this->react($author, $group, $comment);   // own reaction: silent
        $this->assertSame(0, TaskNotification::where('type', 'comment_reaction')->count());

        $this->react($member, $group, $comment);
        $this->react($member, $group, $comment);   // off
        $this->react($member, $group, $comment);   // on again while the first is unread: no second ping
        $this->react($member, $group, $comment, '🎉');   // a different emoji is a new event

        $notes = TaskNotification::where('type', 'comment_reaction')->get();
        $this->assertCount(2, $notes);
        $this->assertSame($author->id, $notes[0]->user_id);
        $this->assertSame('Launch', $notes[0]->data['task_title']);
        $this->assertSame($member->name, $notes[0]->data['from']);
        $this->assertSame('Ship it on Friday', $notes[0]->data['preview']);

        // Informational, so it lands in the Other tab rather than the Primary one.
        $other = $this->actAs($author)->getJson('/api/v1/notifications?tab=other')->json('notifications.data');
        $this->assertCount(2, $other);
        $this->assertCount(0, $this->actAs($author)->getJson('/api/v1/notifications?tab=primary')->json('notifications.data'));
    }

    public function test_deleting_a_comment_removes_its_reactions(): void
    {
        $author = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$this->makeUser('employee')]);
        $comment = $this->comment($group, $author);
        $this->react($author, $group, $comment);

        $this->actAs($author)->deleteJson("/api/v1/tasks/{$group->id}/comments/{$comment->id}")->assertOk();

        $this->assertSame(0, CommentReaction::count());
    }

    public function test_posting_a_comment_returns_an_empty_reaction_summary(): void
    {
        $author = $this->makeUser('employee');
        $group = $this->makeGroup($author, [$this->makeUser('employee')]);

        $this->actAs($author)->postJson("/api/v1/tasks/{$group->id}/comments", ['content' => 'first'])
            ->assertCreated()->assertJsonPath('reaction_summary', []);
    }

    public function test_the_attention_filter_is_overdue_plus_due_today_and_skips_finished_work(): void
    {
        $admin = $this->makeUser('admin');
        $make = fn(string $title, array $extra = []) => Task::create(array_merge(['title' => $title, 'creator_id' => $admin->id], $extra));
        $make('late', ['due_date' => today()->subDays(3)]);
        $make('today', ['due_date' => today()]);
        $make('late but done', ['due_date' => today()->subDays(3), 'status' => 'completed']);
        $make('tomorrow', ['due_date' => today()->addDay()]);
        $make('no date');

        $titles = collect($this->actAs($admin)->getJson('/api/v1/tasks?due=attention&per_page=50')->assertOk()->json('data'))->pluck('title')->sort()->values()->all();

        $this->assertSame(['late', 'today'], $titles);
        $this->actAs($admin)->getJson('/api/v1/tasks?due=whenever')->assertStatus(422);
    }

    public function test_assigned_to_me_means_assigned_not_merely_created_unlike_mine(): void
    {
        $me = $this->makeUser('manager');
        $other = $this->makeUser('employee');
        $mineByAssignment = Task::create(['title' => 'assigned to me', 'creator_id' => $other->id]);
        $mineByAssignment->assignees()->attach($me->id);
        $createdByMe = Task::create(['title' => 'I created it for them', 'creator_id' => $me->id]);
        $createdByMe->assignees()->attach($other->id);
        Task::create(['title' => 'unrelated', 'creator_id' => $other->id]);

        $titles = fn(string $qs) => collect($this->actAs($me)->getJson("/api/v1/tasks?per_page=50&{$qs}")->json('data'))->pluck('title')->sort()->values()->all();

        $this->assertSame(['assigned to me'], $titles('assigned_to_me=1'));
        $this->assertSame(['I created it for them', 'assigned to me'], $titles('mine=1'), '`mine` keeps its wider meaning');
        $this->actAs($me)->postJson('/api/v1/saved-views', ['name' => 'Mine', 'filters' => ['assigned_to_me' => true]])
            ->assertCreated()->assertJsonPath('filters.assigned_to_me', true);
    }
}
