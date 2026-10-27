<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\TemporaryDocumentUpload;
use App\Services\DocumentAccess;
use App\Services\StagedDocumentUploadService;
use App\Services\TrackingNumberPdfStamper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StagedDocumentUploadController extends Controller
{
    public function store(Request $request, StagedDocumentUploadService $uploads)
    {
        $validated = $request->validate([
            'purpose' => ['required', 'in:document,supporting,version,signed_pdf'],
            'document_id' => ['nullable', 'required_if:purpose,version,signed_pdf', 'integer', 'exists:documents,id'],
        ]);
        $fileRules = ['required', 'file', 'max:102400'];
        $fileRules[] = $validated['purpose'] === 'signed_pdf'
            ? 'mimes:pdf'
            : 'mimes:pdf,jpg,jpeg,png,doc,docx';
        $request->validate(['file' => $fileRules]);
        $user = $request->user();
        $uploads->purgeExpired((int) $user->id);

        if ($validated['purpose'] === 'supporting' && ! empty($validated['document_id'])) {
            throw ValidationException::withMessages(['document_id' => 'Supporting files can only be staged for a new routing record.']);
        }

        if (! empty($validated['document_id'])) {
            $document = app(DocumentAccess::class)->scope(Document::query(), $user)->findOrFail($validated['document_id']);
            if ($validated['purpose'] === 'document') {
                $currentOfficeId = app(DocumentAccess::class)->currentOfficeId($user);
                $isCreatorInOriginOffice = (int) $document->created_by === (int) $user->id
                    && (int) $document->office_id === (int) $currentOfficeId;
                abort_unless(! $document->is_finalized
                    && strtolower((string) $document->status) === 'draft'
                    && ($user->isAdministrator() || $isCreatorInOriginOffice), 403);
            }
        } elseif (in_array($validated['purpose'], ['version', 'signed_pdf'], true)) {
            throw ValidationException::withMessages(['document_id' => 'Select the document before uploading this file.']);
        }

        if (TemporaryDocumentUpload::query()->where('user_id', $user->id)->where('expires_at', '>', now())->count() >= 10) {
            throw ValidationException::withMessages(['file' => 'Remove an uploaded file or wait for unused uploads to expire before adding another.']);
        }

        $file = $request->file('file');
        if (strtolower($file->getClientOriginalExtension()) === 'pdf') {
            try {
                app(TrackingNumberPdfStamper::class)->validateSource((string) $file->getRealPath());
            } catch (\Throwable $exception) {
                report($exception);
                throw ValidationException::withMessages([
                    'file' => 'DOTS could not read this PDF. It may be damaged, incomplete, password-protected, or use unsupported PDF features. Re-save it as a new PDF and try again.',
                ]);
            }
        }

        $token = (string) Str::uuid();
        $extension = strtolower($file->getClientOriginalExtension() ?: 'bin');
        $path = 'temporary-document-uploads/'.$user->id.'/'.$token.'.'.$extension;
        if (! Storage::disk('document_private')->putFileAs(dirname($path), $file, basename($path))) {
            throw ValidationException::withMessages(['file' => 'The file could not be uploaded. Please try again.']);
        }

        try {
            $upload = TemporaryDocumentUpload::query()->create([
                'token' => $token,
                'user_id' => $user->id,
                'document_id' => $validated['document_id'] ?? null,
                'purpose' => $validated['purpose'],
                'file_path' => $path,
                'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                'mime_type' => $file->getMimeType(),
                'size_bytes' => $file->getSize(),
                'expires_at' => now()->addHours(6),
            ]);
        } catch (\Throwable $exception) {
            Storage::disk('document_private')->delete($path);
            throw $exception;
        }

        return response()->json([
            'token' => $upload->token,
            'original_name' => $upload->original_name,
            'size_bytes' => $upload->size_bytes,
            'expires_at' => $upload->expires_at->toIso8601String(),
        ], 201);
    }

    public function destroy(Request $request, string $token, StagedDocumentUploadService $uploads)
    {
        $uploads->deleteOwned($token, (int) $request->user()->id);

        return response()->noContent();
    }
}
