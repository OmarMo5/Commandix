<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskNotification;
use App\Support\GroupUnread;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $notifications = TaskNotification::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        $unreadCount = TaskNotification::where('user_id', $request->user()->id)
            ->unread()
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * GET /notifications/summary — the tiny payload the app polls every few seconds:
     * bell count, the newest notification id (so the UI can tell something arrived),
     * and unread chat messages per private group / per task inside one.
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        $unread = GroupUnread::for($user);

        return response()->json([
            'unread_count' => TaskNotification::where('user_id', $user->id)->unread()->count(),
            'latest_id'    => (int) TaskNotification::where('user_id', $user->id)->max('id'),
            'groups_unread' => (object) $unread['groups'],
            'tasks_unread'  => (object) $unread['tasks'],
        ]);
    }

    public function markRead(string $id)
    {
        $notification = TaskNotification::where('user_id', auth()->id())->findOrFail($id);
        $notification->markAsRead();
        return response()->json(['message' => 'Notification marked as read.']);
    }

    public function markAllRead(Request $request)
    {
        TaskNotification::where('user_id', $request->user()->id)
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
