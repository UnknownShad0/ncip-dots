<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ($user->is_active && ! $user->is_locked)) {
            return $next($request);
        }

        $message = $user->is_locked
            ? 'Your account is locked after repeated failed login attempts. Contact an administrator to unlock it.'
            : 'Your account is inactive. Contact an administrator to reactivate it.';

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login')->withErrors(['username' => $message]);
    }
}
