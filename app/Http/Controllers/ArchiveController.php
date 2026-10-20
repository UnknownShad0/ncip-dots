<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use App\Services\AuditTrailWriter;
use App\Models\Office;
use App\Services\DocumentAccess;
use Inertia\Inertia;

class ArchiveController extends Controller
{
    public function index()
    {
        if (request()->query('source') === 'generation') {
            return $this->generated();
        }
        $access = app(DocumentAccess::class);
        $canFilterOffices = $access->canViewAllDocuments(auth()->user());
        if (request()->filled('office_id')) {
            abort_unless($canFilterOffices, 403);
        }
        $filters = request()->validate([
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'year' => ['nullable', 'integer', 'in:2022,2023,2024,2025,2026'],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:newest,oldest,bureau_asc,bureau_desc'],
        ]);
        $officeId = ! empty($filters['office_id']) ? (int) $filters['office_id'] : null;
        $year = isset($filters['year']) ? (int) $filters['year'] : null;
        $search = trim($filters['search'] ?? '');
        $sort = $filters['sort'] ?? 'newest';
        $query = $access->scope(Document::query(), auth()->user())
            ->select([
                'documents.id', 'documents.title', 'documents.tracking_number', 'documents.office_id',
                'documents.status', 'documents.is_finalized', 'documents.remarks', 'documents.origin_type',
                'documents.created_at', 'documents.archived_at', 'documents.legacy_needs_review',
            ])
            ->with(['office:id,name,short_name', 'latestTrail'])
            ->where('is_archived', true)
            ->when($officeId !== null, fn ($q) => $q->where('office_id', $officeId))
            ->when($search !== '', fn ($q) => $q->where(fn ($matching) => $matching
                ->where('documents.title', 'like', "$search%")
                ->orWhere('documents.tracking_number', 'like', "$search%")))
            ->when($year !== null, fn ($q) => $q
                ->where('documents.created_at', '>=', "$year-01-01")
                ->where('documents.created_at', '<', ($year + 1).'-01-01'));
        if (in_array($sort, ['bureau_asc', 'bureau_desc'], true)) {
            $query->orderBy(Office::select('name')->whereColumn('offices.id', 'documents.office_id')->limit(1), $sort === 'bureau_asc' ? 'asc' : 'desc');
        }
        $documents = $query->orderBy('documents.created_at', $sort === 'oldest' ? 'asc' : 'desc')
            ->orderBy('documents.id', $sort === 'oldest' ? 'asc' : 'desc')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Document $document) => [
                'id' => $document->id,
                'title' => $document->title ?? '',
                'tracking_number' => $document->tracking_number ?? '',
                'tracking_url' => $document->tracking_number ? URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]) : null,
                'office' => $document->office,
                'office_name' => $document->office?->name ?? '',
                'office_short_name' => $document->office?->short_name,
                'origin_type' => $document->origin_type ?? '',
                'status' => $document->status ?? 'archived',
                'remarks' => $document->remarks ?? '',
                'is_finalized' => (bool) $document->is_finalized,
                'created_at' => $document->created_at?->format('F j Y h:i:s A'),
                'archived_at' => $document->archived_at?->toDateTimeString(),
                'can_restore' => $this->canRestore($document),
            ]);

        return Inertia::render('Archives/Index', [
            'documents' => $documents,
            'source' => 'tracking',
            'canFilterOffices' => $canFilterOffices,
            'offices' => $canFilterOffices ? Office::orderBy('name')->get(['id', 'name']) : [],
            'filters' => ['office_id' => $officeId, 'year' => $year, 'search' => $search, 'sort' => $sort],
        ]);
    }

    private function generated()
    {
        $filters = request()->validate(['search' => ['nullable', 'string', 'max:100']]);
        $search = trim($filters['search'] ?? '');
        $documents = DocumentCreationDraft::query()
            ->where('created_by', auth()->id())
            ->whereNotNull('archived_at')
            ->with('documentType:id,name')
            ->when($search !== '', fn ($q) => $q->where(fn ($matching) => $matching
                ->where('title', 'like', "%$search%")
                ->orWhereHas('documentType', fn ($type) => $type->where('name', 'like', "%$search%"))))
            ->orderByDesc('archived_at')->orderByDesc('id')->paginate(10)->withQueryString()
            ->through(fn (DocumentCreationDraft $draft) => [
                'id' => $draft->id, 'title' => $draft->title, 'status' => $draft->status,
                'document_type' => $draft->documentType?->name,
                'archived_at' => $draft->archived_at?->toDateTimeString(),
                'can_restore' => true,
                'preview_url' => route('document-creation.preview-submission', $draft),
            ]);

        return Inertia::render('Archives/Index', [
            'documents' => $documents, 'source' => 'generation',
            'filters' => ['office_id' => null, 'year' => null, 'search' => $search, 'sort' => 'newest'],
        ]);
    }

    private function canRestore(Document $document): bool
    {
        $latest = $document->latestTrail;
        // Only reopen a terminal record with a known holding office.
        return $document->is_archived && ! $document->legacy_needs_review
            && $document->status === 'terminal' && $latest?->status === 'terminal'
            && $latest->action === 'Tagged as Terminal' && $latest->from_office_id
            && (int) $latest->from_office_id === (int) app(DocumentAccess::class)->currentOfficeId(auth()->user());
    }

    public function restore(Document $document)
    {
        DB::transaction(function () use ($document) {
            $document = Document::query()->lockForUpdate()->findOrFail($document->id);
            abort_unless($this->canRestore($document), 403);
            $officeId = $document->latestTrail->from_office_id;
            $document->update(['is_archived' => false, 'archived_at' => null, 'status' => 'pending']);
            $document->trails()->create([
                'from_office_id' => $officeId, 'to_office_id' => $officeId,
                'created_by' => auth()->id(), 'status' => 'pending', 'action' => 'Restored from archive',
            ]);
            app(AuditTrailWriter::class)->record('document.restored', $document, ['tracking_number' => $document->tracking_number]);
        });

        return back()->with('success', 'Document restored to the holding office.');
    }

    public function categories()
    {
        return Inertia::render('Archives/Index', [
            'title' => 'Archive Categories',
        ]);
    }
}
