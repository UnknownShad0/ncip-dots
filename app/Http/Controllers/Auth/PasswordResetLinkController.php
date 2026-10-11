<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditTrailWriter;
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
            'username' => 'required|string|max:255',
        ]);

        $username = $request->input('username');
        if ($this->usesLogMailer(config('mail.default'))) {
            app(AuditTrailWriter::class)->record('password.reset_requested', details: [
                'identifier' => $username,
                'reason' => 'email_not_configured',
            ], result: 'failure');
            abort(503, 'Password recovery email is not configured. Please contact support.');
        }

        // We will send the password reset link to this user. Once we have attempted
        // to send the link, we will examine the response then see the message we
        // need to show to the user. Finally, we'll send out a proper response.
        $user = User::query()->where('username', $username)->first();
        if (! $user) {
            app(AuditTrailWriter::class)->record('password.reset_requested', details: [
                'identifier' => $username,
                'reason' => 'account_not_found',
            ], result: 'failure');
        } else {
            $status = null;
            try {
                $status = Password::sendResetLink(['email' => $user->email]);
            } catch (\Throwable $exception) {
                report($exception);
                Log::warning('Password recovery email delivery failed.');
            }
            app(AuditTrailWriter::class)->record('password.reset_requested', $user, [
                'status' => $status,
            ], $status === Password::RESET_LINK_SENT ? 'success' : 'failure');
        }

        return back()->with('status', 'If an account matches that username, we’ll send a password reset link shortly.');
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
