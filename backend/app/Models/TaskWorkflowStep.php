<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TaskWorkflowStep extends Model
{
    protected $fillable = [
        'task_id', 'user_id', 'step_order', 'status', 'notes', 'started_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at'   => 'datetime',
            'completed_at' => 'datetime',
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

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }
}
