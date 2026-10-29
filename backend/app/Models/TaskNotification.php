<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class TaskNotification extends Model
{
    protected $table = 'notifications';

    protected $fillable = ['user_id', 'type', 'data', 'read_at', 'cleared_at', 'later_at', 'snoozed_until'];

    /** Informational events that need no action from you — they live in the "Other" tab. */
    public const OTHER_TYPES = ['task_completed', 'workflow_progress', 'workflow_finished', 'group_member_left', 'comment_reaction'];

    /** Filter chips in the inbox: group name => notification types. */
    public const GROUPS = [
        'assigned'  => ['task_assigned'],
        'mentions'  => ['task_mentioned', 'comment_mention'],
        'comments'  => ['task_comment', 'task_question', 'comment_reaction'],
        'reminders' => ['task_due_soon', 'task_overdue'],
        'workflow'  => ['workflow_turn', 'workflow_progress', 'workflow_finished'],
        'messages'  => ['manager_message'],
    ];

    protected function casts(): array
    {
        return [
            'data'          => 'array',
            'read_at'       => 'datetime',
            'cleared_at'    => 'datetime',
            'later_at'      => 'datetime',
            'snoozed_until' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function markAsRead(): void
    {
        $this->update(['read_at' => now()]);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    /** In the inbox right now: not cleared, and not parked in Later (a snooze that has run out is back). */
    public function scopeInbox(Builder $query): Builder
    {
        return $query->whereNull('cleared_at')
            ->where(fn($q) => $q->whereNull('later_at')->orWhere('snoozed_until', '<=', now()));
    }

    /** Parked in Later — indefinitely, or until a time that hasn't come yet. */
    public function scopeLater(Builder $query): Builder
    {
        return $query->whereNull('cleared_at')
            ->whereNotNull('later_at')
            ->where(fn($q) => $q->whereNull('snoozed_until')->orWhere('snoozed_until', '>', now()));
    }

    public function scopeCleared(Builder $query): Builder
    {
        return $query->whereNotNull('cleared_at');
    }

    public function scopeOther(Builder $query): Builder
    {
        return $query->whereIn('type', self::OTHER_TYPES);
    }

    public function scopePrimary(Builder $query): Builder
    {
        return $query->whereNotIn('type', self::OTHER_TYPES);
    }
}
