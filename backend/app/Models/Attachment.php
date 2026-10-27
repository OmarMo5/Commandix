<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attachment extends Model
{
    protected $fillable = ['task_id', 'user_id', 'file_name', 'file_path', 'disk', 'file_type', 'file_size'];

    // No public `url` any more: files are fetched through GET /attachments/{id}/download,
    // which checks the caller's access to the task first.

    public function task()
    {
        return $this->belongsTo(Task::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
