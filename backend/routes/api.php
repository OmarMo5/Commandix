<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AttachmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\FileController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\TaskCommentController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkflowController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ── Public ────────────────────────────────────────────────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('login',    [AuthController::class, 'login']);
        Route::post('register', [AuthController::class, 'register']);
    });

    // ── Protected ─────────────────────────────────────────────────────────────
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me',      [AuthController::class, 'me']);
        });

        // Dashboard
        Route::get('dashboard/stats', [DashboardController::class, 'stats']);

        // Users
        Route::apiResource('users', UserController::class);
        Route::put('users/{id}/password', [UserController::class, 'updatePassword']);
        Route::post('users/avatar',       [UserController::class, 'updateAvatar']);

        // Roles & Permissions
        Route::apiResource('roles', RoleController::class);
        Route::get('permissions', [RoleController::class, 'permissions']);

        // Departments
        Route::get('departments/managers-list',    [DepartmentController::class, 'managersList']);
        Route::post('departments/message-manager', [DepartmentController::class, 'messageManager']);
        Route::apiResource('departments', DepartmentController::class);

        // Tasks
        Route::apiResource('tasks', TaskController::class);
        Route::put('tasks/{id}/status', [TaskController::class, 'updateStatus']);

        // Task Comments / Q&A
        Route::get('tasks/{taskId}/comments',                         [TaskCommentController::class, 'index']);
        Route::post('tasks/{taskId}/comments',                        [TaskCommentController::class, 'store']);
        Route::put('tasks/{taskId}/comments/{commentId}/resolve',     [TaskCommentController::class, 'resolve']);
        Route::delete('tasks/{taskId}/comments/{commentId}',          [TaskCommentController::class, 'destroy']);

        // Attachments
        Route::post('tasks/{taskId}/attachments', [AttachmentController::class, 'store']);
        Route::delete('attachments/{id}',         [AttachmentController::class, 'destroy']);

        // Workflow
        Route::get('tasks/{taskId}/workflow',               [WorkflowController::class, 'show']);
        Route::post('tasks/{taskId}/workflow',              [WorkflowController::class, 'store']);
        Route::put('tasks/{taskId}/workflow/complete-step', [WorkflowController::class, 'completeStep']);
        Route::delete('tasks/{taskId}/workflow',            [WorkflowController::class, 'destroy']);

        // Notifications
        Route::get('notifications',                  [NotificationController::class, 'index']);
        Route::put('notifications/read-all',         [NotificationController::class, 'markAllRead']);
        Route::put('notifications/{id}/read',        [NotificationController::class, 'markRead']);

        // Activity Logs
        Route::get('activity-logs', [ActivityLogController::class, 'index']);

        // File Manager
        Route::get('files',         [FileController::class, 'index']);
        Route::delete('files/{id}', [FileController::class, 'destroy']);
    });
});
