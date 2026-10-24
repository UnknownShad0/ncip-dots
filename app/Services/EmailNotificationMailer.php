<?php

namespace App\Services;

use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;

class EmailNotificationMailer
{
    public function __construct(private readonly EmailNotificationSettings $settings) {}

    public function sendText(string $recipient, string $subject, string $body): void
    {
        $this->validateDelivery($recipient);
        $subject = $this->safeSubject($subject);

        Mail::raw($body, function (Message $message) use ($recipient, $subject): void {
            $message->to($recipient)->subject($subject);
        });
    }

    /**
     * Send a branded document-workflow email with a plain-text fallback.
     *
     * @param  array{
     *     preheader?: string,
     *     label: string,
     *     heading: string,
     *     recipient_name: string,
     *     intro: string,
     *     details?: list<array{label: string, value: string|int}>,
     *     remarks_label?: string|null,
     *     remarks?: string|null,
     *     closing?: string|null,
     *     action_label?: string|null,
     *     action_url?: string|null,
     *     notice?: string|null,
     *     tone?: string
     * }  $content
     */
    public function sendDocumentNotification(string $recipient, string $subject, array $content): void
    {
        $this->validateDelivery($recipient);
        $subject = $this->safeSubject($subject);

        $tone = (string) ($content['tone'] ?? 'primary');
        if (! in_array($tone, ['primary', 'success', 'warning', 'danger', 'receipt'], true)) {
            $tone = 'primary';
        }

        $data = [
            'productName' => 'Document Tracking System',
            'logoPath' => public_path('images/email/ncip-logo.png'),
            'preheader' => (string) ($content['preheader'] ?? $content['heading']),
            'label' => (string) $content['label'],
            'heading' => (string) $content['heading'],
            'recipientName' => (string) $content['recipient_name'],
            'intro' => (string) $content['intro'],
            'details' => array_values($content['details'] ?? []),
            'remarksLabel' => $content['remarks_label'] ?? null,
            'remarks' => $content['remarks'] ?? null,
            'closing' => $content['closing'] ?? null,
            'actionLabel' => $content['action_label'] ?? null,
            'actionUrl' => $content['action_url'] ?? null,
            'notice' => $content['notice'] ?? null,
            'tone' => $tone,
        ];

        Mail::send(
            ['html' => 'emails.document-notification', 'text' => 'emails.document-notification-text'],
            $data,
            function (Message $message) use ($recipient, $subject): void {
                $message->to($recipient)->subject($subject);
            },
        );
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

    private function validateDelivery(string $recipient): void
    {
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('The notification recipient email address is invalid.');
        }

        if (! $this->settings->automatedEnabled()) {
            throw new RuntimeException('Email notifications are paused.');
        }

        $issues = $this->configurationIssues();
        if ($issues !== []) {
            throw new RuntimeException('Email notifications are not configured: '.implode(', ', $issues).'.');
        }
    }

    private function safeSubject(string $subject): string
    {
        $plainSubject = strip_tags($subject);

        return Str::limit(trim((string) preg_replace('/\s+/', ' ', $plainSubject)), 180);
    }
}
