<?php

namespace App\Support;

use App\Models\Task;
use App\Models\User;

/**
 * Single source of truth for "can this user see/touch this task" — used by every
 * controller that checks task access (TaskController, TaskCommentController,
 * TaskChecklistController, AttachmentController) so a private-task rule only
 * ever has to be written once.
 */
class TaskAccess
{
    public static function canView(User $user, Task $task): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        // A sub-task inside a group is channel-visible: being a member of the
        // parent group is what grants visibility, not membership on the
        // sub-task itself (its own assignees are always a subset of the group
        // anyway, so this is strictly broader, never narrower).
        if ($task->parent_group_id) {
            return self::canView($user, $task->parentGroup);
        }

        if ($task->is_private) {
            return $task->creator_id === $user->id
                || $task->assignees->contains('id', $user->id);
        }

        return $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || $task->assignees->contains('id', $user->id)
            || $task->mentions->contains('id', $user->id)
            || ($user->isManager() && $user->department_id && $task->department_id === $user->department_id);
    }

    public static function canEdit(User $user, Task $task): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($task->parent_group_id) {
            return $task->creator_id === $user->id
                || $task->parentGroup->creator_id === $user->id;
        }

        if ($task->is_private) {
            return $task->creator_id === $user->id;
        }

        return $user->isAdminOrAbove()
            || $task->creator_id === $user->id
            || ($user->isManager() && $user->department_id && $task->department_id === $user->department_id);
    }

    /**
     * Private-task membership management only (add/remove assignee). Normal tasks
     * keep their existing department-scoped assignee logic in TaskController —
     * this is not a drop-in replacement for that, only used on the is_private branch.
     */
    public static function canManageMembers(User $user, Task $task): bool
    {
        if ($task->parent_group_id) {
            return $user->isSuperAdmin()
                || $task->creator_id === $user->id
                || $task->parentGroup->creator_id === $user->id;
        }

        return $user->isSuperAdmin() || $task->creator_id === $user->id;
    }

    public static function isLocked(Task $task): bool
    {
        if ($task->closed_at !== null) {
            return true;
        }

        return $task->parent_group_id !== null && $task->parentGroup->closed_at !== null;
    }
}
