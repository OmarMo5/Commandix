<?php

namespace App\Console\Commands;

use App\Models\Task;
use App\Models\TaskNotification;
use Illuminate\Console\Command;

class NotifyDueTasks extends Command
{
    protected $signature = 'tasks:notify-due';

    protected $description = 'Notify people about tasks due today/tomorrow and tasks that just went overdue (once each)';

    public function handle(): int
    {
        $today = today();
        $tomorrow = today()->addDay();

        $soon = 0;
        Task::with('assignees:id')
            ->where('status', '!=', 'completed')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '>=', $today)
            ->whereDate('due_date', '<=', $tomorrow)
            ->whereNull('due_reminder_sent_at')
            ->each(function (Task $task) use ($today, &$soon) {
                foreach ($task->assignees as $user) {
                    TaskNotification::create([
                        'user_id' => $user->id,
                        'type'    => 'task_due_soon',
                        'data'    => [
                            'task_id'    => $task->id,
                            'task_title' => $task->title,
                            'due_date'   => $task->due_date->toDateString(),
                            'when'       => $task->due_date->isSameDay($today) ? 'today' : 'tomorrow',
                        ],
                    ]);
                }
                $task->forceFill(['due_reminder_sent_at' => now()])->saveQuietly();
                $soon++;
            });

        $overdue = 0;
        Task::with('assignees:id')
            ->where('status', '!=', 'completed')
            ->whereNotNull('due_date')
            ->whereDate('due_date', '<', $today)
            ->whereNull('overdue_notified_at')
            ->each(function (Task $task) use ($today, &$overdue) {
                $recipients = $task->assignees->pluck('id')->push($task->creator_id)->unique();

                foreach ($recipients as $userId) {
                    TaskNotification::create([
                        'user_id' => $userId,
                        'type'    => 'task_overdue',
                        'data'    => [
                            'task_id'      => $task->id,
                            'task_title'   => $task->title,
                            'due_date'     => $task->due_date->toDateString(),
                            'days_overdue' => (int) $task->due_date->diffInDays($today),
                        ],
                    ]);
                }
                $task->forceFill(['overdue_notified_at' => now()])->saveQuietly();
                $overdue++;
            });

        $this->info("Due-soon reminders: {$soon} task(s). Overdue alerts: {$overdue} task(s).");

        return self::SUCCESS;
    }
}
