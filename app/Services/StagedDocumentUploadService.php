<?php

namespace App\Services;

use App\Models\TemporaryDocumentUpload;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;

class StagedDocumentUploadService
{
    public function attachSingle(
        Request $request,
        string $tokenField,
        string $fileField,
        string $purpose,
        int $userId,
        ?int $documentId = null,
    ): ?string {
        $token = $request->input($tokenField);
        if (! filled($token)) {
            return null;
        }
        if (! is_string($token)) {
            throw ValidationException::withMessages([$fileField => 'The temporary upload is invalid. Upload the file again.']);
        }

        // Read the raw Symfony file bag here. Request::hasFile() caches converted
        // files, so calling it before inserting a staged file can leave that cache stale.
        if ($request->files->get($fileField)) {
            throw ValidationException::withMessages([$fileField => 'Send either the temporary upload or the file, not both.']);
        }

        $upload = $this->findOwnedUpload((string) $token, $purpose, $userId, $documentId, $fileField);
        $this->attachFile($request, $fileField, $upload);
        $request->request->remove($tokenField);

        return $upload->token;
    }

    /** @return list<string> */
    public function attachMany(
        Request $request,
        string $tokenField,
        string $fileField,
        string $purpose,
        int $userId,
    ): array {
        $tokens = $request->input($tokenField, []);
        if (! is_array($tokens)) {
            throw ValidationException::withMessages([$tokenField => 'The temporary uploads are invalid.']);
        }

        if ($tokens === []) {
            $request->request->remove($tokenField);

            return [];
        }
        if (collect($tokens)->contains(fn ($token) => ! is_string($token))) {
            throw ValidationException::withMessages([$tokenField => 'The temporary uploads are invalid.']);
        }
        if (count($tokens) !== count(array_unique($tokens))) {
            throw ValidationException::withMessages([$tokenField => 'The same temporary file cannot be attached more than once.']);
        }

        if ($request->files->get($fileField)) {
            throw ValidationException::withMessages([$fileField => 'Send either temporary uploads or files, not both.']);
        }

        $files = [];
        $ownedTokens = [];
        foreach ($tokens as $token) {
            if (! is_string($token)) {
                throw ValidationException::withMessages([$tokenField => 'The temporary uploads are invalid.']);
            }
            $upload = $this->findOwnedUpload($token, $purpose, $userId, null, $fileField);
            $files[] = $this->uploadedFile($upload);
            $ownedTokens[] = $upload->token;
        }

        $request->files->set($fileField, $files);
        $request->request->remove($tokenField);

        return $ownedTokens;
    }

    /** @param list<string> $tokens */
    public function consume(array $tokens, int $userId): void
    {
        if ($tokens === []) {
            return;
        }

        $uploads = TemporaryDocumentUpload::query()
            ->where('user_id', $userId)
            ->whereIn('token', array_unique($tokens))
            ->get();

        foreach ($uploads as $upload) {
            $this->deleteUpload($upload);
        }
    }

    public function deleteOwned(string $token, int $userId): void
    {
        $upload = TemporaryDocumentUpload::query()->where('token', $token)->where('user_id', $userId)->first();
        if ($upload) {
            $this->deleteUpload($upload);
        }
    }

    public function purgeExpired(?int $userId = null): int
    {
        $query = TemporaryDocumentUpload::query()->where('expires_at', '<=', now());
        if ($userId !== null) {
            $query->where('user_id', $userId);
        }

        $uploads = $query->get();
        foreach ($uploads as $upload) {
            $this->deleteUpload($upload);
        }

        return $uploads->count();
    }

    private function findOwnedUpload(string $token, string $purpose, int $userId, ?int $documentId, string $field): TemporaryDocumentUpload
    {
        if (! Str::isUuid($token)) {
            throw ValidationException::withMessages([$field => 'The temporary upload expired or is invalid. Upload the file again.']);
        }

        $upload = TemporaryDocumentUpload::query()
            ->where('token', $token)
            ->where('user_id', $userId)
            ->where('purpose', $purpose)
            ->where('document_id', $documentId)
            ->where('expires_at', '>', now())
            ->first();

        if (! $upload || ! Storage::disk('document_private')->exists($upload->file_path)) {
            throw ValidationException::withMessages([$field => 'The temporary upload expired or is unavailable. Upload the file again.']);
        }

        return $upload;
    }

    private function attachFile(Request $request, string $field, TemporaryDocumentUpload $upload): void
    {
        $request->files->set($field, $this->uploadedFile($upload));
    }

    private function uploadedFile(TemporaryDocumentUpload $upload): UploadedFile
    {
        return new UploadedFile(
            Storage::disk('document_private')->path($upload->file_path),
            $upload->original_name,
            $upload->mime_type,
            null,
            true,
        );
    }

    private function deleteUpload(TemporaryDocumentUpload $upload): void
    {
        Storage::disk('document_private')->delete($upload->file_path);
        $upload->delete();
    }
}
