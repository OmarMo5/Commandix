<?php

namespace App\Support;

use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Unread chat messages for the groups a user belongs to — one number per group
 * (its own chat plus every task inside it) and one per task for the badges on rows.
 *
 * "Belongs to" means creator or assignee; the Super Admin only counts for groups
 * they are actually a member of, so supervising everything doesn't bury them.
 */
class GroupUnread
{
    /** @return array{groups: array<int,int>, tasks: array<int,int>} */
    public static function for(User $user): array
    {
        $groups = Task::query()
            ->where('is_private', true)
            ->whereNull('parent_group_id')
            ->whereNull('archived_at')
            ->where(function ($q) use ($user) {
                $q->where('creator_id', $user->id)
                  ->orWhereHas('assignees', fn($a) => $a->where('users.id', $user->id));
            })
            ->pluck('id');

        if ($groups->isEmpty()) {
            return ['groups' => [], 'tasks' => []];
        }

        // task id => the group it belongs to (a group maps to itself)
        $groupOf = Task::whereIn('parent_group_id', $groups)->pluck('parent_group_id', 'id')
            ->union($groups->mapWithKeys(fn($id) => [$id => $id])->all());

        $perTask = DB::table('task_comments as c')
            ->leftJoin('task_reads as r', function ($join) use ($user) {
                $join->on('r.task_id', '=', 'c.task_id')->where('r.user_id', '=', $user->id);
            })
            ->whereIn('c.task_id', $groupOf->keys())
            ->where('c.user_id', '!=', $user->id)
            ->whereRaw('c.id > COALESCE(r.last_read_comment_id, 0)')
            ->groupBy('c.task_id')
            ->selectRaw('c.task_id, COUNT(*) as unread')
            ->pluck('unread', 'task_id');

        $perGroup = [];
        foreach ($perTask as $taskId => $count) {
            $groupId = $groupOf[$taskId];
            $perGroup[$groupId] = ($perGroup[$groupId] ?? 0) + (int) $count;
        }

        return [
            'groups' => $perGroup,
            'tasks'  => $perTask->map(fn($n) => (int) $n)->all(),
        ];
    }
}
