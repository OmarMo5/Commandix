<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SavedView;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

/**
 * Per-user saved filter presets ("My overdue", "Marketing this week"…). Strictly
 * personal: every query is pinned to the authenticated user.
 */
class SavedViewController extends Controller
{
    /** Filter keys the board understands — anything else is dropped on save. */
    private const ALLOWED_FILTERS = [
        'search', 'status', 'priority', 'department_id', 'assignee_id',
        'creator_id', 'mine', 'assigned_to_me', 'due', 'due_from', 'due_to',
    ];

    public function index(Request $request)
    {
        return response()->json(
            SavedView::where('user_id', $request->user()->id)
                ->where('scope', $request->input('scope', 'tasks'))
                ->orderBy('name')
                ->get()
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'    => 'required|string|max:60',
            'scope'   => 'sometimes|in:tasks',
            'filters' => 'required|array',
        ]);

        $view = SavedView::updateOrCreate(
            ['user_id' => $request->user()->id, 'scope' => $data['scope'] ?? 'tasks', 'name' => trim($data['name'])],
            ['filters' => Arr::only($data['filters'], self::ALLOWED_FILTERS)]
        );

        return response()->json($view, $view->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(Request $request, string $id)
    {
        SavedView::where('user_id', $request->user()->id)->findOrFail($id)->delete();

        return response()->json(['message' => 'View deleted.']);
    }
}
