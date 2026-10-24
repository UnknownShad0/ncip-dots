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

    public function handle(EmailNotificationMailer $mailer): void
    {
        if (($deliveryIssue = $mailer->automatedDeliveryIssue()) !== null) {
            Log::notice('Email document status notification skipped.', [
                'recipient' => $this->recipientHint(),
                'status' => $this->status,
                'version' => $this->versionNumber,
                'reason' => $deliveryIssue,
            ]);

            return;
        }

        $message = match ($this->status) {
            'approved' => [
                'status' => 'Approved',
                'subject' => '[DOTS] Approved: '.$this->subjectDocumentTitle(),
                'preheader' => 'Your document submission has been approved.',
                'label' => 'Status update',
                'heading' => 'Your document has been approved',
                'intro' => 'Your document submission has been reviewed and approved.',
                'closing' => 'No changes are currently required from you. You may open DOTS to view the latest status and available next steps.',
                'action' => 'View submission',
                'tone' => 'success',
            ],
            'revision_requested' => [
                'status' => 'Changes requested',
                'subject' => '[DOTS] Changes requested: '.$this->subjectDocumentTitle(),
                'preheader' => 'Review the remarks and submit a revised version.',
                'label' => 'Action required',
                'heading' => 'Changes were requested for your document',
                'intro' => 'The reviewer requested changes before your document can proceed.',
                'closing' => 'Review the remarks, update the document, and submit a new version in DOTS.',
                'action' => 'Review requested changes',
                'tone' => 'warning',
            ],
            'rejected' => [
                'status' => 'Rejected',
                'subject' => '[DOTS] Rejected: '.$this->subjectDocumentTitle(),
                'preheader' => 'Your document submission was not approved.',
                'label' => 'Status update',
                'heading' => 'Your document submission was rejected',
                'intro' => 'Your document submission was reviewed and was not approved.',
                'closing' => 'Open DOTS to review the decision and the available next steps.',
                'action' => 'View submission',
                'tone' => 'danger',
            ],
            'registered' => [
                'status' => 'Registered',
                'subject' => '[DOTS] Document registered: '.($this->trackingNumber ?: $this->subjectDocumentTitle()),
                'preheader' => 'Your approved document has been registered in DOTS.',
                'label' => 'Registration complete',
                'heading' => 'Your document has been registered',
                'intro' => 'Your approved document is now registered in the Document Tracking System.',
                'closing' => 'Keep the DOTS No. for future reference. You can use it to monitor the document\'s routing progress.',
                'action' => 'View document',
                'tone' => 'success',
            ],
            default => [
                'status' => ucfirst(str_replace('_', ' ', $this->status)),
                'subject' => '[DOTS] Document status update: '.$this->subjectDocumentTitle(),
                'preheader' => 'There is an update to your document submission.',
                'label' => 'Status update',
                'heading' => 'There is an update to your document',
                'intro' => 'There is an update to your document submission.',
                'closing' => 'Open DOTS to view the latest status and available next steps.',
                'action' => 'View submission',
                'tone' => 'primary',
            ],
        };

        $details = [
            ['label' => 'Document', 'value' => $this->documentTitle],
            ['label' => 'Status', 'value' => $message['status']],
            ['label' => $this->status === 'registered' ? 'Version' : 'Version reviewed', 'value' => $this->versionNumber],
        ];

        if ($this->trackingNumber) {
            array_splice($details, 1, 0, [[
                'label' => 'DOTS No.',
                'value' => $this->trackingNumber,
            ]]);
        }

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
                    'details' => $details,
                    'remarks_label' => 'Reviewer remarks',
                    'remarks' => $this->remarks,
                    'closing' => $message['closing'],
                    'action_label' => $message['action'],
                    'action_url' => $this->status === 'registered'
                        ? route('documents.index')
                        : route('document-creation.index'),
                    'tone' => $message['tone'],
                ],
            );
        } catch (Throwable $exception) {
            Log::warning('Email document status notification attempt failed.', [
                'recipient' => $this->recipientHint(),
                'status' => $this->status,
                'version' => $this->versionNumber,
                'attempt' => $this->attempts(),
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            throw $exception;
        }

        Log::info('Email document status notification sent.', [
            'recipient' => $this->recipientHint(),
            'status' => $this->status,
            'version' => $this->versionNumber,
        ]);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Email document status notification failed after retries.', [
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

    private function subjectDocumentTitle(): string
    {
        return Str::limit(trim((string) preg_replace('/\s+/', ' ', $this->documentTitle)), 90);
    }
}
