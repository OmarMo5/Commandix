<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\TaskChecklistItem;
use Illuminate\Http\Request;

class TaskChecklistController extends Controller
{
    /**
     * GET /tasks/{taskId}/checklist
     */
    public function index(string $taskId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);

        if (!$this->canViewTask($task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return response()->json($task->checklistItems()->with('creator:id,name')->get());
    }

    /**
     * POST /tasks/{taskId}/checklist
     * Body: { title }
     */
    public function store(Request $request, string $taskId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);

        if (!$this->canEditTask($task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate(['title' => 'required|string|max:255']);

        $nextPosition = $task->checklistItems()->max('position') + 1;

        $item = TaskChecklistItem::create([
            'task_id'    => $task->id,
            'title'      => $request->title,
            'position'   => $nextPosition,
            'created_by' => auth()->id(),
        ]);

        return response()->json($item->load('creator:id,name'), 201);
    }

    /**
     * PUT /tasks/{taskId}/checklist/{itemId}
     * Body: { title?, is_done? } — toggling is_done is also allowed for any assignee;
     * editing the title requires the same edit rights as the task itself.
     */
    public function update(Request $request, string $taskId, string $itemId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);
        $item = TaskChecklistItem::where('task_id', $taskId)->findOrFail($itemId);
        $user = auth()->user();

        $isAssignee = $task->assignees->contains('id', $user->id);

        if ($request->has('title') && !$this->canEditTask($task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($request->has('is_done') && !$this->canEditTask($task) && !$isAssignee) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'title'   => 'sometimes|string|max:255',
            'is_done' => 'sometimes|boolean',
        ]);

        $item->update($request->only(['title', 'is_done']));

        return response()->json($item->load('creator:id,name'));
    }

    /**
     * DELETE /tasks/{taskId}/checklist/{itemId}
     */
    public function destroy(string $taskId, string $itemId)
    {
        $task = Task::with(['assignees', 'mentions'])->findOrFail($taskId);
        $item = TaskChecklistItem::where('task_id', $taskId)->findOrFail($itemId);

        if (!$this->canEditTask($task)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $item->delete();

        return response()->json(['message' => 'Checklist item deleted.']);
    }

    private function canViewTask(Task $task): bool
    {
        $user = auth()->user();

        return $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || $task->assignees->contains('id', $user->id)
            || $task->mentions->contains('id', $user->id)
            || ($user->isManager() && $user->department_id && $task->department_id === $user->department_id);
    }

    private function canEditTask(Task $task): bool
    {
        $user = auth()->user();

        return $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || ($user->isManager() && $user->department_id && $task->department_id === $user->department_id);
    }
}
