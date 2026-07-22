<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSuperAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user() || !$request->user()->isSuperAdmin()) {
            return response()->json(['message' => 'This action is restricted to Super Admins.'], 403);
        }

        return $next($request);
    }
}
