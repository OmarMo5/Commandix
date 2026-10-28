<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaskNotification;
use App\Support\DirectUnread;
use App\Support\GroupUnread;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * GET /notifications
     *   tab   = primary | other | later | cleared   (omitted → the whole inbox, as before)
     *   group = assigned | mentions | comments | reminders | workflow | messages
     * `unread_count` is the inbox's unread total (what the bell shows); `counts` feeds the tab badges.
     */
    public function index(Request $request)
    {
        $me = $request->user()->id;
        $mine = fn() => TaskNotification::where('user_id', $me);

        $request->validate([
            'tab'   => 'nullable|in:primary,other,later,cleared',
            'group' => 'nullable|in:' . implode(',', array_keys(TaskNotification::GROUPS)),
        ]);

        $query = $mine();
        match ($request->query('tab')) {
            'primary' => $query->inbox()->primary(),
            'other'   => $query->inbox()->other(),
            'later'   => $query->later(),
            'cleared' => $query->cleared(),
            default   => $query->inbox(),
        };

        if ($group = $request->query('group')) {
            $query->whereIn('type', TaskNotification::GROUPS[$group]);
        }

        return response()->json([
            'notifications' => $query->latest('id')->paginate(20),
            'unread_count'  => $mine()->inbox()->unread()->count(),
            'counts'        => [
                'primary_unread' => $mine()->inbox()->primary()->unread()->count(),
                'other_unread'   => $mine()->inbox()->other()->unread()->count(),
                'later'          => $mine()->later()->count(),
            ],
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
            // Only what is actually in the inbox: parked and cleared items don't ring the bell.
            'unread_count' => TaskNotification::where('user_id', $user->id)->inbox()->unread()->count(),
            'latest_id'    => (int) TaskNotification::where('user_id', $user->id)->max('id'),
            'groups_unread' => (object) $unread['groups'],
            'tasks_unread'  => (object) $unread['tasks'],
            'dm_unread'     => (object) DirectUnread::for($user),
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
            ->inbox()
            ->unread()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /** PUT /notifications/{id}/clear — done with it; it moves to the Cleared tab (and counts as read). */
    public function clear(Request $request, string $id)
    {
        $notification = TaskNotification::where('user_id', $request->user()->id)->findOrFail($id);

        $notification->update([
            'cleared_at'    => now(),
            'read_at'       => $notification->read_at ?? now(),
            'later_at'      => null,
            'snoozed_until' => null,
        ]);

        return response()->json(['message' => 'Notification cleared.']);
    }

    /** PUT /notifications/{id}/restore — back into the inbox, from Later or Cleared. */
    public function restore(Request $request, string $id)
    {
        $notification = TaskNotification::where('user_id', $request->user()->id)->findOrFail($id);

        $notification->update(['cleared_at' => null, 'later_at' => null, 'snoozed_until' => null]);

        return response()->json(['message' => 'Notification restored.']);
    }

    /**
     * PUT /notifications/{id}/snooze { until: later_today | tomorrow | next_week | someday }
     * Parks it in Later. It comes back, unread, when the time arrives ("someday" = until you move it).
     */
    public function snooze(Request $request, string $id)
    {
        $data = $request->validate(['until' => 'required|in:later_today,tomorrow,next_week,someday']);
        $notification = TaskNotification::where('user_id', $request->user()->id)->findOrFail($id);

        $until = match ($data['until']) {
            'later_today' => now()->addHours(3),
            'tomorrow'    => now()->addDay()->setTime(9, 0),
            'next_week'   => now()->next('Monday')->setTime(9, 0),
            'someday'     => null,
        };

        $notification->update([
            'cleared_at'    => null,
            'later_at'      => now(),
            'snoozed_until' => $until,
            'read_at'       => null,   // it returns as something new
        ]);

        return response()->json(['message' => 'Notification snoozed.', 'snoozed_until' => $until]);
    }

    /** POST /notifications/clear-all { tab?: primary | other } — clear everything in the inbox (or one tab of it). */
    public function clearAll(Request $request)
    {
        $data = $request->validate(['tab' => 'nullable|in:primary,other']);

        $query = TaskNotification::where('user_id', $request->user()->id)->inbox();
        match ($data['tab'] ?? null) {
            'primary' => $query->primary(),
            'other'   => $query->other(),
            default   => null,
        };

        $now = now();
        (clone $query)->unread()->update(['read_at' => $now]);   // cleared items count as read
        $cleared = $query->update(['cleared_at' => $now, 'later_at' => null, 'snoozed_until' => null]);

        return response()->json(['message' => 'Notifications cleared.', 'cleared' => $cleared]);
    }
}
