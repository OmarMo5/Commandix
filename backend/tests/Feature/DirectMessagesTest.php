<?php

namespace Tests\Feature;

use App\Models\DirectConversation;
use App\Models\DirectMessage;
use App\Models\Task;

class DirectMessagesTest extends ApiTestCase
{
    private function open($me, $other): int
    {
        return $this->actAs($me)->postJson('/api/v1/dm', ['user_id' => $other->id])->assertOk()->json('id');
    }

    private function say($me, int $conversation, string $text)
    {
        return $this->actAs($me)->postJson("/api/v1/dm/{$conversation}/messages", ['body' => $text]);
    }

    public function test_any_active_user_can_message_any_other_active_user_and_the_pair_has_one_conversation(): void
    {
        $dev = $this->makeUser('employee', $this->department('Dev'));
        $boss = $this->makeUser('admin');

        $id = $this->open($dev, $boss);
        $this->assertSame($id, $this->open($boss, $dev), 'both sides land in the same conversation');
        $this->assertSame($id, $this->open($dev, $boss), 'opening twice does not create a second one');
        $this->assertSame(1, DirectConversation::count());
    }

    public function test_cannot_message_yourself_an_inactive_user_or_a_missing_user(): void
    {
        $me = $this->makeUser('employee');
        $gone = $this->makeUser('employee', null, ['is_active' => false]);

        $this->actAs($me)->postJson('/api/v1/dm', ['user_id' => $me->id])->assertStatus(422);
        $this->actAs($me)->postJson('/api/v1/dm', ['user_id' => $gone->id])->assertStatus(422);
        $this->actAs($me)->postJson('/api/v1/dm', ['user_id' => 99999])->assertStatus(422);
        $this->actAs($me)->postJson('/api/v1/dm', [])->assertStatus(422);
        $this->assertSame(0, DirectConversation::count());
    }

    public function test_sending_and_reading_messages(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('manager');
        $id = $this->open($a, $b);

        $this->say($a, $id, '  hello  ')->assertCreated()->assertJsonPath('body', 'hello')->assertJsonPath('sender_id', $a->id);
        $this->say($b, $id, 'hi back')->assertCreated();

        $messages = $this->actAs($a)->getJson("/api/v1/dm/{$id}/messages")->assertOk()->json('messages');
        $this->assertSame(['hello', 'hi back'], array_column($messages, 'body'), 'oldest first');
    }

    public function test_empty_whitespace_and_oversized_messages_are_rejected(): void
    {
        $a = $this->makeUser('employee');
        $id = $this->open($a, $this->makeUser('employee'));

        $this->say($a, $id, '')->assertStatus(422);
        $this->say($a, $id, "   \n  ")->assertStatus(422);
        $this->say($a, $id, str_repeat('x', 4001))->assertStatus(422);
        $this->say($a, $id, str_repeat('x', 4000))->assertCreated();
        $this->assertSame(1, DirectMessage::count());
    }

    public function test_outsiders_and_even_the_super_admin_cannot_see_a_conversation(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $this->say($a, $id, 'private words')->assertCreated();
        $message = DirectMessage::first();

        foreach ([$this->makeUser('employee'), $this->makeUser('admin'), $this->makeUser('super_admin')] as $outsider) {
            $this->actAs($outsider)->getJson("/api/v1/dm/{$id}")->assertNotFound();
            $this->actAs($outsider)->getJson("/api/v1/dm/{$id}/messages")->assertNotFound();
            $this->actAs($outsider)->postJson("/api/v1/dm/{$id}/messages", ['body' => 'let me in'])->assertNotFound();
            $this->actAs($outsider)->postJson("/api/v1/dm/{$id}/read")->assertNotFound();
            $this->actAs($outsider)->deleteJson("/api/v1/dm/{$id}/messages/{$message->id}")->assertNotFound();
            $this->assertSame([], $this->actAs($outsider)->getJson('/api/v1/dm')->json(), 'not even listed');
        }

        $this->assertSame(1, DirectMessage::count());
    }

    public function test_direct_messages_never_leak_into_tasks_or_dashboard_numbers(): void
    {
        $a = $this->makeUser('super_admin');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $this->say($b, $id, 'secret')->assertCreated();

        $this->assertSame(0, Task::count());
        $stats = $this->actAs($a)->getJson('/api/v1/dashboard/stats')->assertOk()->json();
        $this->assertSame(0, $stats['tasks']['total']);
        $this->assertEmpty($this->actAs($a)->getJson('/api/v1/tasks')->json('data'));
    }

    public function test_unread_counts_per_conversation_and_clear_when_read(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $c = $this->makeUser('employee');
        $withB = $this->open($a, $b);
        $withC = $this->open($a, $c);

        $this->say($a, $withB, 'my own message does not count');
        $this->say($b, $withB, 'one');
        $this->say($b, $withB, 'two');
        $this->say($c, $withC, 'three');

        $summary = $this->actAs($a)->getJson('/api/v1/notifications/summary')->assertOk()->json();
        $this->assertSame(2, $summary['dm_unread'][$withB]);
        $this->assertSame(1, $summary['dm_unread'][$withC]);

        $list = collect($this->actAs($a)->getJson('/api/v1/dm')->json())->keyBy('id');
        $this->assertSame(2, $list[$withB]['unread']);
        $this->assertSame('two', $list[$withB]['last_message']['body']);

        $this->actAs($a)->postJson("/api/v1/dm/{$withB}/read")->assertOk();
        $summary = $this->actAs($a)->getJson('/api/v1/notifications/summary')->json();
        $this->assertArrayNotHasKey($withB, (array) $summary['dm_unread']);
        $this->assertSame(1, $summary['dm_unread'][$withC]);

        // The sender sees the other side's read pointer (for "Seen").
        $thread = $this->actAs($b)->getJson("/api/v1/dm/{$withB}/messages")->json();
        $this->assertSame(DirectMessage::where('conversation_id', $withB)->max('id'), $thread['other_last_read_id']);
    }

    public function test_the_read_pointer_never_moves_backwards(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $this->say($b, $id, 'one');
        $this->say($b, $id, 'two');
        $this->actAs($a)->postJson("/api/v1/dm/{$id}/read");
        $high = DirectConversation::find($id)->lastReadBy($a);

        DirectConversation::find($id)->markReadBy($a, 1);
        $this->assertSame($high, DirectConversation::find($id)->lastReadBy($a));
    }

    public function test_polling_returns_only_newer_messages_and_older_pages_load_on_demand(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        for ($i = 1; $i <= 70; $i++) {
            $this->say($i % 2 ? $a : $b, $id, "m{$i}");
        }

        $page = $this->actAs($a)->getJson("/api/v1/dm/{$id}/messages")->json();
        $this->assertCount(60, $page['messages']);
        $this->assertTrue($page['has_more']);
        $this->assertSame('m70', end($page['messages'])['body']);

        $first = $page['messages'][0]['id'];
        $older = $this->actAs($a)->getJson("/api/v1/dm/{$id}/messages?before_id={$first}")->json();
        $this->assertCount(10, $older['messages']);
        $this->assertFalse($older['has_more']);
        $this->assertSame('m1', $older['messages'][0]['body']);

        $lastId = end($page['messages'])['id'];
        $this->say($b, $id, 'fresh');
        $newer = $this->actAs($a)->getJson("/api/v1/dm/{$id}/messages?after_id={$lastId}")->json('messages');
        $this->assertSame(['fresh'], array_column($newer, 'body'));
    }

    public function test_only_the_sender_can_delete_a_message_and_the_list_preview_follows(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $first = $this->say($a, $id, 'keep')->json('id');
        $second = $this->say($b, $id, 'oops')->json('id');

        $this->actAs($a)->deleteJson("/api/v1/dm/{$id}/messages/{$second}")->assertForbidden();
        $this->actAs($b)->deleteJson("/api/v1/dm/{$id}/messages/{$second}")->assertOk();
        $this->assertDatabaseMissing('direct_messages', ['id' => $second]);
        $this->assertSame('keep', $this->actAs($a)->getJson('/api/v1/dm')->json('0.last_message.body'));

        $this->actAs($a)->deleteJson("/api/v1/dm/{$id}/messages/{$first}")->assertOk();
        $this->assertSame([], $this->actAs($a)->getJson('/api/v1/dm')->json(), 'an emptied conversation drops out of the list');
    }

    public function test_cannot_send_to_someone_who_was_deactivated(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $b->update(['is_active' => false]);

        $this->say($a, $id, 'are you there?')->assertStatus(422);
        $this->assertSame(0, DirectMessage::count());
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/v1/dm')->assertUnauthorized();
        $this->postJson('/api/v1/dm', ['user_id' => 1])->assertUnauthorized();
    }

    public function test_messages_are_removed_with_their_user(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $this->say($a, $id, 'bye')->assertCreated();

        $a->delete();

        $this->assertSame(0, DirectConversation::count());
        $this->assertSame(0, DirectMessage::count());
    }

    public function test_replying_marks_what_you_replied_to_as_read(): void
    {
        $a = $this->makeUser('employee');
        $b = $this->makeUser('employee');
        $id = $this->open($a, $b);
        $this->say($b, $id, 'question?');

        $this->assertSame(1, $this->actAs($a)->getJson('/api/v1/notifications/summary')->json("dm_unread.{$id}"));
        $this->say($a, $id, 'answer');
        $this->assertArrayNotHasKey($id, (array) $this->actAs($a)->getJson('/api/v1/notifications/summary')->json('dm_unread'));
    }
}
