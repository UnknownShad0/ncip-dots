<?php

namespace App\Jobs;

use App\Services\EmailNotificationMailer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
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

        try {
            $mailer->sendDocumentNotification(
                $this->recipientEmail,
                '[DOTS] Approval needed: '.$this->subjectDocumentTitle(),
                [
                    'preheader' => $this->submitterName.' submitted a document that is waiting for your review.',
                    'label' => 'Action required',
                    'heading' => 'A document is waiting for your approval',
                    'recipient_name' => $this->recipientName,
                    'intro' => $this->submitterName.' submitted a document that requires review and approval from your office.',
                    'details' => [
                        ['label' => 'Document', 'value' => $this->documentTitle],
                        ['label' => 'Submitted by', 'value' => $this->submitterName],
                        ['label' => 'Version', 'value' => $this->versionNumber],
                    ],
                    'closing' => 'Please review the document and record your decision in the Document Tracking System.',
                    'action_label' => 'Review document',
                    'action_url' => route('document-creation.index', ['queue' => 'approval']),
                    'notice' => 'For accountability and security, approval decisions must be completed while signed in to your DOTS account.',
                    'tone' => 'warning',
                ],
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

    private function subjectDocumentTitle(): string
    {
        return Str::limit(trim((string) preg_replace('/\s+/', ' ', $this->documentTitle)), 90);
    }
}
