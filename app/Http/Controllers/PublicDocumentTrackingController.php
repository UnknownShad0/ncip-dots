<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Document;
use App\Models\DocumentLegacy;
use App\Models\DocumentTrailLegacy;
use App\Support\LegacyDocumentTypeMap;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
                        'url' => Storage::disk('public')->url($file->file_path),
                    ]),
                ],
            ]);
        }

        try {
            $legacyDocument = DocumentLegacy::query()->where('trackingNo', $trackingNumber)->first();
            if (! $legacyDocument) {
                abort(404);
            }

            $trails = DocumentTrailLegacy::query()
                ->where('trackingNo', $trackingNumber)
                ->orderBy('dateCreated')
                ->orderBy('docTrailId')
                ->get(['docTrailId', 'status', 'action', 'dateCreated', 'originating', 'receiving', 'holder']);
            $officeIds = $trails->flatMap(fn ($trail) => [$trail->originating, $trail->receiving, $trail->holder])->filter()->unique();
            $offices = BureauLegacy::query()->whereIn('bureauId', $officeIds)->get(['bureauId', 'longName', 'shortName'])->keyBy('bureauId');
            $documentType = $legacyDocument->dtId
                ? LegacyDocumentTypeMap::typesByLegacyId()->get($legacyDocument->dtId)?->name
                : null;
            $files = DB::connection('legacy')->table('file')->where('docId', $legacyDocument->docId)
                ->orderBy('fileId')
                ->get(['fileName', 'origName', 'type', 'dateUploaded']);

            return Inertia::render('PublicTracking/Show', [
                'document' => [
                    'tracking_number' => $legacyDocument->trackingNo,
                    'title' => $legacyDocument->title,
                    'status' => $legacyDocument->status ?: $trails->last()?->status,
                    'document_type' => $legacyDocument->otherDtype ?: $documentType,
                    'purpose' => $legacyDocument->purpose,
                    'office_name' => $offices->get($trails->first()?->originating)?->longName,
                    'created_at' => $legacyDocument->dateCreated?->format('F j, Y g:i A'),
                    'trails' => $trails->map(fn ($trail) => [
                        'action' => $trail->action ?: ucfirst((string) $trail->status),
                        'status' => $trail->status,
                        'from_office' => $offices->get($trail->originating)?->shortName ?: $offices->get($trail->originating)?->longName,
                        'to_office' => $offices->get($trail->receiving)?->shortName ?: $offices->get($trail->receiving)?->longName,
                        'holder' => $offices->get($trail->holder)?->shortName ?: $offices->get($trail->holder)?->longName,
                        'created_at' => $trail->dateCreated?->format('F j, Y g:i A'),
                    ]),
                    'files' => $files->map(fn ($file) => [
                        'name' => $file->origName ?: $file->fileName,
                        'type' => $file->type ?: 'original',
                    ]),
                ],
            ]);
        } catch (QueryException $exception) {
            report($exception);
            abort(404);
        }
    }
}
