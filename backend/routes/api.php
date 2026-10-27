<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SavedViewController;
use App\Http\Controllers\Api\TaskReadController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\TaskChecklistController;
use App\Http\Controllers\Api\TaskCommentController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkflowController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ── Public ────────────────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    });
    Route::get('settings', [SettingsController::class, 'show']);

    // ── Protected ─────────────────────────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me',      [AuthController::class, 'me']);
            Route::put('profile', [AuthController::class, 'updateProfile']);
            Route::put('password', [AuthController::class, 'changePassword'])->middleware('throttle:6,1');
        });

        // Dashboard
        Route::get('dashboard/stats', [DashboardController::class, 'stats']);

        // Users — permission-gated per action
        Route::get('users',        [UserController::class, 'index'])->middleware('permission:users.view');
        Route::get('users/directory', [UserController::class, 'directory']);
        Route::get('users/{id}',   [UserController::class, 'show'])->middleware('permission:users.view');
        Route::post('users',       [UserController::class, 'store'])->middleware('permission:users.create');
        Route::put('users/{id}',   [UserController::class, 'update'])->middleware('permission:users.edit');
        Route::delete('users/{id}',[UserController::class, 'destroy'])->middleware('permission:users.delete');
        Route::put('users/{id}/password', [UserController::class, 'updatePassword'])->middleware('permission:users.edit');
        Route::post('users/avatar',       [UserController::class, 'updateAvatar']);

        // Roles — listing open to any authenticated user (used for dropdowns),
        // everything else (create/edit/delete + permissions catalog) is Super Admin only.
        Route::get('roles', [RoleController::class, 'index']);
        Route::middleware('superadmin')->group(function () {
            Route::get('roles/{id}',    [RoleController::class, 'show']);
            Route::post('roles',        [RoleController::class, 'store']);
            Route::put('roles/{id}',    [RoleController::class, 'update']);
            Route::delete('roles/{id}', [RoleController::class, 'destroy']);
            Route::get('permissions',   [RoleController::class, 'permissions']);
        });

        // Departments — permission-gated per action
        Route::get('departments/managers-list',    [DepartmentController::class, 'managersList']);
        Route::post('departments/message-manager', [DepartmentController::class, 'messageManager']);
        Route::get('departments',        [DepartmentController::class, 'index'])->middleware('permission:departments.view');
        Route::get('departments/{id}',   [DepartmentController::class, 'show'])->middleware('permission:departments.view');
        Route::post('departments',       [DepartmentController::class, 'store'])->middleware('permission:departments.create');
        Route::put('departments/{id}',   [DepartmentController::class, 'update'])->middleware('permission:departments.edit');
        Route::delete('departments/{id}',[DepartmentController::class, 'destroy'])->middleware('permission:departments.delete');

        // Saved filter presets — personal, no permission gate
        Route::get('saved-views',         [SavedViewController::class, 'index']);
        Route::post('saved-views',        [SavedViewController::class, 'store']);
        Route::delete('saved-views/{id}', [SavedViewController::class, 'destroy']);

        // Tasks — permission-gated per action
        Route::get('tasks',        [TaskController::class, 'index'])->middleware('permission:tasks.view');
        Route::post('tasks/groups',[TaskController::class, 'storeGroup']);
        Route::get('tasks/{id}',   [TaskController::class, 'show'])->middleware('permission:tasks.view');
        Route::post('tasks',       [TaskController::class, 'store'])->middleware('permission:tasks.create');
        // These no longer carry a permission:tasks.* gate — TaskController already
        // enforces the correct rule per action via TaskAccess (and canManageAssignee
        // for normal tasks), which additionally has to allow a private group's
        // creator (who may be a plain Employee with none of the tasks.* permissions)
        // to manage their own group. For normal tasks this is not a loosening: an
        // Employee can never be a normal task's creator (tasks.create is still
        // gated), so every one of these checks still resolves to admin/manager-only.
        Route::put('tasks/{id}',   [TaskController::class, 'update']);
        Route::delete('tasks/{id}',[TaskController::class, 'destroy']);
        Route::put('tasks/{id}/status', [TaskController::class, 'updateStatus']);
        Route::post('tasks/{id}/assignees', [TaskController::class, 'addAssignee']);
        Route::delete('tasks/{id}/assignees/{userId}', [TaskController::class, 'removeAssignee']);
        Route::post('tasks/{id}/mentions', [TaskController::class, 'addMention']);
        Route::delete('tasks/{id}/mentions/{userId}', [TaskController::class, 'removeMention']);
        Route::post('tasks/{id}/close',  [TaskController::class, 'close'])->middleware('superadmin');
        Route::post('tasks/{id}/reopen', [TaskController::class, 'reopen'])->middleware('superadmin');

        Route::post('tasks/{id}/read',   [TaskReadController::class, 'markRead']);
        Route::get('tasks/{id}/readers', [TaskReadController::class, 'readers']);
        Route::post('tasks/{id}/archive',   [TaskController::class, 'archive']);
        Route::post('tasks/{id}/unarchive', [TaskController::class, 'unarchive']);
        Route::post('tasks/{id}/leave',     [TaskController::class, 'leave']);

        // Tasks-inside-a-group — permission-free like tasks/groups, controller
        // enforces membership via TaskAccess (any group member, per plan).
        Route::get('tasks/{id}/subtasks',  [TaskController::class, 'subtasks']);
        Route::post('tasks/{id}/subtasks', [TaskController::class, 'storeSubtask']);

        // Task Checklist / Subtasks
        Route::get('tasks/{taskId}/checklist',                [TaskChecklistController::class, 'index']);
        Route::post('tasks/{taskId}/checklist',                [TaskChecklistController::class, 'store']);
        Route::put('tasks/{taskId}/checklist/{itemId}',        [TaskChecklistController::class, 'update']);
        Route::delete('tasks/{taskId}/checklist/{itemId}',     [TaskChecklistController::class, 'destroy']);

        // Task Comments / Q&A
        Route::get('tasks/{taskId}/comments',                         [TaskCommentController::class, 'index']);
        Route::post('tasks/{taskId}/comments',                        [TaskCommentController::class, 'store']);
        Route::put('tasks/{taskId}/comments/{commentId}/resolve',     [TaskCommentController::class, 'resolve']);
        Route::delete('tasks/{taskId}/comments/{commentId}',          [TaskCommentController::class, 'destroy']);

        // Attachments
        Route::post('tasks/{taskId}/attachments', [AttachmentController::class, 'store']);
        Route::get('attachments/{id}/download',   [AttachmentController::class, 'download']);
        Route::delete('attachments/{id}',         [AttachmentController::class, 'destroy']);

        // Workflow
        Route::get('tasks/{taskId}/workflow',               [WorkflowController::class, 'show']);
        Route::post('tasks/{taskId}/workflow',              [WorkflowController::class, 'store']);
        Route::put('tasks/{taskId}/workflow/complete-step', [WorkflowController::class, 'completeStep']);
        Route::delete('tasks/{taskId}/workflow',            [WorkflowController::class, 'destroy']);

        // Notifications
        Route::get('notifications/summary',          [NotificationController::class, 'summary']);
        Route::get('notifications',                  [NotificationController::class, 'index']);
        Route::put('notifications/read-all',         [NotificationController::class, 'markAllRead']);
        Route::put('notifications/{id}/read',        [NotificationController::class, 'markRead']);

        // Activity Logs
        Route::get('activity-logs', [ActivityLogController::class, 'index'])->middleware('permission:activity.view');

        // File Manager — viewing is scoped per-role inside the controller (own uploads,
        // own tasks, or department/mentions for managers); deleting is ownership-checked inline.
        Route::get('files',         [FileController::class, 'index']);
        Route::delete('files/{id}', [FileController::class, 'destroy']);

        // Branding Settings (inline isAdminOrAbove() check inside the controller)
        Route::put('settings',       [SettingsController::class, 'update']);
        Route::post('settings/logo', [SettingsController::class, 'updateLogo']);

        // Reports (inline isAdminOrAbove() check inside the controller)
        Route::get('reports/performance', [ReportController::class, 'performance']);
        Route::get('reports/export',      [ReportController::class, 'export']);
    });
});
