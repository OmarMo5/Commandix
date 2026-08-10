<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\TaskNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateRecurringTasks extends Command
{
    protected $signature = 'tasks:generate-recurring';

    protected $description = 'Generate the next occurrence of each recurring task template that is due';

    public function handle(): int
    {
        $templates = Task::whereNotNull('recurrence')
            ->whereNull('recurrence_parent_id')
            ->where(function ($q) {
                $q->whereNull('recurrence_end_date')->orWhere('recurrence_end_date', '>=', now()->toDateString());
            })
            ->get();

        $created = 0;

        foreach ($templates as $template) {
            if (!$this->isDue($template)) {
                continue;
            }

            $instance = Task::create([
                'title'            => $template->title,
                'description'      => $template->description,
                'status'           => 'pending',
                'priority'         => $template->priority,
                'creator_id'       => $template->creator_id,
                'department_id'    => $template->department_id,
                'due_date'         => now()->toDateString(),
                'workflow_enabled' => false,
                'recurrence_parent_id' => $template->id,
            ]);

            $assigneeIds = $template->assignees()->pluck('users.id');
            if ($assigneeIds->isNotEmpty()) {
                $instance->assignees()->sync($assigneeIds);
                foreach ($assigneeIds as $userId) {
                    TaskNotification::create([
                        'user_id' => $userId,
                        'type' => 'task_assigned',
                        'data' => [
                            'task_id' => $instance->id,
                            'task_title' => $instance->title,
                            'assigned_by' => 'Recurring schedule',
                        ],
                    ]);
                }
            }

            ActivityLog::record('task_created', $instance, [], $instance->toArray(), $template->creator_id);

            $template->update(['last_generated_at' => now()->toDateString()]);
            $created++;
        }

        $this->info("Generated {$created} recurring task instance(s).");

        return self::SUCCESS;
    }

    private function isDue(Task $template): bool
    {
        if (!$template->last_generated_at) {
            return true;
        }

        $last = Carbon::parse($template->last_generated_at);

        return match ($template->recurrence) {
            'daily'   => $last->lt(now()->startOfDay()),
            'weekly'  => $last->lte(now()->subWeek()),
            'monthly' => $last->lte(now()->subMonth()),
            default   => false,
        };
    }
}
