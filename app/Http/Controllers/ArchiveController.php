<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Office;
use App\Services\DocumentAccess;
use Inertia\Inertia;

class ArchiveController extends Controller
{
    public function index()
    {
        $access = app(DocumentAccess::class);
        $canFilterOffices = $access->canViewAllDocuments(auth()->user());
        if (request()->filled('office_id')) {
            abort_unless($canFilterOffices, 403);
        }
        $filters = request()->validate([
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'year' => ['nullable', 'integer', 'in:2022,2023,2024,2025,2026'],
            'sort' => ['nullable', 'in:newest,oldest,bureau_asc,bureau_desc'],
        ]);
        $officeId = ! empty($filters['office_id']) ? (int) $filters['office_id'] : null;
        $year = isset($filters['year']) ? (int) $filters['year'] : null;
        $sort = $filters['sort'] ?? 'newest';
        $query = $access->scope(Document::query(), auth()->user())
            ->select([
                'documents.id', 'documents.title', 'documents.tracking_number', 'documents.office_id',
                'documents.status', 'documents.is_finalized', 'documents.remarks', 'documents.origin_type',
                'documents.document_type_id', 'documents.other_document_type', 'documents.purpose_type_id', 'documents.created_at',
            ])
            ->with(['office:id,name,short_name', 'documentType:id,name', 'purposeType:id,name'])
            ->where('is_archived', true)
            ->when($officeId !== null, fn ($q) => $q->where('office_id', $officeId))
            ->when($year !== null, fn ($q) => $q
                ->where('documents.created_at', '>=', "$year-01-01")
                ->where('documents.created_at', '<', ($year + 1).'-01-01'));
        if (in_array($sort, ['bureau_asc', 'bureau_desc'], true)) {
            $query->orderBy(Office::select('name')->whereColumn('offices.id', 'documents.office_id')->limit(1), $sort === 'bureau_asc' ? 'asc' : 'desc');
        }
        $documents = $query->orderBy('documents.created_at', $sort === 'oldest' ? 'asc' : 'desc')
            ->orderBy('documents.id', $sort === 'oldest' ? 'asc' : 'desc')
            ->paginate(25)
            ->withQueryString()
            ->through(fn (Document $document) => [
                'id' => $document->id,
                'title' => $document->title ?? '',
                'tracking_number' => $document->tracking_number ?? '',
                'tracking_url' => $document->tracking_number ? route('documents.track', ['trackingNumber' => $document->tracking_number]) : null,
                'office' => $document->office,
                'office_name' => $document->office?->name ?? '',
                'office_short_name' => $document->office?->short_name,
                'document_type' => $document->documentType?->name ?? '',
                'other_document_type' => $document->other_document_type,
                'purpose_type' => $document->purposeType?->name ?? '',
                'origin_type' => $document->origin_type ?? '',
                'status' => 'archived',
                'remarks' => $document->remarks ?? '',
                'is_finalized' => (bool) $document->is_finalized,
                'created_at' => $document->created_at?->format('F j Y h:i:s A'),
            ]);

        return Inertia::render('Archives/Index', [
            'documents' => $documents,
            'canFilterOffices' => $canFilterOffices,
            'offices' => $canFilterOffices ? Office::orderBy('name')->get(['id', 'name']) : [],
            'filters' => ['office_id' => $officeId, 'year' => $year, 'sort' => $sort],
        ]);
    }

    public function categories()
    {
        return Inertia::render('Archives/Index', [
            'title' => 'Archive Categories',
        ]);
    }
}
