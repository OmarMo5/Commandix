<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DirectConversation;
use App\Models\DirectMessage;
use App\Models\User;
use App\Support\DirectUnread;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * 1-to-1 direct messages. Private to the two people in a conversation — there is no admin
 * override on purpose (not even the Super Admin can open someone else's conversation), and
 * a non-participant gets a 404 so the existence of a conversation never leaks.
 */
class DirectMessageController extends Controller
{
    private const PAGE = 60;

    /** GET /dm — my conversations that have at least one message, newest first. */
    public function index(Request $request)
    {
        $me = $request->user();
        $unread = DirectUnread::for($me);

        $conversations = DirectConversation::involving($me)
            ->whereNotNull('last_message_at')
            ->orderByDesc('last_message_at')
            ->limit(100)
            ->get();

        return response()->json($this->present($conversations, $me, $unread));
    }

    /** POST /dm { user_id } — open (or create) my conversation with someone. */
    public function start(Request $request)
    {
        $me = $request->user();
        $data = $request->validate(['user_id' => 'required|integer|exists:users,id']);

        if ((int) $data['user_id'] === $me->id) {
            return response()->json(['message' => 'You cannot message yourself.'], 422);
        }

        $other = User::findOrFail($data['user_id']);
        if (!$other->is_active) {
            return response()->json(['message' => 'This user is inactive.'], 422);
        }

        $conversation = DirectConversation::between($me, $other);

        return response()->json($this->present(collect([$conversation]), $me, DirectUnread::for($me))[0]);
    }

    /** GET /dm/{id} */
    public function show(Request $request, string $id)
    {
        $me = $request->user();
        $conversation = $this->mine($me, $id);

        return response()->json($this->present(collect([$conversation]), $me, DirectUnread::for($me))[0]);
    }

    /**
     * GET /dm/{id}/messages
     *   (none)       → the latest page
     *   before_id=N  → the page of older messages before N ("load earlier")
     *   after_id=N   → everything newer than N (what the open thread polls for)
     */
    public function messages(Request $request, string $id)
    {
        $me = $request->user();
        $conversation = $this->mine($me, $id);

        $query = $conversation->messages();
        $hasMore = false;

        if ($request->filled('after_id')) {
            $messages = $query->where('id', '>', (int) $request->query('after_id'))->orderBy('id')->limit(200)->get();
        } else {
            if ($request->filled('before_id')) {
                $query->where('id', '<', (int) $request->query('before_id'));
            }
            $page = $query->orderByDesc('id')->limit(self::PAGE + 1)->get();
            $hasMore = $page->count() > self::PAGE;
            $messages = $page->take(self::PAGE)->reverse()->values();
        }

        $otherId = $conversation->otherUserId($me);
        $otherRead = $conversation->user_one_id === $otherId
            ? (int) $conversation->user_one_last_read_id
            : (int) $conversation->user_two_last_read_id;

        return response()->json([
            'messages'           => $messages->map(fn($m) => $this->message($m))->values(),
            'has_more'           => $hasMore,
            'other_last_read_id' => $otherRead,
        ]);
    }

    /** POST /dm/{id}/messages { body } */
    public function send(Request $request, string $id)
    {
        $me = $request->user();
        $conversation = $this->mine($me, $id);

        $data = $request->validate(['body' => 'required|string|max:4000']);
        $body = trim($data['body']);
        if ($body === '') {
            return response()->json(['message' => 'The message cannot be empty.'], 422);
        }

        if (!$me->is_active || !User::where('id', $conversation->otherUserId($me))->where('is_active', true)->exists()) {
            return response()->json(['message' => 'This user is inactive.'], 422);
        }

        $message = $conversation->messages()->create(['sender_id' => $me->id, 'body' => $body]);
        $conversation->forceFill(['last_message_at' => $message->created_at])->save();
        $conversation->markReadBy($me, $message->id);   // my own message is never "unread" for me

        return response()->json($this->message($message), 201);
    }

    /** POST /dm/{id}/read — I have seen everything in this conversation. */
    public function markRead(Request $request, string $id)
    {
        $me = $request->user();
        $conversation = $this->mine($me, $id);

        $conversation->markReadBy($me, (int) $conversation->messages()->max('id'));

        return response()->json(['message' => 'Marked as read.']);
    }

    /** DELETE /dm/{id}/messages/{messageId} — you can only remove your own messages. */
    public function destroy(Request $request, string $id, string $messageId)
    {
        $me = $request->user();
        $conversation = $this->mine($me, $id);

        $message = $conversation->messages()->findOrFail($messageId);
        if ($message->sender_id !== $me->id) {
            return response()->json(['message' => 'You can only delete your own messages.'], 403);
        }

        $message->delete();
        $last = $conversation->messages()->latest('id')->first();
        $conversation->forceFill(['last_message_at' => $last?->created_at])->save();

        return response()->json(['message' => 'Message deleted.']);
    }

    // ---------------------------------------------------------------------------------------

    /** A conversation I'm part of, or 404. */
    private function mine(User $me, string $id): DirectConversation
    {
        $conversation = DirectConversation::findOrFail($id);
        abort_unless($conversation->includes($me), 404);

        return $conversation;
    }

    private function message(DirectMessage $m): array
    {
        return [
            'id'              => $m->id,
            'conversation_id' => $m->conversation_id,
            'sender_id'       => $m->sender_id,
            'body'            => $m->body,
            'created_at'      => $m->created_at,
        ];
    }

    /** @param \Illuminate\Support\Collection<int,DirectConversation> $conversations */
    private function present($conversations, User $me, array $unread): array
    {
        $others = User::whereIn('id', $conversations->map(fn($c) => $c->otherUserId($me)))
            ->with('department:id,name')
            ->get(['id', 'name', 'avatar', 'department_id', 'is_active'])
            ->keyBy('id');

        $lastIds = DirectMessage::whereIn('conversation_id', $conversations->pluck('id'))
            ->selectRaw('MAX(id) as id')->groupBy('conversation_id')->pluck('id');
        $lastByConversation = DirectMessage::whereIn('id', $lastIds)->get()->keyBy('conversation_id');

        return $conversations->map(function (DirectConversation $c) use ($me, $others, $lastByConversation, $unread) {
            $other = $others[$c->otherUserId($me)] ?? null;
            $last = $lastByConversation[$c->id] ?? null;

            return [
                'id'              => $c->id,
                'user'            => $other ? [
                    'id'         => $other->id,
                    'name'       => $other->name,
                    'avatar'     => $other->avatar,
                    'is_active'  => (bool) $other->is_active,
                    'department' => $other->department ? ['id' => $other->department->id, 'name' => $other->department->name] : null,
                ] : null,
                'last_message'    => $last ? [
                    'id'         => $last->id,
                    'sender_id'  => $last->sender_id,
                    'body'       => Str::limit($last->body, 120),
                    'created_at' => $last->created_at,
                ] : null,
                'last_message_at' => $c->last_message_at,
                'unread'          => $unread[$c->id] ?? 0,
            ];
        })->values()->all();
    }
}
