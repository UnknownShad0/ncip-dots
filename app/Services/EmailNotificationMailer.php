<?php

namespace App\Services;

use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class EmailNotificationMailer
{
    public function __construct(private readonly EmailNotificationSettings $settings) {}

    public function sendText(string $recipient, string $subject, string $body): void
    {
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('The notification recipient email address is invalid.');
        }

        $issues = $this->configurationIssues();
        if ($issues !== []) {
            throw new RuntimeException('Email notifications are not configured: '.implode(', ', $issues).'.');
        }

        Mail::raw($body, function (Message $message) use ($recipient, $subject): void {
            $message->to($recipient)->subject($subject);
        });
    }

    public function isConfigured(): bool
    {
        return $this->configurationIssues() === [];
    }

    public function canSendAutomated(): bool
    {
        return $this->settings->automatedEnabled() && $this->isConfigured();
    }

    public function automatedDeliveryIssue(): ?string
    {
        if (! $this->settings->automatedEnabled()) {
            return 'notifications_paused';
        }

        return $this->isConfigured() ? null : 'sender_not_configured';
    }

    /**
     * @return list<string>
     */
    public function configurationIssues(): array
    {
        $mailer = (string) config('mail.default');
        $issues = [];

        if ($mailer === '' || ! is_array(config('mail.mailers.'.$mailer))) {
            $issues[] = 'MAIL_MAILER';
        }

        if ($mailer === 'smtp') {
            if (! filled(config('mail.mailers.smtp.host'))) {
                $issues[] = 'MAIL_HOST';
            }

            if (! filled(config('mail.mailers.smtp.port'))) {
                $issues[] = 'MAIL_PORT';
            }

            if (! filled(config('mail.mailers.smtp.username'))) {
                $issues[] = 'MAIL_USERNAME';
            }

            if (! filled(config('mail.mailers.smtp.password'))) {
                $issues[] = 'MAIL_PASSWORD';
            }
        }

        if (! filter_var($this->senderAddress(), FILTER_VALIDATE_EMAIL)) {
            $issues[] = 'MAIL_FROM_ADDRESS';
        }

        return array_values(array_unique($issues));
    }

    public function senderAddress(): string
    {
        return (string) config('mail.from.address', '');
    }
}
