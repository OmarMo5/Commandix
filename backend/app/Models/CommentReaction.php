<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommentReaction extends Model
{
    /** The only emoji people can react with — a small, work-appropriate set. */
    public const ALLOWED = ['👍', '❤️', '🎉', '😂', '👀', '✅'];

    protected $fillable = ['comment_id', 'user_id', 'emoji'];

    public function comment()
    {
        return $this->belongsTo(TaskComment::class, 'comment_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
