<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Services\AuditTrailWriter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
            'recaptcha' => [
                'enabled' => (bool) config('services.recaptcha.enabled'),
                'v3SiteKey' => (string) config('services.recaptcha.v3_site_key', ''),
                'v2SiteKey' => (string) config('services.recaptcha.v2_site_key', ''),
            ],
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        if ($passwordSetupRedirect = $request->authenticate()) {
            return $passwordSetupRedirect;
        }

        app(AuditTrailWriter::class)->record('login.succeeded', $request->user());
        $request->session()->regenerate();
        $request->session()->put('privacy_notice_login_id', (string) Str::uuid());

        if (! $request->user()->canManageLibraries() && $this->intendedRouteRequiresAdministrator($request)) {
            $request->session()->forget('url.intended');

            return redirect()->route('dashboard');
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    private function intendedRouteRequiresAdministrator(Request $request): bool
    {
        $intendedUrl = $request->session()->get('url.intended');
        if (! is_string($intendedUrl) || $intendedUrl === '') {
            return false;
        }

        try {
            $intendedRoute = app('router')->getRoutes()->match(Request::create($intendedUrl));
        } catch (NotFoundHttpException|MethodNotAllowedHttpException) {
            return false;
        }

        return in_array('administrator', $intendedRoute->gatherMiddleware(), true);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        app(AuditTrailWriter::class)->record('logout.succeeded', $request->user());
        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect('/');
    }
}
