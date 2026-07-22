<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SettingsController extends Controller
{
    /**
     * GET /settings — public, the login page needs branding before authentication.
     */
    public function show()
    {
        $settings = Setting::current();

        return response()->json([
            'app_name' => $settings->app_name,
            'logo_url' => $settings->logo_url,
        ]);
    }

    public function update(Request $request)
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate(['app_name' => 'sometimes|string|max:100']);

        $settings = Setting::current();
        $settings->update($request->only(['app_name']));

        return response()->json([
            'app_name' => $settings->app_name,
            'logo_url' => $settings->logo_url,
        ]);
    }

    public function updateLogo(Request $request)
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate(['logo' => 'required|image|max:2048']);

        $settings = Setting::current();

        if ($settings->logo) {
            Storage::disk('public')->delete($settings->logo);
        }

        $path = $request->file('logo')->store('branding', 'public');
        $settings->update(['logo' => $path]);

        return response()->json(['logo_url' => $settings->fresh()->logo_url]);
    }
}
