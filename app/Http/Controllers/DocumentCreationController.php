<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\GmailConnection;
use App\Models\DocumentCreationVersion;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\User;
use App\Services\AuditTrailWriter;
use App\Services\DocumentTemplates;
use App\Jobs\SendDocumentStatusEmail;
use App\Jobs\SendDocumentApprovalRequestEmail;
use App\Services\DocumentPdf;
use App\Services\DocumentMetadata;
use App\Services\RichDocumentContent;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class DocumentCreationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $userOffice = $this->userOffice($user);
        $canReviewOfficeApprovals = $user->is_active && $user->isAdministrator() && $userOffice !== null;
        $approvedOnly = $request->query('queue') === 'approved';
        $queue = (string) $request->query('queue', '');

        if (! $approvedOnly && $queue === 'verification') {
            return redirect()->route('approved-documents.index', ['status' => 'awaiting_verification']);
        }

        $relations = [
            'creator:id,name,firstname,lastname,office_id',
            'creator.office:id,name',
            'approver:id,name,firstname,lastname',
            'approverOffice:id,name,short_name',
            'decisionMaker:id,name,firstname,lastname',
            'documentType:id,name',
            'events.user:id,name,firstname,lastname,office_id,office_code',
            'events.user.office:id,name,short_name',
            'events.user.officeByCode:id,name,short_name',
        ];

        $workStatuses = ['pending_approval', 'revision_requested', 'rejected'];
        $approvedStatuses = ['approved', 'awaiting_verification', 'verified', 'registered'];
        $approvedStatus = (string) $request->query('status', 'all');
        $approvedSearch = trim((string) $request->query('search', ''));

        if ($approvedOnly) {
            $approvedQuery = DocumentCreationDraft::query()->with($relations)
                ->where('created_by', $user->id)
                ->whereIn('status', $approvedStatuses)
                ->whereNull('archived_at');

            if (in_array($approvedStatus, $approvedStatuses, true)) {
                $approvedQuery->where('status', $approvedStatus);
            } else {
                $approvedStatus = 'all';
            }
            $this->applyDraftSearch($approvedQuery, $approvedSearch);

            $drafts = $this->prepareDraftPage(
                $approvedQuery->latest()->paginate(5)->withQueryString(),
                $user,
                $userOffice,
                $canReviewOfficeApprovals,
            );

            return Inertia::render('DocumentCreation/Index', [
                'drafts' => $drafts->items(),
                'draftsPagination' => $this->paginationSummary($drafts),
                'approvalTasks' => null,
                'approvalTasksPagination' => null,
                'documentTypes' => [],
                'savedDraftId' => session('savedDraftId'),
                'approverOffices' => [],
                'currentUserId' => $user->id,
                'footerOfficeName' => DocumentMetadata::officeName($user),
                'approvedOnly' => true,
                'canReviewOfficeApprovals' => $canReviewOfficeApprovals,
                'filters' => [
                    'queue' => 'approved',
                    'search' => $approvedSearch,
                    'status' => $approvedStatus,
                    'page' => $drafts->currentPage(),
                ],
            ]);
        }

        $myStatus = (string) $request->query('my_status', match ($queue) {
            'submitted' => 'pending_approval',
            'revision' => 'revision_requested',
            default => 'all',
        });
        if (! in_array($myStatus, [...$workStatuses, 'all'], true)) {
            $myStatus = 'all';
        }
        $mySearch = trim((string) $request->query('my_search', ''));
        $approvalSearch = trim((string) $request->query('approval_search', ''));
        $draftToEdit = null;
        if ($request->filled('edit_draft_id')) {
            $draftToEdit = DocumentCreationDraft::query()
                ->whereKey($request->integer('edit_draft_id'))
                ->where('created_by', $user->id)
                ->where('status', 'draft')
                ->first();
            abort_unless($draftToEdit, 404);
            $draftToEdit = $draftToEdit->only([
                'id', 'title', 'content', 'document_type_id', 'version_number', 'created_by', 'approver_office_id', 'notify_approvers_by_email', 'status',
            ]);
            $draftToEdit['content'] = app(DocumentTemplates::class)->presentContent(DocumentMetadata::present($draftToEdit['content'], $user));
        }

        $myWorkQuery = DocumentCreationDraft::query()->with($relations)
            ->where('created_by', $user->id)
            ->whereIn('status', $workStatuses);
        if ($myStatus !== 'all') {
            $myWorkQuery->where('status', $myStatus);
        }
        $this->applyDraftSearch($myWorkQuery, $mySearch);

        $approvalTasksQuery = DocumentCreationDraft::query()->with($relations)
            ->where('status', 'pending_approval')
            ->where('created_by', '!=', $user->id)
            ->where(function ($query) use ($user, $userOffice, $canReviewOfficeApprovals) {
                $query->where('approver_id', $user->id);
                if ($canReviewOfficeApprovals) {
                    $query->orWhere('approver_office_id', $userOffice->id);
                }
            });
        $this->applyDraftSearch($approvalTasksQuery, $approvalSearch, includeCreator: true);

        $myWork = $this->prepareDraftPage(
            $myWorkQuery->latest()->paginate(5, ['*'], 'my_page')->withQueryString(),
            $user,
            $userOffice,
            $canReviewOfficeApprovals,
        );
        $approvalTasks = $this->prepareDraftPage(
            $approvalTasksQuery->latest()->paginate(5, ['*'], 'approval_page')->withQueryString(),
            $user,
            $userOffice,
            $canReviewOfficeApprovals,
        );

        return Inertia::render('DocumentCreation/Index', [
            'drafts' => $myWork->items(),
            'draftsPagination' => $this->paginationSummary($myWork),
            'approvalTasks' => $approvalTasks->items(),
            'approvalTasksPagination' => $this->paginationSummary($approvalTasks),
            'documentTypes' => $this->documentTypeOptions(),
            'draftToEdit' => $draftToEdit,
            'savedDraftId' => session('savedDraftId'),
            'approverOffices' => $this->approverOffices()
                ->map(fn (Office $office) => ['id' => $office->id, 'name' => $office->name, 'short_name' => $office->short_name])
                ->all(),
            'currentUserId' => $user->id,
            'footerOfficeName' => DocumentMetadata::officeName($user),
            'approvedOnly' => false,
            'canReviewOfficeApprovals' => $canReviewOfficeApprovals,
            'filters' => [
                'queue' => $queue,
                'my_search' => $mySearch,
                'my_status' => $myStatus,
                'approval_search' => $approvalSearch,
                'my_page' => $myWork->currentPage(),
                'approval_page' => $approvalTasks->currentPage(),
            ],
        ]);
    }

    private function paginationSummary(LengthAwarePaginator $page): array
    {
        return [
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
        ];
    }

    private function applyDraftSearch(Builder $query, string $search, bool $includeCreator = false): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function (Builder $matches) use ($search, $includeCreator) {
            $matches->where('title', 'like', '%'.$search.'%')
                ->orWhereHas('documentType', fn (Builder $type) => $type->where('name', 'like', '%'.$search.'%'));

            if ($includeCreator) {
                $matches->orWhereHas('creator', fn (Builder $creator) => $creator
                    ->where('name', 'like', '%'.$search.'%')
                    ->orWhere('firstname', 'like', '%'.$search.'%')
                    ->orWhere('lastname', 'like', '%'.$search.'%'));
            }
        });
    }

    private function prepareDraftPage(
        LengthAwarePaginator $page,
        User $user,
        ?Office $userOffice,
        bool $canReviewOfficeApprovals,
    ): LengthAwarePaginator {
        $drafts = $page->getCollection();
        $currentVersions = collect();

        if ($drafts->isNotEmpty()) {
            $currentVersions = DocumentCreationVersion::query()
                ->where(function (Builder $query) use ($drafts) {
                    foreach ($drafts as $draft) {
                        $query->orWhere(function (Builder $version) use ($draft) {
                            $version->where('draft_id', $draft->id)
                                ->where('version_number', $draft->version_number);
                        });
                    }
                })
                ->get(['id', 'draft_id', 'version_number', 'content', 'created_at'])
                ->keyBy(fn (DocumentCreationVersion $version) => $version->draft_id.':'.$version->version_number);
        }

        $drafts->transform(function (DocumentCreationDraft $draft) use ($user, $userOffice, $canReviewOfficeApprovals, $currentVersions) {
            $draft->content = app(DocumentTemplates::class)->presentContent(DocumentMetadata::present($draft->content ?? [], $draft->creator));
            $version = $currentVersions->get($draft->id.':'.$draft->version_number);
            $draft->setAttribute('current_submission', $version ? [
                'version_number' => $version->version_number,
                'content' => $version->content,
                'submitted_at' => $version->created_at,
            ] : null);
            $draft->setAttribute('can_decide', (int) $draft->created_by !== (int) $user->id
                && ((int) $draft->approver_id === (int) $user->id
                    || ($canReviewOfficeApprovals && (int) $draft->approver_office_id === (int) $userOffice?->id)));
            foreach (['creator', 'approver', 'decisionMaker'] as $relation) {
                if ($draft->{$relation}) {
                    $draft->{$relation}->setAttribute('short_name', $this->shortUserName($draft->{$relation}));
                }
            }
            $draft->events->each(function ($event) {
                if ($event->user) {
                    $event->user->setAttribute('short_name', $this->shortUserName($event->user));
                    $event->user->setAttribute('office_short_name', $this->userOffice($event->user)?->short_name);
                }
            });

            return $draft;
        });

        return $page->setCollection($drafts);
    }

    public function store(Request $request)
    {
        $data = $this->validateDraft($request);
        $draft = DocumentCreationDraft::create([...$data, 'created_by' => $request->user()->id, 'status' => 'draft']);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Draft created']);
        app(AuditTrailWriter::class)->record('document.draft_created', $draft, [
            'title' => $draft->title,
        ]);

        return back()->with('success', 'Draft saved.')->with('savedDraftId', $draft->id);
    }

    public function update(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->id && in_array($draft->status, ['draft', 'revision_requested'], true), 403);
        $data = $this->validateDraft($request, $draft);
        $draft->update([...$data, 'status' => 'draft']);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Draft updated']);
        app(AuditTrailWriter::class)->record('document.draft_updated', $draft, [
            'title' => $draft->title,
        ]);

        return back()->with('success', 'Draft updated.')->with('savedDraftId', $draft->id);
    }

    public function submitCurrent(Request $request)
    {
        $existing = $this->editableDraft($request);
        $data = $this->validateDraft($request, $existing);
        $validated = $request->validate([
            'draft_id' => ['nullable', 'integer'],
            'approver_office_id' => ['required', 'integer', 'exists:offices,id'],
            'notify_approvers_by_email' => ['required', 'boolean'],
        ]);
        $approverOffice = $this->approverOffices()->first(
            fn (Office $office) => (int) $office->id === (int) $validated['approver_office_id'],
        );
        abort_unless($approverOffice, 422, 'Choose an office with an active admin.');

        $draft = DB::transaction(function () use ($request, $data, $validated, $approverOffice) {
            if (! empty($validated['draft_id'])) {
                $draft = DocumentCreationDraft::query()
                    ->whereKey($validated['draft_id'])
                    ->where('created_by', $request->user()->id)
                    ->whereIn('status', ['draft', 'revision_requested'])
                    ->lockForUpdate()
                    ->firstOrFail();
                $draft->update([
                    ...$data,
                    'notify_approvers_by_email' => $validated['notify_approvers_by_email'],
                    'status' => 'draft',
                ]);
                $draft->events()->create([
                    'user_id' => $request->user()->id,
                    'event' => 'Draft updated',
                ]);
                app(AuditTrailWriter::class)->record('document.draft_updated', $draft, [
                    'title' => $draft->title,
                ]);
            } else {
                $draft = DocumentCreationDraft::create([
                    ...$data,
                    'created_by' => $request->user()->id,
                    'notify_approvers_by_email' => $validated['notify_approvers_by_email'],
                    'status' => 'draft',
                ]);
                $draft->events()->create([
                    'user_id' => $request->user()->id,
                    'event' => 'Draft created',
                ]);
                app(AuditTrailWriter::class)->record('document.draft_created', $draft, [
                    'title' => $draft->title,
                ]);
            }

            $this->submitDraftVersion($request, $draft, $approverOffice);

            return $draft;
        });

        return back()->with('success', 'Document version submitted for approval.')
            ->with('savedDraftId', $draft->id);
    }

    public function submit(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->id && in_array($draft->status, ['draft', 'revision_requested'], true), 403);
        $data = $request->validate([
            'approver_office_id' => ['required', 'integer', 'exists:offices,id'],
            'notify_approvers_by_email' => ['required', 'boolean'],
        ]);
        $approverOffice = $this->approverOffices()->first(fn (Office $office) => (int) $office->id === (int) $data['approver_office_id']);
        abort_unless($approverOffice, 422, 'Choose an office with an active admin.');
        $draft->update(['notify_approvers_by_email' => $data['notify_approvers_by_email']]);
        $this->submitDraftVersion($request, $draft, $approverOffice);

        return back()->with('success', 'Document version submitted for approval.');
    }

    private function submitDraftVersion(Request $request, DocumentCreationDraft $draft, Office $approverOffice): void
    {
        $content = DocumentMetadata::present($draft->content, $draft->creator);
        $content['document_title'] = $draft->title;
        $content['template_snapshot'] ??= app(DocumentTemplates::class)->defaultSnapshot();
        $draft->update(['content' => $content]);
        $number = $draft->version_number + 1;
        $draft->versions()->create(['version_number' => $number, 'content' => $draft->content, 'created_by' => $request->user()->id]);
        $draft->update([
            'approver_id' => null,
            'approver_office_id' => $approverOffice->id,
            'decided_by' => null,
            'version_number' => $number,
            'status' => 'pending_approval',
            'submitted_at' => now(),
            'decision_at' => null,
            'decision_remarks' => null,
        ]);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Submitted for approval', 'metadata' => ['version' => $number, 'approver_office_id' => $approverOffice->id]]);
        app(AuditTrailWriter::class)->record('document.approval.submitted', $draft, [
            'title' => $draft->title,
            'version' => $number,
            'approver_office_id' => $approverOffice->id,
            'approver_office_name' => $approverOffice->name,
        ]);
        $this->queueApprovalRequestEmails($draft, $approverOffice, $request->user());
    }

    public function decide(Request $request, DocumentCreationDraft $draft)
    {
        $user = $request->user();
        $legacyApprover = (int) $draft->approver_id === (int) $user->id;
        $officeApprover = $draft->approver_office_id !== null
            && $this->userCanApproveForOffice($user, (int) $draft->approver_office_id);
        abort_unless((int) $draft->created_by !== (int) $user->id
            && ($legacyApprover || $officeApprover)
            && $draft->status === 'pending_approval', 403);
        $data = $request->validate(['decision' => ['required', 'in:approved,revision_requested,rejected'], 'version_number' => ['required', 'integer'], 'remarks' => ['nullable', 'string', 'max:4000']]);
        abort_unless((int) $data['version_number'] === (int) $draft->version_number, 409, 'This submission has changed. Refresh and review the latest version.');
        $nextStatus = $data['decision'];
        $draft->update(['status' => $nextStatus, 'decided_by' => $user->id, 'decision_at' => now(), 'decision_remarks' => $data['remarks'] ?? null]);
        $draft->events()->create(['user_id' => $user->id, 'event' => ucfirst(str_replace('_', ' ', $data['decision'])), 'remarks' => $data['remarks'] ?? null, 'metadata' => ['version' => $draft->version_number]]);
        app(AuditTrailWriter::class)->record('document.approval.'.$nextStatus, $draft, [
            'title' => $draft->title,
            'version' => $draft->version_number,
            'remarks' => $data['remarks'] ?? null,
        ]);
        $this->queueStatusEmail($draft, $nextStatus, $data['remarks'] ?? null);

        return back()->with('success', 'Approval decision recorded.');
    }

    public function destroy(Request $request, DocumentCreationDraft $draft)
    {
        DB::transaction(function () use ($request, $draft) {
            $draft = DocumentCreationDraft::query()->lockForUpdate()->findOrFail($draft->id);
            abort_unless((int) $draft->created_by === (int) $request->user()->id, 403);
            abort_unless($draft->status === 'draft' && ! $draft->archived_at, 403);
            $draft->delete();
        });

        return back()->with('success', 'Draft deleted successfully.');
    }

    public function archive(Request $request, DocumentCreationDraft $draft)
    {
        return $this->setArchived($request, $draft, true);
    }

    public function restore(Request $request, DocumentCreationDraft $draft)
    {
        return $this->setArchived($request, $draft, false);
    }

    private function setArchived(Request $request, DocumentCreationDraft $draft, bool $archived)
    {
        DB::transaction(function () use ($request, $draft, $archived) {
            $draft = DocumentCreationDraft::query()->lockForUpdate()->findOrFail($draft->id);
            abort_unless((int) $draft->created_by === (int) $request->user()->id, 403);
            abort_unless(in_array($draft->status, ['approved', 'awaiting_verification', 'verified', 'registered'], true), 403);
            abort_unless((bool) $draft->archived_at !== $archived, 409);
            $draft->update(['archived_at' => $archived ? now() : null]);
            $draft->events()->create([
                'user_id' => $request->user()->id,
                'event' => $archived ? 'Archived' : 'Restored from archive',
            ]);
        });

        return back()->with('success', $archived ? 'Document archived.' : 'Document restored to approved documents.');
    }

    public function register(Request $request, DocumentCreationDraft $draft)
    {
        abort_if($draft->archived_at, 403);
        abort_unless((int) $draft->created_by === (int) $request->user()->id, 403, 'Only the document creator can register an approved document.');
        abort_unless(in_array($draft->status, ['approved', 'awaiting_verification', 'verified'], true) && ! $draft->official_document_id, 403);
        $officeId = $request->user()->office_id;
        abort_unless($officeId, 422, 'Assign your account to an office before registering this document.');
        $document = DB::transaction(function () use ($request, $draft, $officeId) {
            $document = Document::create([
                'title' => $draft->title, 'tracking_number' => 'draft-'.Str::uuid(),
                'document_type_id' => $draft->document_type_id, 'office_id' => $officeId,
                'created_by' => $draft->created_by, 'status' => 'pending', 'is_finalized' => true,
                'remarks' => 'Created through Document Creation workflow.',
            ]);
            $office = $request->user()->office;
            $officeName = trim((string) $office?->short_name) ?: ($office?->name ?: 'DOTS');
            $prefix = trim(preg_replace('/-+/', '-', preg_replace('/\s+/', '-', trim($officeName))), '-');
            $document->update(['tracking_number' => $prefix.'-'.now()->format('y-m-d').'-'.str_pad((string) $document->id, 4, '0', STR_PAD_LEFT)]);
            $document->trails()->create(['from_office_id' => $officeId, 'created_by' => $request->user()->id, 'status' => 'pending', 'action' => 'Registered from Document Creation']);
            $draft->update(['official_document_id' => $document->id, 'status' => 'registered']);
            $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Registered in DOTS', 'metadata' => ['document_id' => $document->id]]);

            return $document;
        });
        app(AuditTrailWriter::class)->record('document.registered', $document, [
            'tracking_number' => $document->tracking_number,
            'title' => $document->title,
            'draft_id' => $draft->id,
        ]);
        $this->queueStatusEmail($draft, 'registered', null, $document->tracking_number);

        return back()->with('success', 'Registered as '.$document->tracking_number.'.');
    }

    private function queueStatusEmail(DocumentCreationDraft $draft, string $status, ?string $remarks, ?string $trackingNumber = null): void
    {
        $creator = $draft->creator;
        $reason = match (true) {
            ! $creator => 'creator_missing',
            ! filter_var($creator->email, FILTER_VALIDATE_EMAIL) => 'creator_email_invalid',
            ! GmailConnection::query()->exists() => 'sender_not_connected',
            default => null,
        };

        if ($reason !== null) {
            Log::notice('Document status email was not queued.', [
                'draft_id' => $draft->id,
                'status' => $status,
                'reason' => $reason,
            ]);

            return;
        }

        SendDocumentStatusEmail::dispatch(
            recipientEmail: $creator->email,
            recipientName: $creator->name,
            documentTitle: $draft->title,
            status: $status,
            versionNumber: (int) $draft->version_number,
            remarks: $remarks,
            trackingNumber: $trackingNumber,
        )->afterCommit();

        Log::info('Document status email was queued.', [
            'draft_id' => $draft->id,
            'status' => $status,
            'creator_id' => $creator->id,
        ]);
    }

    private function queueApprovalRequestEmails(DocumentCreationDraft $draft, Office $approverOffice, User $submitter): void
    {
        if (! $draft->notify_approvers_by_email) {
            Log::info('Document approval request emails were not queued.', [
                'draft_id' => $draft->id,
                'approver_office_id' => $approverOffice->id,
                'reason' => 'disabled_by_submitter',
            ]);

            return;
        }

        if (! GmailConnection::query()->exists()) {
            Log::notice('Document approval request emails were not queued.', [
                'draft_id' => $draft->id,
                'approver_office_id' => $approverOffice->id,
                'reason' => 'sender_not_connected',
            ]);

            return;
        }

        $approvers = User::query()
            ->with(['office', 'officeByCode'])
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $approver) => (int) $approver->id !== (int) $submitter->id
                && $approver->isAdministrator()
                && (int) ($this->userOffice($approver)?->id ?? 0) === (int) $approverOffice->id)
            ->values();
        $recipients = $approvers->filter(fn (User $approver) => filter_var($approver->email, FILTER_VALIDATE_EMAIL))->values();

        if ($recipients->isEmpty()) {
            Log::notice('Document approval request emails were not queued.', [
                'draft_id' => $draft->id,
                'approver_office_id' => $approverOffice->id,
                'matching_approvers' => $approvers->count(),
                'reason' => 'no_valid_approver_email',
            ]);

            return;
        }

        $recipients->each(function (User $approver) use ($draft, $submitter): void {
            SendDocumentApprovalRequestEmail::dispatch(
                recipientEmail: $approver->email,
                recipientName: $approver->name,
                submitterName: $submitter->name,
                documentTitle: $draft->title,
                versionNumber: (int) $draft->version_number,
            )->afterCommit();
        });

        Log::info('Document approval request emails were queued.', [
            'draft_id' => $draft->id,
            'approver_office_id' => $approverOffice->id,
            'recipient_count' => $recipients->count(),
        ]);
    }

    public function preview(Request $request)
    {
        $data = $this->validateDraft($request, $this->editableDraft($request));

        return app(DocumentPdf::class)->response($data['title'], $data['content']);
    }

    public function previewSubmission(Request $request, DocumentCreationDraft $draft)
    {
        $user = $request->user();
        abort_unless($this->canAccess($draft, $request)
            || ($draft->approver_office_id && $this->userCanApproveForOffice($user, $draft->approver_office_id)), 403);
        $version = $draft->versions()->where('version_number', $draft->version_number)->firstOrFail();

        return app(DocumentPdf::class)->response($draft->title, DocumentMetadata::present($version->content, $draft->creator));
    }

    private function editableDraft(Request $request): ?DocumentCreationDraft
    {
        $request->validate(['draft_id' => ['nullable', 'integer']]);
        if (! $request->filled('draft_id')) {
            return null;
        }

        return DocumentCreationDraft::query()->whereKey($request->integer('draft_id'))
            ->where('created_by', $request->user()->id)->whereIn('status', ['draft', 'revision_requested'])->firstOrFail();
    }

    private function validateDraft(Request $request, ?DocumentCreationDraft $existing = null): array
    {
        $data = $request->validate([
            'document_type_id' => ['required', 'integer', 'exists:document_types,id'],
            'title' => ['nullable', 'string', 'max:255'],
            'content' => ['required', 'array'],
            'content.recipient_label' => ['nullable', 'in:FOR,TO'],
            'content.for' => ['nullable', 'string', 'max:255'], 'content.thru' => ['nullable', 'string', 'max:255'],
            'content.attention' => ['nullable', 'string', 'max:255'], 'content.from' => ['required', 'string', 'max:255'],
            'content.subject' => ['required', 'string', 'max:255'], 'content.date' => ['nullable', 'string', 'max:100'],
            'content.for_position' => ['nullable', 'string', 'max:255'],
            'content.thru_position' => ['nullable', 'string', 'max:255'],
            'content.attention_position' => ['nullable', 'string', 'max:255'],
            'content.from_position' => ['nullable', 'string', 'max:255'],
            'content.body' => ['required_without:content.body_document', 'nullable', 'string', 'max:50000'],
            'content.body_document' => ['nullable', 'array'],
            'content.cc' => ['nullable', 'array', 'max:100'], 'content.cc.*' => ['nullable', 'string', 'max:255'],
        ], [
            'document_type_id.required' => 'Choose a document type.',
            'content.from.required' => 'Enter the sender name.',
            'content.subject.required' => 'Enter a subject.',
            'content.body.required_without' => 'Enter the document body.',
        ]);
        $type = DocumentType::query()->whereKey($data['document_type_id'])->where('is_active', true)->first();
        abort_unless($type, 422, 'Choose an active document type.');
        $data['content'] = Arr::only($data['content'], ['recipient_label', 'for', 'thru', 'attention', 'from', 'for_position', 'thru_position', 'attention_position', 'from_position', 'subject', 'date', 'body', 'body_document', 'cc']);
        $data['content']['recipient_label'] ??= 'FOR';
        if (isset($data['content']['body_document'])) {
            $rich = app(RichDocumentContent::class);
            $data['content']['body_document'] = $rich->normalize($data['content']['body_document']);
            $data['content']['body'] = $rich->plainText($data['content']['body_document']);
            if (trim($data['content']['body']) === '') {
                throw ValidationException::withMessages(['content.body_document' => 'Write some document content before saving or submitting.']);
            }
            $data['content']['schema_version'] = 2;
        }
        $templates = app(DocumentTemplates::class);
        $data['content']['template_snapshot'] = $existing && (int) $existing->document_type_id === (int) $type->id
            ? ($existing->content['template_snapshot'] ?? $templates->defaultSnapshot())
            : $templates->forType($type)['snapshot'];
        // The editor uses Subject as the record name; accept titles from older clients.
        $data['title'] = filled($data['title'] ?? null) ? $data['title'] : $data['content']['subject'];
        $data['content']['document_title'] = $data['title'];
        $data['content']['footer_office_name'] = $existing?->content['footer_office_name'] ?? DocumentMetadata::officeName($request->user());
        // Preserve the exact visible fields, including blank CC lines, for shared layout.
        $data['content']['date'] = DocumentMetadata::displayDate($data['content']['date'] ?? null);
        $data['content']['cc'] = array_map(fn ($line) => $line ?? '', array_values($data['content']['cc'] ?? []));

        return $data;
    }

    private function documentTypeOptions(): array
    {
        $options = DocumentType::query()
            ->with('defaultTemplateVersion')
            ->orderBy('name')
            ->get(['id', 'name', 'is_active', 'default_template_version_id'])
            ->map(function (DocumentType $type) {
                $templates = app(DocumentTemplates::class);
                try {
                    $resolved = $type->is_active ? $templates->forType($type) : null;
                } catch (ValidationException $exception) {
                    return ['id' => (string) $type->id, 'name' => $type->name, 'disabled' => true, 'template_error' => $exception->getMessage()];
                }
                return [
                'id' => (string) $type->id,
                'name' => $type->name,
                'source' => 'New DB',
                'disabled' => ! (bool) $type->is_active,
                'template' => $resolved ? $templates->presentation($resolved['snapshot']) : null,
                'sample_content' => $resolved['sample_content'] ?? null,
            ]; });

        return $options->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    private function canAccess(DocumentCreationDraft $draft, Request $request): bool
    {
        return in_array((int) $request->user()->id, [(int) $draft->created_by, (int) $draft->approver_id, (int) $draft->verified_by], true);
    }

    private function shortUserName(User $user): string
    {
        return trim(
            (filled($user->firstname) ? mb_substr(trim($user->firstname), 0, 1).'. ' : '').
            ($user->lastname ?? '')
        ) ?: $user->name;
    }

    private function approverOffices(): Collection
    {
        return User::query()
            ->with(['office', 'officeByCode'])
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $approver) => $approver->isAdministrator())
            ->map(fn (User $approver) => $this->userOffice($approver))
            ->filter()
            ->unique('id')
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
    }

    private function userOffice(User $user): ?Office
    {
        $office = $user->office ?: ($user->office_code ? $user->officeByCode : null);
        if ($office) {
            return $office;
        }

        return null;
    }

    private function userCanApproveForOffice(User $user, int $officeId): bool
    {
        return $user->is_active
            && $user->isAdministrator()
            && (int) $this->userOffice($user)?->id === $officeId;
    }

    private function userRangeIdentity(User $user): ?array
    {
        $office = $user->office;
        if (! $office && filled($user->office_code)) {
            $office = $user->officeByCode ?: Office::query()->with('range')->where('code', $user->office_code)->first();
        }

        if ($office && ($range = $this->officeRangeIdentity($office))) {
            return $range;
        }

        return null;
    }

    private function officeRangeIdentity(Office $office): ?array
    {
        if ($office->range_id !== null && $office->range) {
            return ['source' => 'new', 'id' => (int) $office->range_id];
        }

        return null;
    }
}
