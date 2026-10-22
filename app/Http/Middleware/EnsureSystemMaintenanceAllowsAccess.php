<?php

namespace App\Http\Middleware;

use App\Services\SystemMaintenance;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureSystemMaintenanceAllowsAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->isSuperAdmin() || $request->routeIs('maintenance.show', 'logout')) {
            return $next($request);
        }

        $maintenance = app(SystemMaintenance::class);
        $setting = $maintenance->current();

        if ($maintenance->activeMode($setting) !== 'full') {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json([
                'message' => $setting?->message ?? SystemMaintenance::DEFAULT_MESSAGE,
                'maintenance' => true,
            ], 503);
        }

        return redirect()->route('maintenance.show');
    }
}
