<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Inertia\Inertia;

class PublicDocumentTrackingController extends Controller
{
    public function show(string $trackingNumber)
    {
        $document = Document::query()
            ->where('tracking_number', $trackingNumber)
            ->where('is_finalized', true)
            ->with(['office:id,name', 'documentType:id,name', 'purposeType:id,name', 'trails.fromOffice:id,name', 'trails.toOffice:id,name', 'files'])
            ->first();

        if ($document) {
            return Inertia::render('PublicTracking/Show', [
                'document' => [
                    'tracking_number' => $document->tracking_number,
                    'title' => $document->title,
                    'status' => $document->status,
                    'document_type' => $document->other_document_type ?: $document->documentType?->name,
                    'purpose' => $document->other_purpose ?: $document->purposeType?->name,
                    'office_name' => $document->office?->name,
                    'created_at' => $document->created_at?->format('F j, Y g:i A'),
                    'trails' => $document->trails->sortBy([['created_at', 'asc'], ['id', 'asc']])->values()->map(fn ($trail) => [
                        'action' => $trail->action ?: ucfirst((string) $trail->status),
                        'status' => $trail->status,
                        'from_office' => $trail->fromOffice?->name,
                        'to_office' => $trail->toOffice?->name,
                        'created_at' => $trail->created_at?->format('F j, Y g:i A'),
                    ]),
                    'files' => $document->files->sortBy('id')->values()->map(fn ($file) => [
                        'name' => $file->original_name ?: $file->file_name,
                        'type' => $file->type ?: 'original',
                        'mime_type' => $file->mime_type,
                        'url' => $file->downloadUrl(),
                    ]),
                ],
            ]);
        }

        abort(404);
    }
}
