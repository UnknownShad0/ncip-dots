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

        $message = match ($this->event) {
            'approval_required' => [
                'subject' => '[DOTS] Office review needed: '.$this->trackingNumber,
                'preheader' => 'A routed document is ready for review by '.$this->officeName.'.',
                'label' => 'Action required',
                'heading' => 'Your office has a document to review',
                'intro' => 'A routed document is ready for review and approval by your office.',
                'closing' => 'Sign in to DOTS to review the document and record an authorized decision.',
                'action' => 'Review document',
                'tone' => 'warning',
            ],
            'approved' => [
                'subject' => '[DOTS] Route approved by '.$this->officeName.': '.$this->trackingNumber,
                'preheader' => $this->officeName.' approved the routed document.',
                'label' => 'Route update',
                'heading' => 'An office approved your document',
                'intro' => $this->officeName.' approved the routed document.',
                'closing' => 'The document will proceed according to its configured route.',
                'action' => 'View route status',
                'tone' => 'success',
            ],
            'changes_requested' => [
                'subject' => '[DOTS] Route changes requested: '.$this->trackingNumber,
                'preheader' => $this->officeName.' requested changes to the routed document.',
                'label' => 'Action required',
                'heading' => 'An office requested changes to your document',
                'intro' => $this->officeName.' requested changes to the routed document.',
                'closing' => 'Open DOTS to review the request and prepare the next version.',
                'action' => 'Review requested changes',
                'tone' => 'warning',
            ],
            'rejected' => [
                'subject' => '[DOTS] Route rejected by '.$this->officeName.': '.$this->trackingNumber,
                'preheader' => $this->officeName.' rejected the routed document.',
                'label' => 'Route update',
                'heading' => 'An office rejected your document',
                'intro' => $this->officeName.' rejected the routed document.',
                'closing' => 'Open DOTS to review the recorded decision.',
                'action' => 'View route status',
                'tone' => 'danger',
            ],
            default => [
                'subject' => '[DOTS] Document route update: '.$this->trackingNumber,
                'preheader' => 'There is an update to the document route.',
                'label' => 'Route update',
                'heading' => 'There is an update to the document route',
                'intro' => 'There is an update to the routed document.',
                'closing' => 'Open DOTS to view the current route status.',
                'action' => 'View route status',
                'tone' => 'primary',
            ],
        };

        try {
            $mailer->sendDocumentNotification(
                $this->recipientEmail,
                $message['subject'],
                [
                    'preheader' => $message['preheader'],
                    'label' => $message['label'],
                    'heading' => $message['heading'],
                    'recipient_name' => $this->recipientName,
                    'intro' => $message['intro'],
                    'details' => [
                        ['label' => 'Document', 'value' => $this->documentTitle],
                        ['label' => 'DOTS No.', 'value' => $this->trackingNumber],
                        ['label' => $this->event === 'approval_required' ? 'Assigned office' : 'Office', 'value' => $this->officeName],
                        ['label' => 'Approval flow', 'value' => $this->routingMode === 'parallel' ? 'Parallel approval' : 'Sequential approval'],
                    ],
                    'remarks_label' => 'Reviewer remarks',
                    'remarks' => $this->remarks,
                    'closing' => $message['closing'],
                    'action_label' => $message['action'],
                    'action_url' => route('documents.index', ['open_document_id' => $this->documentId]),
                    'tone' => $message['tone'],
                ],
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
