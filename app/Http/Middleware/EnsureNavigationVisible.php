<?php

namespace App\Http\Middleware;

use App\Services\NavigationAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureNavigationVisible
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || $user->isSuperAdmin()) {
            return $next($request);
        }

        $navigationAccess = app(NavigationAccess::class);
        $keys = $navigationAccess->accessKeysForRequest($request, $user);

        if ($keys !== null) {
            $visibility = $navigationAccess->forUser($user);
            $canAccess = collect($keys)->contains(fn (string $key) => ($visibility[$key] ?? false) === true);
            abort_unless($canAccess, 403);
        }

        return $next($request);
    }
}
