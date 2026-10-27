<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskRead extends Model
{
    protected $fillable = ['user_id', 'task_id', 'last_read_comment_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
