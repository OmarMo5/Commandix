<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Task extends Model
{
    protected $fillable = [
        'title', 'description', 'status', 'priority',
        'creator_id', 'department_id', 'due_date', 'workflow_enabled',
        'recurrence', 'recurrence_end_date', 'recurrence_parent_id', 'last_generated_at',
        'is_private', 'closed_at', 'archived_at', 'parent_group_id',
        'due_reminder_sent_at', 'overdue_notified_at',
    ];

    protected $appends = ['is_overdue'];

    protected function casts(): array
    {
        return [
            'due_date'             => 'date',
            'workflow_enabled'     => 'boolean',
            'recurrence_end_date'  => 'date',
            'last_generated_at'    => 'date',
            'is_private'           => 'boolean',
            'closed_at'            => 'datetime',
            'archived_at'          => 'datetime',
            'due_reminder_sent_at' => 'datetime',
            'overdue_notified_at'  => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // The DB cascades the attachment rows away, but not the files behind them —
        // remove those too (a group's sub-tasks cascade at DB level, so include theirs).
        static::deleting(function (Task $task) {
            $files = $task->attachments()->get()
                ->merge(Attachment::whereIn('task_id', $task->childTasks()->select('id'))->get());

            $files->each(fn(Attachment $a) => Storage::disk($a->disk)->delete($a->file_path));
        });
    }

    /** Past its due date and not finished. Date-only comparison in the app timezone. */
    public function getIsOverdueAttribute(): bool
    {
        return $this->due_date !== null
            && $this->status !== 'completed'
            && $this->due_date->lt(today());
    }

    public function scopeOverdue($query)
    {
        return $query->whereNotNull('due_date')
            ->whereDate('due_date', '<', today())
            ->where('status', '!=', 'completed');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function assignees()
    {
        return $this->belongsToMany(User::class, 'task_assignees');
    }

    public function mentions()
    {
        return $this->belongsToMany(User::class, 'task_mentions');
    }

    public function attachments()
    {
        return $this->hasMany(Attachment::class);
    }

    public function checklistItems()
    {
        return $this->hasMany(TaskChecklistItem::class)->orderBy('position');
    }

    public function recurrenceParent()
    {
        return $this->belongsTo(Task::class, 'recurrence_parent_id');
    }

    /** The private group this task lives inside, if it's a sub-task. */
    public function parentGroup()
    {
        return $this->belongsTo(Task::class, 'parent_group_id');
    }

    /** Sub-tasks created inside this group. */
    public function childTasks()
    {
        return $this->hasMany(Task::class, 'parent_group_id');
    }

    public function comments()
    {
        return $this->hasMany(TaskComment::class)->whereNull('parent_id')->with('user:id,name,avatar', 'replies.user:id,name,avatar')->latest();
    }

    public function workflowSteps()
    {
        return $this->hasMany(TaskWorkflowStep::class)->orderBy('step_order');
    }

    /** The currently active workflow step (if any) */
    public function activeStep()
    {
        return $this->hasOne(TaskWorkflowStep::class)->where('status', 'active');
    }
}
