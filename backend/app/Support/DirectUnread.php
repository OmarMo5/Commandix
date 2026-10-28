<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/** Unread direct messages per conversation for one user: [conversationId => count]. */
class DirectUnread
{
    /** @return array<int,int> */
    public static function for(User $user): array
    {
        return DB::table('direct_messages as m')
            ->join('direct_conversations as c', 'c.id', '=', 'm.conversation_id')
            ->where(fn($q) => $q->where('c.user_one_id', $user->id)->orWhere('c.user_two_id', $user->id))
            ->where('m.sender_id', '!=', $user->id)
            ->whereRaw('m.id > (CASE WHEN c.user_one_id = ? THEN c.user_one_last_read_id ELSE c.user_two_last_read_id END)', [$user->id])
            ->groupBy('m.conversation_id')
            ->selectRaw('m.conversation_id as id, COUNT(*) as unread')
            ->pluck('unread', 'id')
            ->map(fn($n) => (int) $n)
            ->all();
    }
}
