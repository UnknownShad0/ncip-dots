<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdministrator
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->canManageLibraries()) {
            if (str_starts_with($request->path(), 'admin/email') || str_starts_with($request->path(), 'admin/gmail')) {
                Log::warning('Email integration access was denied by administrator middleware.', [
                    'path' => $request->path(),
                    'route' => $request->route()?->getName(),
                    'user_id' => $user?->id,
                    'role_id' => $user?->role_id,
                    'role' => $user?->role,
                ]);
            }

            abort(403);
        }

        return $next($request);
    }
}
