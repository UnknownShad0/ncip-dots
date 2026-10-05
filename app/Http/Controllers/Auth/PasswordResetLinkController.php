<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        abort_if($this->usesLogMailer(config('mail.default')), 503, 'Password recovery email is not configured. Please contact support.');

        // We will send the password reset link to this user. Once we have attempted
        // to send the link, we will examine the response then see the message we
        // need to show to the user. Finally, we'll send out a proper response.
        try {
            Password::sendResetLink($request->only('email'));
        } catch (\Throwable) {
            Log::warning('Password recovery email delivery failed.');
        }

        return back()->with('status', 'If an account matches that email address, we’ll send a password reset link shortly.');
    }

    private function usesLogMailer(string $mailer, array $checked = []): bool
    {
        if (in_array($mailer, $checked, true)) {
            return false;
        }

        $checked[] = $mailer;
        $configuration = config("mail.mailers.{$mailer}", []);

        if (($configuration['transport'] ?? null) === 'log') {
            return true;
        }

        foreach ($configuration['mailers'] ?? [] as $fallback) {
            if ($this->usesLogMailer($fallback, $checked)) {
                return true;
            }
        }

        return false;
    }
}
