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
                    ? 'Email delivery is already enabled.'
                    : 'Email delivery is already paused.',
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

        Log::notice('Email delivery was '.($enabled ? 'enabled' : 'paused').'.', [
            'user_id' => $request->user()?->id,
        ]);

        return back()->with(
            'status',
            $enabled
                ? 'Email delivery is now enabled.'
                : 'Email delivery is paused. All outgoing emails are blocked.',
        );
    }

    public function sendTest(Request $request, EmailNotificationMailer $mailer): RedirectResponse
    {
        $validated = $request->validate([
            'recipient' => ['required', 'email:rfc', 'max:255'],
        ]);

        if ($mailer->automatedDeliveryIssue() === 'notifications_paused') {
            return back()->with('error', 'Email delivery is paused. DOTS blocked the test message, so no email was sent.');
        }

        if (! $mailer->isConfigured()) {
            return back()->with('error', 'The test email was not sent because the SMTP configuration is incomplete. Complete the missing settings in .env, then clear the configuration cache.');
        }

        try {
            $mailer->sendDocumentNotification(
                $validated['recipient'],
                '[DOTS] Email delivery test successful',
                [
                    'preheader' => 'DOTS successfully sent this email delivery test.',
                    'label' => 'System test',
                    'heading' => 'Email delivery is working',
                    'recipient_name' => $request->user()?->name ?: 'Administrator',
                    'intro' => 'This test message was sent by the Document Tracking System.',
                    'details' => [
                        ['label' => 'Delivery status', 'value' => 'Successful'],
                        ['label' => 'From address', 'value' => $mailer->senderAddress()],
                    ],
                    'closing' => 'If you can read this message, the configured SMTP service is delivering DOTS emails with both HTML and plain-text content.',
                    'notice' => 'No action is required. This message was generated from the Email notifications administration page.',
                    'tone' => 'primary',
                ],
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

        return back()->with('status', 'The test email was sent successfully with its HTML and plain-text content.');
    }

    private function recipientHint(string $email): string
    {
        $parts = explode('@', $email, 2);

        return count($parts) === 2 ? substr($parts[0], 0, 1).'***@'.$parts[1] : 'invalid';
    }
}
