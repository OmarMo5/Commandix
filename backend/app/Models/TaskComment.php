<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskComment extends Model
{
    protected $fillable = [
        'task_id', 'user_id', 'parent_id', 'content', 'is_question', 'is_answered',
    ];

    /** `reactions` stays internal; the API exposes the per-viewer `reaction_summary` instead. */
    protected $hidden = ['reactions'];

    protected $appends = ['reaction_summary'];

    protected function casts(): array
    {
        return [
            'is_question' => 'boolean',
            'is_answered' => 'boolean',
        ];
    }

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(TaskComment::class, 'parent_id');
    }

    public function replies()
    {
        return $this->hasMany(TaskComment::class, 'parent_id')
            ->with('user:id,name,avatar', 'mentionedUsers:id,name', 'reactions.user:id,name');
    }

    /** People tagged with @ in this message. */
    public function mentionedUsers()
    {
        return $this->belongsToMany(User::class, 'comment_mentions', 'comment_id', 'user_id');
    }

    public function reactions()
    {
        return $this->hasMany(CommentReaction::class, 'comment_id')->orderBy('id');
    }

    /**
     * Reactions grouped by emoji, from the signed-in viewer's point of view:
     * [{ emoji, count, reacted (did I react?), users (names, first 10) }].
     */
    public function getReactionSummaryAttribute(): array
    {
        $me = auth()->id();

        return $this->reactions
            ->groupBy('emoji')
            ->map(fn($group, $emoji) => [
                'emoji'   => $emoji,
                'count'   => $group->count(),
                'reacted' => $group->contains('user_id', $me),
                'users'   => $group->take(10)->map(fn($r) => $r->user?->name)->filter()->values()->all(),
            ])
            ->values()
            ->all();
    }
}
