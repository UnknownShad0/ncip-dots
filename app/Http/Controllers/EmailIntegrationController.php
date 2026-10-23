<?php

namespace App\Http\Controllers;

use App\Services\AuditTrailWriter;
use App\Services\EmailNotificationMailer;
use App\Services\EmailNotificationSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class EmailIntegrationController extends Controller
{
    public function index(Request $request, EmailNotificationMailer $mailer, EmailNotificationSettings $settings): Response
    {
        return Inertia::render('EmailIntegration/Index', [
            'configured' => $mailer->isConfigured(),
            'automatedEnabled' => $settings->automatedEnabled(),
            'mailer' => (string) config('mail.default'),
            'host' => config('mail.mailers.smtp.host'),
            'port' => config('mail.mailers.smtp.port'),
            'sender' => $mailer->senderAddress(),
            'missingSettings' => $mailer->configurationIssues(),
            'testRecipient' => $request->user()?->email,
            'statusMessage' => $request->session()->get('status'),
            'errorMessage' => $request->session()->get('error'),
        ]);
    }

    public function updateAutomation(
        Request $request,
        EmailNotificationSettings $settings,
        AuditTrailWriter $auditTrail,
    ): RedirectResponse {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);
        $enabled = (bool) $validated['enabled'];
        $previouslyEnabled = $settings->automatedEnabled();

        if ($previouslyEnabled === $enabled) {
            return back()->with(
                'status',
                $enabled
                    ? 'Automated workflow emails are already enabled.'
                    : 'Automated workflow emails are already paused.',
            );
        }

        DB::transaction(function () use ($request, $settings, $auditTrail, $previouslyEnabled, $enabled): void {
            $setting = $settings->setAutomatedEnabled($enabled, $request->user()?->id);

            $auditTrail->record(
                $enabled ? 'email_notifications.enabled' : 'email_notifications.paused',
                subject: $setting,
                details: [
                    'changes' => [
                        'automated_emails' => [
                            'before' => $previouslyEnabled ? 'enabled' : 'paused',
                            'after' => $enabled ? 'enabled' : 'paused',
                        ],
                    ],
                ],
                actor: $request->user(),
            );
        });

        Log::notice('Automated email notifications were '.($enabled ? 'enabled' : 'paused').'.', [
            'user_id' => $request->user()?->id,
        ]);

        return back()->with(
            'status',
            $enabled
                ? 'Automated workflow emails are now enabled.'
                : 'Automated workflow emails are paused. Manual test emails remain available.',
        );
    }

    public function sendTest(Request $request, EmailNotificationMailer $mailer): RedirectResponse
    {
        $validated = $request->validate([
            'recipient' => ['required', 'email:rfc', 'max:255'],
        ]);

        if (! $mailer->isConfigured()) {
            return back()->with('error', 'Complete the missing email settings in .env, then clear the configuration cache.');
        }

        try {
            $mailer->sendText(
                $validated['recipient'],
                '[DOTS] Email notification test',
                "This is a test email from the DOTS email notification service.\n\nIf you received this message, the SMTP configuration is working.",
            );
        } catch (Throwable $exception) {
            Log::warning('Email notification test failed.', [
                'recipient' => $this->recipientHint($validated['recipient']),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return back()->with('error', 'The test email could not be sent. Check the SMTP credentials, SMTP AUTH access, and application log.');
        }

        Log::info('Email notification test sent.', [
            'recipient' => $this->recipientHint($validated['recipient']),
            'user_id' => $request->user()?->id,
        ]);

        return back()->with('status', 'Test email sent successfully.');
    }

    private function recipientHint(string $email): string
    {
        $parts = explode('@', $email, 2);

        return count($parts) === 2 ? substr($parts[0], 0, 1).'***@'.$parts[1] : 'invalid';
    }
}
