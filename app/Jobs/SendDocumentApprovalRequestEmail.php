<?php

namespace App\Jobs;

use App\Services\EmailNotificationMailer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendDocumentApprovalRequestEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $submitterName,
        public string $documentTitle,
        public int $versionNumber,
    ) {}

    public function handle(EmailNotificationMailer $mailer): void
    {
        if (($deliveryIssue = $mailer->automatedDeliveryIssue()) !== null) {
            Log::notice('Email document approval notification skipped.', [
                'recipient' => $this->recipientHint(),
                'version' => $this->versionNumber,
                'reason' => $deliveryIssue,
            ]);

            return;
        }

        $body = implode("\n", [
            'Hello '.$this->recipientName.',',
            '',
            'A document submission is waiting for approval.',
            '',
            'Submitted by: '.$this->submitterName,
            'Document: '.$this->documentTitle,
            'Version: '.$this->versionNumber,
            '',
            'Open the approval queue in DOTS:',
            route('document-creation.index', ['queue' => 'approval']),
        ]);

        try {
            $mailer->sendText(
                $this->recipientEmail,
                '[DOTS] A document is waiting for approval',
                $body,
            );
        } catch (Throwable $exception) {
            Log::warning('Email document approval notification attempt failed.', [
                'recipient' => $this->recipientHint(),
                'version' => $this->versionNumber,
                'attempt' => $this->attempts(),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        Log::info('Email document approval notification sent.', [
            'recipient' => $this->recipientHint(),
            'version' => $this->versionNumber,
        ]);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Email document approval notification failed after retries.', [
            'recipient' => $this->recipientHint(),
            'version' => $this->versionNumber,
            'exception' => $exception::class,
            'message' => $exception->getMessage(),
        ]);
    }

    private function recipientHint(): string
    {
        $parts = explode('@', $this->recipientEmail, 2);

        return count($parts) === 2 ? substr($parts[0], 0, 1).'***@'.$parts[1] : 'invalid';
    }
}
