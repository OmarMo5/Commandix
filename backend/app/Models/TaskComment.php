<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskComment extends Model
{
    protected $fillable = [
        'task_id', 'user_id', 'parent_id', 'content', 'is_question', 'is_answered',
    ];

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
        return $this->hasMany(TaskComment::class, 'parent_id')->with('user:id,name,avatar');
    }
}
