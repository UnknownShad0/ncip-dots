<?php

namespace App\Jobs;

use App\Services\GmailApiMailer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendDocumentStatusEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $documentTitle,
        public string $status,
        public int $versionNumber,
        public ?string $remarks = null,
        public ?string $trackingNumber = null,
    ) {}

    public function handle(GmailApiMailer $mailer): void
    {
        $statusLabel = match ($this->status) {
            'approved' => 'Approved',
            'revision_requested' => 'Changes requested',
            'rejected' => 'Rejected',
            'registered' => 'Registered in DOTS',
            default => ucfirst(str_replace('_', ' ', $this->status)),
        };

        $lines = [
            'Hello '.$this->recipientName.',',
            '',
            'There is an update to your document submission.',
            '',
            'Document: '.$this->documentTitle,
            'Status: '.$statusLabel,
            'Version: '.$this->versionNumber,
        ];

        if ($this->trackingNumber) {
            $lines[] = 'Tracking number: '.$this->trackingNumber;
        }

        if (filled($this->remarks)) {
            $lines[] = '';
            $lines[] = 'Remarks: '.$this->remarks;
        }

        $lines[] = '';
        $lines[] = 'Sign in to DOTS to view the document and take any next steps:';
        $lines[] = route('document-creation.index');

        try {
            $mailer->sendText(
                $this->recipientEmail,
                '[DOTS] Document status update: '.$statusLabel,
                implode("\n", $lines),
            );
        } catch (Throwable $exception) {
            Log::warning('Gmail document status notification attempt failed.', [
                'recipient' => $this->recipientHint(),
                'status' => $this->status,
                'version' => $this->versionNumber,
                'attempt' => $this->attempts(),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        Log::info('Gmail document status notification sent.', [
            'recipient' => $this->recipientHint(),
            'status' => $this->status,
            'version' => $this->versionNumber,
        ]);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Gmail document status notification failed after retries.', [
            'recipient' => $this->recipientHint(),
            'status' => $this->status,
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
