<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentAccessOtpChallenge;
use App\Models\User;
use App\Services\AuditTrailWriter;
use App\Services\EmailNotificationMailer;
use App\Services\EmailNotificationSettings;
use App\Services\QrDocumentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class QrDocumentWorkflowController extends Controller
{
    public function requestOtp(Request $request, string $trackingNumber)
    {
        $validated = $request->validate(['email' => ['required', 'email:rfc', 'max:255']]);
        $document = $this->document($trackingNumber);
        $email = Str::lower(trim($validated['email']));
        $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->first();
        if (! $user) {
            throw ValidationException::withMessages([
                'email' => 'This email is not registered in DOTS. Check the address or contact the DOTS administrator.',
            ]);
        }

        $eligible = app(QrDocumentAccess::class)->eligibleStep($document, $user);
        if (! $eligible) {
            throw ValidationException::withMessages([
                'email' => 'This DOTS account is not eligible for the document’s current office route step. Check the account status, office assignment, role, and route status.',
            ]);
        }

        [, $step] = $eligible;
        $this->ensureResendCooldownHasElapsed($document, $user, 'email');
        $challengeId = $this->issueChallenge($request, $document, $user, $step->id);
        $resendAvailableAt = now()->addSeconds((int) config('qr_document.resend_cooldown_seconds', 60));

        $request->session()->put('qr_otp_pending', [
            'challenge_id' => $challengeId,
            'document_id' => $document->id,
            'tracking_number' => $document->tracking_number,
            'masked_email' => $this->maskEmail($email),
            'resend_available_at' => $resendAvailableAt->toIso8601String(),
        ]);

        return back()->with('success', 'A verification code was sent to your registered DOTS email.');
    }

    public function verifyOtp(Request $request, string $trackingNumber)
    {
        $validated = $request->validate(['code' => ['required', 'digits:6']]);
        $document = $this->document($trackingNumber);
        $pending = $request->session()->get('qr_otp_pending');

        if (! is_array($pending) || (int) ($pending['document_id'] ?? 0) !== (int) $document->id) {
            throw ValidationException::withMessages(['code' => 'Request a new verification code first.']);
        }

        $result = DB::transaction(function () use ($pending, $validated, $document) {
            $challenge = DocumentAccessOtpChallenge::query()->lockForUpdate()->find($pending['challenge_id'] ?? '');
            if (! $challenge || $challenge->invalidated_at || $challenge->verified_at || now()->gte($challenge->expires_at)) {
                return ['error' => 'The verification code is invalid or has expired.'];
            }

            $maximum = (int) config('qr_document.max_attempts', 5);
            $validCode = hash_equals($challenge->code_hash, $this->hashCode($validated['code']));
            if (! $validCode) {
                $challenge->increment('attempts');
                if ($challenge->attempts >= $maximum) {
                    $challenge->update(['invalidated_at' => now()]);
                }

                return ['error' => 'The verification code is invalid or has expired.'];
            }

            $user = $challenge->user()->firstOrFail();
            $eligible = app(QrDocumentAccess::class)->eligibleStep($document->load('routes.steps'), $user);
            if (! $eligible || (int) $eligible[1]->id !== (int) $challenge->document_route_step_id) {
                return ['error' => 'This route step is no longer available to your office.'];
            }

            if (! $user->email_verified_at) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            $challenge->update(['verified_at' => now()]);
            DocumentAccessOtpChallenge::query()
                ->where('document_id', $document->id)
                ->where('user_id', $user->id)
                ->whereKeyNot($challenge->id)
                ->whereNull('invalidated_at')
                ->update(['invalidated_at' => now()]);

            return ['challenge' => $challenge, 'user' => $user];
        });

        if (isset($result['error'])) {
            throw ValidationException::withMessages(['code' => $result['error']]);
        }

        $challenge = $result['challenge'];
        $user = $result['user'];
        $request->session()->regenerate();
        $request->session()->forget('qr_otp_pending');
        $request->session()->put('qr_document_access', [
            'document_id' => $document->id,
            'route_step_id' => $challenge->document_route_step_id,
            'user_id' => $user->id,
            'office_id' => $user->office_id,
            'verified_at' => now()->toIso8601String(),
            'expires_at' => now()->addMinutes((int) config('qr_document.session_ttl_minutes', 20))->toIso8601String(),
        ]);

        app(AuditTrailWriter::class)->record('document.qr_otp_authenticated', $document, [
            'tracking_number' => $document->tracking_number,
            'route_step_id' => $challenge->document_route_step_id,
            'authentication_method' => 'email_otp',
        ], actor: $user);

        return back()->with('success', 'Email verified. You can now process this document for your office.');
    }

    public function resendOtp(Request $request, string $trackingNumber)
    {
        $document = $this->document($trackingNumber);
        $pending = $request->session()->get('qr_otp_pending');
        if (! is_array($pending) || (int) ($pending['document_id'] ?? 0) !== (int) $document->id) {
            throw ValidationException::withMessages(['code' => 'Enter your registered official email first.']);
        }

        $challenge = DocumentAccessOtpChallenge::query()->find($pending['challenge_id'] ?? '');
        if ($challenge) {
            $user = $challenge->user()->first();
            $eligible = $user ? app(QrDocumentAccess::class)->eligibleStep($document->load('routes.steps'), $user) : null;
            if ($user && $eligible) {
                $this->ensureResendCooldownHasElapsed($document, $user, 'code');
                $pending['challenge_id'] = $this->issueChallenge($request, $document, $user, $eligible[1]->id, 'code');
                $pending['resend_available_at'] = now()
                    ->addSeconds((int) config('qr_document.resend_cooldown_seconds', 60))
                    ->toIso8601String();
                $request->session()->put('qr_otp_pending', $pending);
            }
        }

        return back()->with('success', 'If the email is still eligible, a new verification code was sent.');
    }

    public function endSession(Request $request, string $trackingNumber)
    {
        $this->document($trackingNumber);
        $request->session()->forget(['qr_document_access', 'qr_otp_pending']);

        return back()->with('success', 'QR document session ended.');
    }

    public function receive(Request $request, string $trackingNumber)
    {
        $document = $this->scopedDocument($request, $trackingNumber);

        return app(DocumentController::class)->receive($document->id);
    }

    public function decide(Request $request, string $trackingNumber)
    {
        $document = $this->scopedDocument($request, $trackingNumber);
        if ($request->input('decision') === 'approved' && $document->signature_status === 'needs_signature') {
            throw ValidationException::withMessages([
                'decision' => 'Upload the wet-signed PDF before approving, or complete the future iPluma signing flow.',
            ]);
        }

        $step = $request->attributes->get('qr_route_step');
        $response = app(DocumentController::class)->decideApproval($request, $document->id);

        if ($request->input('decision') === 'approved') {
            $sourceFile = $document->files()->whereIn('type', ['original', 'version'])->latest('id')->first();
            $step?->update(['approved_document_file_id' => $sourceFile?->id]);
        }

        return $response;
    }

    public function uploadWetSignedAndApprove(Request $request, string $trackingNumber)
    {
        $validated = $request->validate([
            'signed_file' => ['required', 'file', 'mimes:pdf', 'max:102400'],
            'remarks' => ['nullable', 'string', 'max:4000'],
        ]);
        $document = $this->scopedDocument($request, $trackingNumber);
        $user = $request->user();
        $step = $request->attributes->get('qr_route_step');

        abort_unless(app(QrDocumentAccess::class)->canApprove($document, $user, $step), 403);
        abort_unless($document->signature_status === 'needs_signature', 422, 'This document does not require a signed PDF.');

        $upload = $validated['signed_file'];
        $path = $upload->storeAs(
            'documents/'.$document->id.'/signed',
            Str::uuid().'.pdf',
            'document_private',
        );
        $sourceFile = $document->files()->whereIn('type', ['original', 'version'])->latest('id')->first();
        $signedFile = null;

        try {
            $signedFile = $document->files()->create([
                'source_document_file_id' => $sourceFile?->id,
                'route_step_id' => $step->id,
                'type' => 'signed',
                'signature_method' => 'wet_ink',
                'file_name' => basename($path),
                'original_name' => $upload->getClientOriginalName(),
                'file_path' => $path,
                'mime_type' => 'application/pdf',
                'size_bytes' => $upload->getSize(),
                'sha256' => hash_file('sha256', Storage::disk('document_private')->path($path)),
                'uploaded_by' => $user->id,
            ]);

            $request->merge(['decision' => 'approved', 'remarks' => $validated['remarks'] ?? null]);
            $response = app(DocumentController::class)->decideApproval($request, $document->id);
            $step->update([
                'approved_document_file_id' => $signedFile->id,
                'signed_document_file_id' => $signedFile->id,
            ]);
            $document->update(['signature_status' => 'signed']);
            app(AuditTrailWriter::class)->record('document.wet_signed_pdf_uploaded', $document, [
                'tracking_number' => $document->tracking_number,
                'route_step_id' => $step->id,
                'source_document_file_id' => $sourceFile?->id,
                'signed_document_file_id' => $signedFile->id,
                'sha256' => $signedFile->sha256,
            ], actor: $user);

            return $response;
        } catch (\Throwable $exception) {
            $signedFile?->delete();
            Storage::disk('document_private')->delete($path);
            throw $exception;
        }
    }

    public function forward(Request $request, string $trackingNumber)
    {
        $document = $this->scopedDocument($request, $trackingNumber);
        abort_unless($request->user()->isAdministrator(), 403, 'Your role cannot forward documents from the QR workflow.');

        return app(DocumentController::class)->release($request, $document->id);
    }

    public function viewFile(Request $request, string $trackingNumber, int $file)
    {
        $document = $this->scopedDocument($request, $trackingNumber);

        return app(DocumentController::class)->viewFile($document->id, $file);
    }

    public function downloadFile(Request $request, string $trackingNumber, int $file)
    {
        $document = $this->scopedDocument($request, $trackingNumber);

        return app(DocumentController::class)->downloadFile($document->id, $file);
    }

    private function issueChallenge(
        Request $request,
        Document $document,
        User $user,
        int $stepId,
        string $validationKey = 'email',
    ): string
    {
        if (! app(EmailNotificationSettings::class)->automatedEnabled()) {
            throw ValidationException::withMessages([
                $validationKey => 'Email delivery is currently paused by the DOTS administrator. A verification code cannot be sent until email delivery is enabled.',
            ]);
        }

        DocumentAccessOtpChallenge::query()
            ->where('document_id', $document->id)
            ->where('user_id', $user->id)
            ->whereNull('invalidated_at')
            ->update(['invalidated_at' => now()]);

        $code = (string) random_int(100000, 999999);
        $challenge = DocumentAccessOtpChallenge::query()->create([
            'document_id' => $document->id,
            'document_route_step_id' => $stepId,
            'user_id' => $user->id,
            'office_id' => $user->office_id,
            'email_hash' => hash('sha256', Str::lower($user->email)),
            'code_hash' => $this->hashCode($code),
            'expires_at' => now()->addMinutes((int) config('qr_document.otp_ttl_minutes', 10)),
            'sent_at' => now(),
            'request_ip_hash' => $request->ip() ? hash('sha256', $request->ip()) : null,
        ]);

        try {
            app(EmailNotificationMailer::class)->sendSecurityCode(
                $user->email,
                $user->name,
                $code,
                $document->tracking_number,
            );
        } catch (\Throwable $exception) {
            $challenge->update(['invalidated_at' => now()]);
            throw ValidationException::withMessages(['email' => 'The verification email could not be sent. Please contact the DOTS administrator.']);
        }

        return $challenge->id;
    }

    private function ensureResendCooldownHasElapsed(Document $document, User $user, string $validationKey): void
    {
        $lastSentAt = DocumentAccessOtpChallenge::query()
            ->where('document_id', $document->id)
            ->where('user_id', $user->id)
            ->latest('sent_at')
            ->value('sent_at');
        if (! $lastSentAt) {
            return;
        }

        $availableAt = Carbon::parse($lastSentAt)
            ->addSeconds((int) config('qr_document.resend_cooldown_seconds', 60));
        if (now()->gte($availableAt)) {
            return;
        }

        $seconds = max(1, (int) ceil(now()->floatDiffInSeconds($availableAt)));
        throw ValidationException::withMessages([
            $validationKey => "Please wait {$seconds} seconds before requesting a new verification code.",
        ]);
    }

    private function hashCode(string $code): string
    {
        return hash_hmac('sha256', $code, (string) config('app.key'));
    }

    private function document(string $trackingNumber): Document
    {
        return Document::query()->where('tracking_number', $trackingNumber)->where('is_finalized', true)->firstOrFail();
    }

    private function scopedDocument(Request $request, string $trackingNumber): Document
    {
        $document = $request->attributes->get('qr_document');
        abort_unless($document && hash_equals($document->tracking_number, $trackingNumber), 403);

        return $document;
    }

    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = mb_substr($local, 0, min(2, mb_strlen($local)));

        return $visible.str_repeat('*', max(3, mb_strlen($local) - mb_strlen($visible))).'@'.$domain;
    }
}
