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

class SendDocumentRouteNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public int $documentId,
        public string $documentTitle,
        public string $trackingNumber,
        public string $officeName,
        public string $event,
        public string $routingMode,
        public ?string $remarks = null,
    ) {}

    public function handle(EmailNotificationMailer $mailer): void
    {
        if (($deliveryIssue = $mailer->automatedDeliveryIssue()) !== null) {
            Log::notice('Email document route notification skipped.', [
                'recipient' => $this->recipientHint(),
                'tracking_number' => $this->trackingNumber,
                'event' => $this->event,
                'reason' => $deliveryIssue,
            ]);

            return;
        }

        $eventLabel = match ($this->event) {
            'approval_required' => 'Your office has a document to review and approve.',
            'approved' => 'An office approved the document.',
            'changes_requested' => 'An office requested changes to the document.',
            'rejected' => 'An office rejected the document.',
            default => 'There is an update to the document route.',
        };
        $lines = [
            'Hello '.$this->recipientName.',',
            '',
            $eventLabel,
            '',
            'Document: '.$this->documentTitle,
            'Tracking number: '.$this->trackingNumber,
            'Office: '.$this->officeName,
            'Approval flow: '.($this->routingMode === 'parallel' ? 'Parallel approval' : 'Sequential approval'),
        ];

        if (filled($this->remarks)) {
            $lines[] = '';
            $lines[] = 'Remarks: '.$this->remarks;
        }

        $lines[] = '';
        $lines[] = 'Open the document in DOTS:';
        $lines[] = route('documents.index', ['open_document_id' => $this->documentId]);

        try {
            $mailer->sendText(
                $this->recipientEmail,
                '[DOTS] Document route update: '.$this->trackingNumber,
                implode("\n", $lines),
            );
        } catch (Throwable $exception) {
            Log::warning('Email document route notification attempt failed.', [
                'recipient' => $this->recipientHint(),
                'tracking_number' => $this->trackingNumber,
                'event' => $this->event,
                'attempt' => $this->attempts(),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Email document route notification failed after retries.', [
            'recipient' => $this->recipientHint(),
            'tracking_number' => $this->trackingNumber,
            'event' => $this->event,
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
