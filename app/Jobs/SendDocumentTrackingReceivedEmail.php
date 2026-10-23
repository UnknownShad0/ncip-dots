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

        $body = implode("\n", [
            'Hello '.$this->recipientName.',',
            '',
            sprintf(
                'Your document %s (%s) was received by %s.',
                $this->documentTitle,
                $this->trackingNumber,
                $this->receivingOfficeName,
            ),
        ]);

        try {
            $mailer->sendText(
                $this->recipientEmail,
                'Document received: '.$this->trackingNumber,
                $body,
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
