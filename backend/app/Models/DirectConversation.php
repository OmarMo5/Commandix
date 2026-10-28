<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class DirectConversation extends Model
{
    protected $fillable = [
        'user_one_id', 'user_two_id', 'user_one_last_read_id', 'user_two_last_read_id', 'last_message_at',
    ];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function userOne()
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    public function userTwo()
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    public function messages()
    {
        return $this->hasMany(DirectMessage::class, 'conversation_id');
    }

    /** Conversations a user takes part in. */
    public function scopeInvolving(Builder $query, User $user): Builder
    {
        return $query->where(fn($q) => $q->where('user_one_id', $user->id)->orWhere('user_two_id', $user->id));
    }

    /** The one conversation between two users, created on first use. */
    public static function between(User $a, User $b): self
    {
        [$one, $two] = $a->id < $b->id ? [$a->id, $b->id] : [$b->id, $a->id];

        return static::firstOrCreate(['user_one_id' => $one, 'user_two_id' => $two]);
    }

    public function includes(User $user): bool
    {
        return $this->user_one_id === $user->id || $this->user_two_id === $user->id;
    }

    public function otherUserId(User $me): int
    {
        return $this->user_one_id === $me->id ? $this->user_two_id : $this->user_one_id;
    }

    public function lastReadBy(User $user): int
    {
        return (int) ($this->user_one_id === $user->id ? $this->user_one_last_read_id : $this->user_two_last_read_id);
    }

    /** Moves the user's read pointer forward (never back). */
    public function markReadBy(User $user, int $messageId): void
    {
        if ($messageId <= $this->lastReadBy($user)) {
            return;
        }

        $column = $this->user_one_id === $user->id ? 'user_one_last_read_id' : 'user_two_last_read_id';
        $this->forceFill([$column => $messageId])->save();
    }
}
