<?php

namespace App\Jobs;

use App\Services\EmailNotificationMailer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Throwable;

class SendDocumentTrackingReceivedEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $documentTitle,
        public string $trackingNumber,
        public string $receivingOfficeName,
    ) {}

    public function handle(EmailNotificationMailer $mailer): void
    {
        if (($deliveryIssue = $mailer->automatedDeliveryIssue()) !== null) {
            Log::notice('Email document tracking notification skipped.', [
                'recipient' => $this->recipientHint(),
                'tracking_number' => $this->trackingNumber,
                'reason' => $deliveryIssue,
            ]);

            return;
        }

        try {
            $mailer->sendDocumentNotification(
                $this->recipientEmail,
                '[DOTS] Document received by '.$this->receivingOfficeName.': '.$this->trackingNumber,
                [
                    'preheader' => 'Receipt of your document was recorded by '.$this->receivingOfficeName.'.',
                    'label' => 'Receipt confirmation',
                    'heading' => 'Your document was received',
                    'recipient_name' => $this->recipientName,
                    'intro' => 'Receipt of your document was recorded in the Document Tracking System.',
                    'details' => [
                        ['label' => 'Document', 'value' => $this->documentTitle],
                        ['label' => 'DOTS No.', 'value' => $this->trackingNumber],
                        ['label' => 'Received by office', 'value' => $this->receivingOfficeName],
                    ],
                    'closing' => 'You can open DOTS to view the latest route and receipt history.',
                    'action_label' => 'Track document',
                    'action_url' => URL::signedRoute('documents.track', ['trackingNumber' => $this->trackingNumber]),
                    'tone' => 'receipt',
                ],
            );
        } catch (Throwable $exception) {
            Log::warning('Email document tracking notification attempt failed.', [
                'recipient' => $this->recipientHint(),
                'tracking_number' => $this->trackingNumber,
                'attempt' => $this->attempts(),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        Log::info('Email document tracking notification sent.', [
            'recipient' => $this->recipientHint(),
            'tracking_number' => $this->trackingNumber,
        ]);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Email document tracking notification failed after retries.', [
            'recipient' => $this->recipientHint(),
            'tracking_number' => $this->trackingNumber,
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
