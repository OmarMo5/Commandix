<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Task extends Model
{
    protected $fillable = [
        'title', 'description', 'status', 'priority',
        'creator_id', 'department_id', 'due_date', 'workflow_enabled',
        'recurrence', 'recurrence_end_date', 'recurrence_parent_id', 'last_generated_at',
        'is_private', 'closed_at', 'parent_group_id',
    ];

    protected function casts(): array
    {
        return [
            'due_date'             => 'date',
            'workflow_enabled'     => 'boolean',
            'recurrence_end_date'  => 'date',
            'last_generated_at'    => 'date',
            'is_private'           => 'boolean',
            'closed_at'            => 'datetime',
        ];
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
