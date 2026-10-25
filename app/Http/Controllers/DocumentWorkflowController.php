<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Services\DocumentAccess;
use App\Support\DateTimePresenter;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;

class DocumentWorkflowController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $search = trim((string) $request->query('search', ''));

        $readyQuery = DocumentCreationDraft::query()
            ->with('documentType:id,name')
            ->where('created_by', $user->id)
            ->whereNull('archived_at')
            ->where(function (Builder $ready) {
                $ready->whereIn('status', ['ready_for_routing', 'approved', 'awaiting_verification', 'verified', 'registered'])
                    ->orWhere('status', 'revision_requested');
            });
        $this->searchDrafts($readyQuery, $search);

        $submissionQuery = Document::query()
            ->with(['documentType:id,name', 'latestTrail.toOffice:id,name,short_name'])
            ->where('created_by', $user->id)
            ->whereIn('approval_status', ['awaiting_approval', 'changes_requested', 'rejected']);
        $this->searchDocuments($submissionQuery, $search);

        $approvedQuery = Document::query()
            ->with(['documentType:id,name', 'latestTrail.toOffice:id,name,short_name'])
            ->where('created_by', $user->id)
            ->where('approval_status', 'approved');
        $this->searchDocuments($approvedQuery, $search);

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        $canReview = $user->is_active && $user->isAdministrator() && $officeId !== null;
        $approvalQuery = Document::query()
            ->with(['documentType:id,name', 'latestTrail.toOffice:id,name,short_name'])
            ->where('approval_status', 'awaiting_approval')
            ->where('is_archived', false)
            ->where('legacy_needs_review', false)
            ->where('created_by', '!=', $user->id)
            ->whereHas('latestTrail', fn (Builder $trail) => $trail
                ->where('status', 'pending')
                ->where('to_office_id', $officeId));
        if (! $canReview) {
            $approvalQuery->whereRaw('1 = 0');
        }
        $this->searchDocuments($approvalQuery, $search);

        $ready = $readyQuery->latest()->paginate(10, ['*'], 'ready_page')->withQueryString();
        $submissions = $submissionQuery->latest()->paginate(10, ['*'], 'submission_page')->withQueryString();
        $approvals = $approvalQuery->latest()->paginate(10, ['*'], 'approval_page')->withQueryString();
        $approved = $approvedQuery->latest()->paginate(10, ['*'], 'approved_page')->withQueryString();

        return Inertia::render('DocumentWorkflow/Index', [
            'search' => $search,
            'readyDocuments' => $ready->getCollection()->map(fn (DocumentCreationDraft $draft) => [
                'id' => $draft->id,
                'title' => $draft->title,
                'document_type' => $draft->documentType?->name,
                'status' => $draft->status === 'revision_requested' ? 'revision_requested' : 'ready_for_routing',
                'version_number' => $draft->version_number,
                'official_document_id' => $draft->official_document_id,
                'can_edit' => $draft->status !== 'revision_requested',
                'preview_url' => route('document-creation.preview-submission', $draft),
                'updated_at' => DateTimePresenter::format($draft->updated_at, 'M j, Y g:i A'),
            ])->values(),
            'readyPagination' => $this->pagination($ready),
            'mySubmissions' => $this->mapDocuments($submissions),
            'submissionPagination' => $this->pagination($submissions),
            'approvalTasks' => $this->mapDocuments($approvals),
            'approvalPagination' => $this->pagination($approvals),
            'approvedDocuments' => $this->mapDocuments($approved),
            'approvedPagination' => $this->pagination($approved),
            'canReview' => $canReview,
        ]);
    }

    private function searchDrafts(Builder $query, string $search): void
    {
        if ($search === '') return;
        $query->where(fn (Builder $matches) => $matches
            ->where('title', 'like', '%'.$search.'%')
            ->orWhereHas('documentType', fn (Builder $type) => $type->where('name', 'like', '%'.$search.'%')));
    }

    private function searchDocuments(Builder $query, string $search): void
    {
        if ($search === '') return;
        $query->where(fn (Builder $matches) => $matches
            ->where('title', 'like', '%'.$search.'%')
            ->orWhere('tracking_number', 'like', '%'.$search.'%')
            ->orWhereHas('documentType', fn (Builder $type) => $type->where('name', 'like', '%'.$search.'%')));
    }

    private function mapDocuments(LengthAwarePaginator $page): array
    {
        $draftIds = DocumentCreationDraft::query()
            ->whereIn('official_document_id', $page->getCollection()->pluck('id'))
            ->where('status', 'revision_requested')
            ->pluck('id', 'official_document_id');

        return $page->getCollection()->map(fn (Document $document) => [
            'id' => $document->id,
            'revision_draft_id' => $draftIds->get($document->id),
            'title' => $document->title,
            'tracking_number' => $document->tracking_number,
            'document_type' => $document->documentType?->name,
            'approval_status' => $document->approval_status,
            'signature_status' => $document->signature_status,
            'office' => $document->latestTrail?->toOffice?->short_name ?: $document->latestTrail?->toOffice?->name,
            'updated_at' => DateTimePresenter::format($document->updated_at, 'M j, Y g:i A'),
        ])->values()->all();
    }

    private function pagination(LengthAwarePaginator $page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            'per_page' => $page->perPage(),
        ];
    }
}
