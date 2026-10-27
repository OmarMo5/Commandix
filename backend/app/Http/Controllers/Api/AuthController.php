<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    private const MAX_LOGIN_ATTEMPTS = 5;
    private const LOCKOUT_MINUTES = 15;

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::with(['role.permissions', 'department'])->where('email', $request->email)->first();

        if ($user && $user->locked_until && $user->locked_until->isFuture()) {
            $minutes = now()->diffInMinutes($user->locked_until, true);
            return response()->json([
                'message' => "Too many failed attempts. Try again in " . max(1, ceil($minutes)) . ' minute(s).',
            ], 423);
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            if ($user) {
                $user->failed_login_attempts++;
                if ($user->failed_login_attempts >= self::MAX_LOGIN_ATTEMPTS) {
                    $user->locked_until = now()->addMinutes(self::LOCKOUT_MINUTES);
                    $user->failed_login_attempts = 0;
                    $user->save();

                    throw ValidationException::withMessages([
                        'email' => ["Too many failed attempts. Account locked for " . self::LOCKOUT_MINUTES . ' minutes.'],
                    ]);
                }
                $user->save();
            }

            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Account is deactivated.'], 403);
        }

        if ($user->failed_login_attempts > 0 || $user->locked_until) {
            $user->failed_login_attempts = 0;
            $user->locked_until = null;
            $user->save();
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        ActivityLog::record('user_login', $user, [], [], $user->id);

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
        ]);
    }

    public function logout(Request $request)
    {
        ActivityLog::record('user_logout');
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load(['role.permissions', 'department']);
        return response()->json($this->formatUser($user));
    }

    /**
     * PUT /auth/profile — self-service name/email edit. Deliberately limited to
     * those two fields so it can never be used to change one's own role,
     * department, or active flag (that stays behind users.edit).
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
        ]);

        $old = $user->only(['name', 'email']);
        $user->update($data);
        ActivityLog::record('profile_updated', $user, $old, $data);

        return response()->json($this->formatUser($user->load(['role.permissions', 'department'])));
    }

    /**
     * PUT /auth/password — self-service password change. Requires the current
     * password, and signs out every other device/session afterwards.
     */
    public function changePassword(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed|different:current_password',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => $request->password]);

        // Sign out every other device, keep this session alive.
        $current = $user->currentAccessToken();
        $user->tokens()
            ->when($current instanceof PersonalAccessToken, fn($q) => $q->where('id', '!=', $current->id))
            ->delete();
        ActivityLog::record('password_changed', $user);

        return response()->json(['message' => 'Password changed successfully.']);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar_url,
            'is_active' => $user->is_active,
            'role' => $user->role ? [
                'id' => $user->role->id,
                'name' => $user->role->name,
                'display_name' => $user->role->display_name,
                'permissions' => $user->role->permissions->pluck('name'),
            ] : null,
            'department' => $user->department ? [
                'id' => $user->department->id,
                'name' => $user->department->name,
            ] : null,
        ];
    }
}
