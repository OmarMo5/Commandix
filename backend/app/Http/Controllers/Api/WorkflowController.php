<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\TaskNotification;
use App\Models\TaskWorkflowStep;
use Illuminate\Http\Request;

class WorkflowController extends Controller
{
    /**
     * GET /tasks/{taskId}/workflow
     * Returns all workflow steps with user info for a task.
     */
    public function show(string $taskId)
    {
        $task = Task::with(['workflowSteps.user:id,name,avatar'])->findOrFail($taskId);

        $this->authorizeView($task);

        return response()->json([
            'workflow_enabled' => $task->workflow_enabled,
            'steps'            => $task->workflowSteps,
        ]);
    }

    /**
     * POST /tasks/{taskId}/workflow
     * Create or replace workflow steps for a task.
     * Body: { steps: [ { user_id: X }, { user_id: Y }, ... ] }
     */
    public function store(Request $request, string $taskId)
    {
        $task = Task::findOrFail($taskId);

        $request->validate([
            'steps'           => 'required|array|min:2',
            'steps.*.user_id' => 'required|exists:users,id',
        ]);

        // Delete old steps
        $task->workflowSteps()->delete();

        // Create new steps — first one is active, rest waiting
        foreach ($request->steps as $index => $step) {
            TaskWorkflowStep::create([
                'task_id'    => $task->id,
                'user_id'    => $step['user_id'],
                'step_order' => $index + 1,
                'status'     => $index === 0 ? 'active' : 'waiting',
                'started_at' => $index === 0 ? now() : null,
            ]);
        }

        // Enable workflow flag on task
        $task->update([
            'workflow_enabled' => true,
            'status'           => 'in_progress',
        ]);

        // Notify the first person that they are up
        $firstStep = $task->workflowSteps()->first();
        if ($firstStep) {
            $this->notify($firstStep->user_id, 'workflow_turn', [
                'task_id'    => $task->id,
                'task_title' => $task->title,
                'step'       => $firstStep->step_order,
                'message'    => 'It\'s your turn to work on this task.',
                'from'       => auth()->user()->name,
            ]);
        }

        ActivityLog::record('workflow_created', $task, [], ['steps' => count($request->steps)]);

        return response()->json($task->load('workflowSteps.user:id,name,avatar'));
    }

    /**
     * PUT /tasks/{taskId}/workflow/complete-step
     * Current user marks their active step as done.
     * Body: { notes?: "..." }
     */
    public function completeStep(Request $request, string $taskId)
    {
        $task = Task::with('workflowSteps.user')->findOrFail($taskId);
        $user = $request->user();

        /** @var TaskWorkflowStep|null $currentStep */
        $currentStep = $task->workflowSteps
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->first();

        if (!$currentStep) {
            return response()->json(['message' => 'You have no active step on this task.'], 403);
        }

        $request->validate(['notes' => 'nullable|string|max:1000']);

        // Mark current step completed
        $currentStep->update([
            'status'       => 'completed',
            'notes'        => $request->notes,
            'completed_at' => now(),
        ]);

        ActivityLog::record('workflow_step_completed', $task, [], [
            'step'    => $currentStep->step_order,
            'user'    => $user->name,
        ]);

        // Find next step
        $nextStep = $task->workflowSteps()
            ->where('step_order', '>', $currentStep->step_order)
            ->where('status', 'waiting')
            ->orderBy('step_order')
            ->first();

        if ($nextStep) {
            // Activate next step
            $nextStep->update([
                'status'     => 'active',
                'started_at' => now(),
            ]);

            // Notify next person
            $this->notify($nextStep->user_id, 'workflow_turn', [
                'task_id'    => $task->id,
                'task_title' => $task->title,
                'step'       => $nextStep->step_order,
                'message'    => 'It\'s your turn to work on this task.',
                'from'       => $user->name,
                'prev_notes' => $request->notes,
            ]);

            // Also notify task creator that progress was made
            if ($task->creator_id !== $user->id) {
                $this->notify($task->creator_id, 'workflow_progress', [
                    'task_id'       => $task->id,
                    'task_title'    => $task->title,
                    'completed_by'  => $user->name,
                    'step'          => $currentStep->step_order,
                    'next_assignee' => $nextStep->user->name ?? 'Next person',
                ]);
            }
        } else {
            // All steps done — complete the task
            $task->update(['status' => 'completed']);

            // Notify task creator
            $this->notify($task->creator_id, 'workflow_finished', [
                'task_id'      => $task->id,
                'task_title'   => $task->title,
                'completed_by' => $user->name,
                'message'      => 'All workflow steps have been completed. Task is done!',
            ]);

            ActivityLog::record('workflow_completed', $task);
        }

        return response()->json([
            'message' => $nextStep ? 'Step completed. Next person notified.' : 'All steps done! Task completed.',
            'task_completed' => !$nextStep,
            'steps' => $task->fresh()->workflowSteps()->with('user:id,name,avatar')->get(),
        ]);
    }

    /**
     * DELETE /tasks/{taskId}/workflow
     * Remove workflow from a task (admin/manager/creator only).
     */
    public function destroy(string $taskId)
    {
        $task = Task::findOrFail($taskId);
        $user = auth()->user();

        if (!$user->isAdmin() && !$user->isManager() && $task->creator_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $task->workflowSteps()->delete();
        $task->update(['workflow_enabled' => false]);

        return response()->json(['message' => 'Workflow removed.']);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function authorizeView(Task $task): void
    {
        $user = auth()->user();
        if ($user->isAdmin() || $user->isManager()) return;

        $isAssigned = $task->assignees()->where('users.id', $user->id)->exists()
            || $task->workflowSteps()->where('user_id', $user->id)->exists()
            || $task->creator_id === $user->id;

        if (!$isAssigned) {
            abort(403, 'Unauthorized.');
        }
    }

    private function notify(int $userId, string $type, array $data): void
    {
        TaskNotification::create([
            'user_id' => $userId,
            'type'    => $type,
            'data'    => $data,
        ]);
    }
}
