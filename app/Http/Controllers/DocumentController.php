<?php

namespace App\Http\Controllers;

use App\Models\ActionType;
use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentTrail;
use App\Models\DocumentType;
use App\Models\GmailConnection;
use App\Models\Office;
use App\Models\PurposeType;
use App\Models\User;
use App\Jobs\SendDocumentTrackingReceivedEmail;
use App\Services\AuditTrailWriter;
use App\Services\DocumentAccess;
use App\Services\DocumentPdf;
use App\Services\RenderedDocumentPdf;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class DocumentController extends Controller
{
    private const MAX_DOCUMENT_UPLOAD_KB = 102400;

    private bool $userRangeResolved = false;

    private ?array $userRangeIdentity = null;

    public function index()
    {
        return $this->renderDocumentList();
    }

    public function latest()
    {
        return $this->renderDocumentList(true);
    }

    public function details(int $id)
    {
        $user = auth()->user();
        $document = app(DocumentAccess::class)->scope(Document::query(), $user)
            ->with([
                'files', 'creator', 'office', 'documentType', 'purposeType',
                'latestTrail.creator', 'latestTrail.fromOffice', 'latestTrail.toOffice',
                'trails.creator', 'trails.fromOffice', 'trails.toOffice', 'trails.holderOffice', 'trails.legacyReceivingOffice',
            ])
            ->findOrFail($id);
        $latestFile = $document->files->sortByDesc('id')->first();

        return response()->json([
            'document_type' => $document->documentType?->name ?? '',
            'other_document_type' => $document->other_document_type,
            'purpose_type' => $document->purposeType?->name ?? '',
            'origin_type' => $document->origin_type ?? '',
            'file_name' => $latestFile?->original_name ?? $latestFile?->file_name,
            'file_url' => $latestFile?->downloadUrl(),
            'files' => $document->files->sortBy('id')->map(fn ($file) => [
                'id' => $file->id,
                'name' => $file->original_name ?: $file->file_name,
                'type' => $file->type ?: 'original',
                'url' => $file->downloadUrl(),
                'uploaded_at' => $file->created_at?->toDateTimeString(),
            ])->values(),
            'transactions' => $document->trails->sortByDesc('id')->values()->map(fn (DocumentTrail $trail) => [
                'action' => $trail->action ?: ucfirst(strtolower((string) $trail->status)),
                'status' => $trail->status,
                'remarks' => $trail->remarks,
                'from_office' => $trail->fromOffice?->name,
                'from_office_short_name' => $trail->fromOffice?->short_name,
                'to_office' => $trail->legacy_doc_trail_id ? $trail->legacyReceivingOffice?->name : $trail->toOffice?->name,
                'to_office_short_name' => $trail->legacy_doc_trail_id ? $trail->legacyReceivingOffice?->short_name : $trail->toOffice?->short_name,
                'holder' => $trail->legacy_doc_trail_id ? $trail->holderOffice?->name : $trail->toOffice?->name,
                'holder_short_name' => $trail->legacy_doc_trail_id ? $trail->holderOffice?->short_name : $trail->toOffice?->short_name,
                'created_by' => $trail->creator?->name,
                'created_by_short_name' => trim(
                    (filled($trail->creator?->firstname) ? mb_substr(trim($trail->creator->firstname), 0, 1).'. ' : '').
                    ($trail->creator?->lastname ?? '')
                ) ?: $trail->creator?->name,
                'created_at' => $trail->created_at?->format('F j Y h:i:s A'),
            ]),
            'created_by_name' => $document->creator?->name ?? '',
        ]);
    }

    public function downloadFile(int $document, int $file)
    {
        $record = app(DocumentAccess::class)->scope(Document::query(), auth()->user())
            ->whereKey($document)
            ->firstOrFail();
        $attachment = $record->files()->whereKey($file)->firstOrFail();
        abort_if($attachment->is_available === false, 404);

        $relativePath = str_replace('\\', '/', (string) $attachment->file_path);
        abort_unless($relativePath !== ''
            && ! str_starts_with($relativePath, '/')
            && ! preg_match('/^[a-zA-Z]:/', $relativePath)
            && ! in_array('..', explode('/', $relativePath), true), 404);

        $disk = Storage::disk('document_private');
        if (! $disk->exists($relativePath)) {
            $disk = Storage::disk('document_legacy_public');
        }
        abort_unless($disk->exists($relativePath), 404);

        $filename = basename((string) ($attachment->original_name ?: $attachment->file_name));
        $filename = preg_replace('/[\\x00-\\x1F\\x7F]/u', '', $filename) ?: 'document';

        return response()->download($disk->path($relativePath), $filename, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function renderDocumentList(bool $latestOnly = false)
    {
        return $this->renderLocalDocumentList($latestOnly);

        /*
        $legacyDocuments = collect();
        $legacyTrailRows = collect();
        $legacyTransactions = collect();
        $legacyTransactionUsers = collect();
        $legacyShortTransactionUsers = collect();
        $user = auth()->user();
        $access = app(DocumentAccess::class);

        try {
        $legacyDocumentQuery = DocumentLegacy::query();
        if ($latestOnly) {
            $legacyDocumentQuery->whereRaw('1 = 0');
        }
        if (!$access->canViewAllDocuments($user)) {
            $bureauId = $access->legacyBureauId($user);
            if ($bureauId) {
                $creatorIds = UserLegacy::query()->where('bureauId', $bureauId)->pluck('userUuid');
                $officeTrackingNumbers = DocumentTrailLegacy::query()
                    ->where('originating', $bureauId)
                    ->orWhere('receiving', $bureauId)
                    ->orWhere('holder', $bureauId)
                    ->pluck('trackingNo');
                $creatorTrackingNumbers = DocumentLegacy::query()
                    ->whereIn('createdBy', $creatorIds)
                    ->pluck('trackingNo');

                $legacyDocumentQuery->whereIn('trackingNo', $officeTrackingNumbers->merge($creatorTrackingNumbers)->unique());
            } else {
                $legacyDocumentQuery->whereRaw('1 = 0');
            }
        }

        $legacyDocuments = $legacyDocumentQuery
            ->select([
                'docId', 'trackingNo', 'dtId', 'otherDtype', 'purpose', 'originType', 'title', 'remarks',
                'Archived', 'createdBy', 'dateCreated', 'isFinalized', 'urgent',
            ])
            ->orderBy('dateCreated', 'desc')
            ->limit(200)
            ->get();

        $legacyTrackingNumbers = $legacyDocuments->pluck('trackingNo')->filter()->unique()->values();
        $legacyTrailRows = DocumentTrailLegacy::query()
            ->whereIn('trackingNo', $legacyTrackingNumbers)
            ->select(['docTrailId', 'trackingNo', 'status', 'action', 'remarks', 'createdBy', 'dateCreated', 'originating', 'receiving', 'holder'])
            ->orderByDesc('dateCreated')
            ->orderByDesc('docTrailId')
            ->get();
        $legacyTransactions = $legacyTrailRows
            ->unique('trackingNo')
            ->keyBy('trackingNo');

        $legacyUsers = UserLegacy::query()
            ->whereIn('userUuid', $legacyTrailRows->pluck('createdBy')->merge($legacyDocuments->pluck('createdBy'))->filter()->unique())
            ->get(['userUuid', 'username', 'firstname', 'middlename', 'lastname', 'extensionname']);
        $legacyTransactionUsers = $legacyUsers->mapWithKeys(function (UserLegacy $user) {
            $name = collect([$user->firstname, $user->middlename, $user->lastname, $user->extensionname])
                ->filter(fn ($part) => filled($part))
                ->implode(' ');

            return [$user->userUuid => $name ?: ($user->username ?? '')];
        });
        $legacyShortTransactionUsers = $legacyUsers->mapWithKeys(function (UserLegacy $user) {
            $name = trim(
                (filled($user->firstname) ? mb_substr(trim($user->firstname), 0, 1).'. ' : '').
                ($user->lastname ?? '')
            );

            return [$user->userUuid => $name ?: ($user->username ?? '')];
        });
        } catch (\Throwable $exception) {
            // The current Documents module must remain usable while the optional
            // legacy database is offline or its credentials are unavailable.
            report($exception);
            $legacyDocuments = collect();
            $legacyTrailRows = collect();
            $legacyTransactionUsers = collect();
            $legacyShortTransactionUsers = collect();
        }

        $legacyDocumentTypes = $latestOnly ? collect() : LegacyDocumentTypeMap::typesByLegacyId();

        $legacyBureaus = $latestOnly ? collect() : BureauLegacy::query()
            ->whereIn('bureauId', $legacyTrailRows->flatMap(fn ($trail) => [$trail->originating, $trail->receiving, $trail->holder])->filter()->unique())
            ->get(['bureauId', 'longName', 'shortName'])
            ->keyBy('bureauId');
        $legacyTransactionsByDocument = $legacyTrailRows->groupBy('trackingNo');
        $legacyDocuments = $legacyDocuments
            ->map(function ($document) use ($legacyTransactions, $legacyTransactionUsers, $legacyShortTransactionUsers, $legacyDocumentTypes, $legacyTransactionsByDocument, $legacyBureaus) {
                $transaction = $legacyTransactions->get($document->trackingNo);
                $originatingBureauId = $legacyTransactionsByDocument->get($document->trackingNo, collect())->last()?->originating;
                $typeName = $legacyDocumentTypes->get($document->dtId)?->name ?? '';

                $status = $this->workflowStatus($transaction?->status);
                if (($document->Archived ?? null) === 'Y') {
                    $status = 'archived';
                }

                return [
                    'id' => $document->docId,
                    'tracking_number' => $document->trackingNo ?? '',
                    'tracking_url' => $document->trackingNo ? URL::signedRoute('documents.track', ['trackingNumber' => $document->trackingNo]) : null,
                    'title' => $document->title ?? '',
                    'created_at' => $document->dateCreated?->format('F j Y h:i:s A'),
                    'created_at_timestamp' => $document->dateCreated?->timestamp,
                    'status' => $status,
                    'office_name' => $legacyBureaus->get($originatingBureauId)?->longName ?? $legacyBureaus->get($originatingBureauId)?->shortName ?? '',
                    'office_short_name' => $legacyBureaus->get($originatingBureauId)?->shortName,
                    'document_type' => $typeName,
                    'other_document_type' => $document->otherDtype ?? '',
                    'purpose_type' => $document->purpose ?? '',
                    'created_by_name' => $legacyTransactionUsers->get($document->createdBy) ?? $document->createdBy,
                    'created_by_short_name' => $legacyShortTransactionUsers->get($document->createdBy) ?? $document->createdBy,
                    'urgent' => $document->urgent ?? null,
                    'origin_type' => $document->originType ?? '',
                    'last_transaction' => $this->formatLastTransaction(
                        $transaction?->action,
                        $transaction?->status,
                        $legacyTransactionUsers->get($transaction?->createdBy) ?? $transaction?->createdBy,
                        $transaction?->dateCreated?->format('M j, Y g:i A'),
                    ),
                    'transactions' => $legacyTransactionsByDocument->get($document->trackingNo, collect())->map(fn ($trail) => [
                        'action' => $trail->action ?: ucfirst(strtolower((string) $trail->status)),
                        'status' => $trail->status,
                        'remarks' => $trail->remarks,
                        'from_office' => $legacyBureaus->get($trail->originating)?->shortName ?? $legacyBureaus->get($trail->originating)?->longName,
                        'to_office' => $legacyBureaus->get($trail->receiving)?->shortName ?? $legacyBureaus->get($trail->receiving)?->longName,
                        'holder' => $legacyBureaus->get($trail->holder)?->shortName ?? $legacyBureaus->get($trail->holder)?->longName,
                        'created_by' => $legacyTransactionUsers->get($trail->createdBy) ?? $trail->createdBy,
                        'created_by_short_name' => $legacyShortTransactionUsers->get($trail->createdBy) ?? $trail->createdBy,
                        'created_at' => $trail->dateCreated?->format('F j Y h:i:s A'),
                    ])->values(),
                    'remarks' => $document->remarks ?? '',
                    'source' => 'Old DB',
                    'is_finalized' => in_array(strtolower((string) ($document->isFinalized ?? '')), ['1', 'yes', 'y', 'true'], true),
                ];
            });

        $currentOfficeId = $access->currentOfficeId($user);
        $isAdministrator = $access->canViewAllDocuments($user);
        $newDocumentQuery = $access->scope(Document::query(), $user);
        if ($latestOnly) {
            $newDocumentQuery->where('created_at', '>=', now()->subDays(15));
        }
        $newDocuments = $newDocumentQuery
            ->with([
                'office', 'documentType', 'purposeType',
                'latestTrail.creator', 'latestTrail.fromOffice', 'latestTrail.toOffice',
                'latestTrail.holderOffice', 'latestTrail.legacyReceivingOffice',
            ])
            ->select(['documents.id', 'documents.legacy_doc_id', 'documents.legacy_needs_review', 'documents.is_archived', 'documents.tracking_number', 'documents.title', 'documents.status', 'documents.office_id', 'documents.created_by', 'documents.is_finalized', 'documents.remarks', 'documents.document_type_id', 'documents.action_type_id', 'documents.other_action', 'documents.purpose_type_id', 'documents.other_document_type', 'documents.other_purpose', 'documents.origin_type', 'documents.received_from', 'documents.urgent', 'documents.notify_by_email', 'documents.created_at'])
            ->orderBy('created_at', 'desc')
            ->limit(200)
            ->get()
            ->map(function ($document) use ($currentOfficeId, $isAdministrator, $user) {
                $latest = $document->latestTrail;
                $latestFile = $document->files->sortByDesc('id')->first();
                $officeId = $currentOfficeId;
                $admin = $isAdministrator;
                $holderOfficeId = $latest?->to_office_id ?? $document->office_id;
                $isPendingHolder = strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
                    && $officeId !== null && (int) $holderOfficeId === (int) $officeId;
                $isIncoming = strtolower((string) ($latest?->status ?? '')) === 'available'
                    && $officeId !== null && (int) $latest?->to_office_id === (int) $officeId;
                $isOriginOffice = $officeId !== null && (int) $document->office_id === (int) $officeId;
                $isDraft = !$document->legacy_needs_review && !$document->is_finalized && strtolower((string) $document->status) === 'draft';

                return [
                    'id' => $document->id,
                    'tracking_number' => $document->tracking_number ?? '',
                    'tracking_url' => $document->tracking_number ? URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]) : null,
                    'title' => $document->title ?? '',
                    'status' => $document->is_archived ? 'archived' : $this->workflowStatus($document->latestTrail?->status ?? $document->status),
                    'needs_review' => (bool) $document->legacy_needs_review,
                    'office_name' => $document->office?->name ?? '',
                    'office_short_name' => $document->office?->short_name,
                    'document_type' => $document->documentType?->name ?? '',
                    'other_document_type' => $document->other_document_type ?? '',
                    'purpose_type' => $document->purposeType?->name ?? '',
                    'other_purpose' => $document->other_purpose ?? '',
                    'created_by_name' => $document->creator?->name ?? '',
                    'created_by_short_name' => trim(
                        (filled($document->creator?->firstname) ? mb_substr(trim($document->creator->firstname), 0, 1).'. ' : '').
                        ($document->creator?->lastname ?? '')
                    ) ?: $document->creator?->name,
                    'file_name' => $latestFile?->original_name ?? $latestFile?->file_name,
                    'file_url' => $latestFile?->downloadUrl(),
                    'files' => $document->files->sortBy('id')->map(fn ($file) => [
                        'id' => $file->id,
                        'name' => $file->original_name ?: $file->file_name,
                        'type' => $file->type ?: 'original',
                        'url' => $file->downloadUrl(),
                        'uploaded_at' => $file->created_at?->toDateTimeString(),
                    ])->values(),
                    'origin_type' => $document->origin_type ?? '',
                    'last_transaction' => $this->formatTrailTransaction($document->latestTrail),
                    'transactions' => $document->trails->sortByDesc('id')->values()->map(fn (DocumentTrail $trail) => [
                        'action' => $trail->action ?: ucfirst(strtolower((string) $trail->status)),
                        'status' => $trail->status,
                        'remarks' => $trail->remarks,
                        'from_office' => $trail->fromOffice?->name,
                        'from_office_short_name' => $trail->fromOffice?->short_name,
                        'to_office' => $trail->legacy_doc_trail_id ? $trail->legacyReceivingOffice?->name : $trail->toOffice?->name,
                        'to_office_short_name' => $trail->legacy_doc_trail_id ? $trail->legacyReceivingOffice?->short_name : $trail->toOffice?->short_name,
                        'holder' => $trail->legacy_doc_trail_id ? $trail->holderOffice?->name : $trail->toOffice?->name,
                        'holder_short_name' => $trail->legacy_doc_trail_id ? $trail->holderOffice?->short_name : $trail->toOffice?->short_name,
                        'created_by' => $trail->creator?->name,
                        'created_by_short_name' => trim(
                            (filled($trail->creator?->firstname) ? mb_substr(trim($trail->creator->firstname), 0, 1).'. ' : '').
                            ($trail->creator?->lastname ?? '')
                        ) ?: $trail->creator?->name,
                        'created_at' => $trail->created_at?->format('F j Y h:i:s A'),
                    ]),
                    'created_at' => $document->created_at?->format('F j Y h:i:s A'),
                    'created_at_timestamp' => $document->created_at?->timestamp,
                    'remarks' => $document->remarks ?? '',
                    'document_type_id' => $document->document_type_id,
                    'action_type_id' => $document->action_type_id,
                    'purpose_type_id' => $document->purpose_type_id,
                    'office_id' => $document->office_id,
                    'received_from' => $document->received_from,
                    'urgent' => $document->urgent,
                    'notify_by_email' => $document->notify_by_email,
                    'source' => 'New DB',
                    'is_finalized' => (bool) $document->is_finalized,
                    'can_update' => $isDraft && ($admin || ($isOriginOffice && (int) $document->created_by === (int) $user?->id)),
                    'can_release' => !$document->legacy_needs_review && !$document->is_archived && $isPendingHolder,
                    'can_terminal' => !$document->legacy_needs_review && !$document->is_archived && $isPendingHolder,
                    'can_receive' => !$document->legacy_needs_review && !$document->is_archived && $isIncoming && $user->canReceiveDocuments(),
                    'can_delete' => $isDraft && ($admin || ($isOriginOffice && (int) $document->created_by === (int) $user?->id)),
                ];
            });

        return Inertia::render('Documents/Index', [
            'documents' => $legacyDocuments->concat($newDocuments)
                ->sortByDesc('created_at_timestamp')
                ->values()
                ->all(),
            'title' => $latestOnly ? 'Latest Documents' : 'All Documents',
            ...$this->documentFormOptions(),
        ]);
    }

        */
    }

    private function renderLocalDocumentList(bool $latestOnly = false)
    {
        $user = auth()->user();
        $filters = request()->validate([
            'search' => ['nullable', 'string', 'max:200'],
            'status' => ['nullable', 'in:all,pending,ongoing,approved,released,archived,rejected'],
            'sort' => ['nullable', 'in:tracking_number,title,document_type,origin_type,status,office_name,last_transaction'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'in:5,10,15,20,50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $search = trim((string) ($filters['search'] ?? ''));
        $statusFilter = $filters['status'] ?? 'all';
        $sortKey = $filters['sort'] ?? null;
        $sortDirection = $filters['direction'] ?? 'asc';
        $perPage = (int) ($filters['per_page'] ?? 10);
        $access = app(DocumentAccess::class);
        $currentOfficeId = $access->currentOfficeId($user);
        $isAdministrator = $access->canViewAllDocuments($user);
        $newDocumentQuery = $access->scope(Document::query(), $user);
        $editDraftId = request()->integer('edit_draft_id');

        if ($editDraftId > 0) {
            $newDocumentQuery->where('documents.id', $editDraftId)
                ->where('documents.status', 'draft')
                ->where('documents.is_finalized', false)
                ->where('documents.legacy_needs_review', false)
                ->where('documents.is_archived', false);

            if (! $isAdministrator) {
                $newDocumentQuery->where('documents.created_by', $user->id);
                if ($currentOfficeId === null) {
                    $newDocumentQuery->whereRaw('1 = 0');
                } else {
                    $newDocumentQuery->where('documents.office_id', $currentOfficeId);
                }
            }
        } else {
            $newDocumentQuery->where(function ($tracked) {
                $tracked->where('documents.status', '!=', 'draft')
                    ->orWhere('documents.is_finalized', true);
            });
        }

        if ($latestOnly) {
            $newDocumentQuery->where('created_at', '>=', now()->subDays(15));
        }
        $latestStatusValue = 'COALESCE((SELECT latest_status.status FROM document_trails AS latest_status WHERE latest_status.document_id = documents.id ORDER BY latest_status.id DESC LIMIT 1), documents.status)';
        if ($search !== '') {
            $like = '%'.$search.'%';
            $newDocumentQuery->where(function ($query) use ($like, $search, $latestStatusValue) {
                $query->where('documents.title', 'like', $like)
                    ->orWhere('documents.tracking_number', 'like', $like)
                    ->orWhere('documents.status', 'like', $like)
                    ->orWhere('documents.origin_type', 'like', $like)
                    ->orWhere('documents.other_document_type', 'like', $like)
                    ->orWhereHas('office', fn ($office) => $office->where('name', 'like', $like)->orWhere('short_name', 'like', $like))
                    ->orWhereHas('documentType', fn ($type) => $type->where('name', 'like', $like))
                    ->orWhereExists(DB::table('document_trails as latest_match')
                        ->selectRaw('1')
                        ->whereColumn('latest_match.document_id', 'documents.id')
                        ->whereRaw('latest_match.id = (SELECT MAX(latest_match_id.id) FROM document_trails AS latest_match_id WHERE latest_match_id.document_id = documents.id)')
                        ->where(function ($trail) use ($like) {
                            $trail->where('latest_match.action', 'like', $like)
                                ->orWhere('latest_match.status', 'like', $like)
                                ->orWhereIn('latest_match.created_by', User::query()->select('id')->where('name', 'like', $like))
                                ->orWhereIn('latest_match.from_office_id', Office::query()->select('id')->where(fn ($office) => $office->where('name', 'like', $like)->orWhere('short_name', 'like', $like)))
                                ->orWhereIn('latest_match.to_office_id', Office::query()->select('id')->where(fn ($office) => $office->where('name', 'like', $like)->orWhere('short_name', 'like', $like)))
                                ->orWhereIn('latest_match.legacy_receiving_office_id', Office::query()->select('id')->where(fn ($office) => $office->where('name', 'like', $like)->orWhere('short_name', 'like', $like)));
                        }));
                if (mb_strtolower($search) === 'ongoing') {
                    $query->orWhereIn(DB::raw($latestStatusValue), ['pending', 'ongoing']);
                } elseif (mb_strtolower($search) === 'released') {
                    $query->orWhereIn(DB::raw($latestStatusValue), ['available', 'processed', 'released']);
                } elseif (mb_strtolower($search) === 'archived') {
                    $query->orWhere('documents.is_archived', true)
                        ->orWhereIn(DB::raw($latestStatusValue), ['terminal', 'archived']);
                }
            });
        }
        if ($statusFilter === 'pending') {
            $newDocumentQuery->where('documents.is_archived', false)
                ->where('documents.legacy_needs_review', false);
            if ($currentOfficeId === null) {
                $newDocumentQuery->whereRaw('1 = 0');
            } else {
                $newDocumentQuery->whereExists(DB::table('document_trails as pending_trail')
                    ->selectRaw('1')
                    ->whereColumn('pending_trail.document_id', 'documents.id')
                    ->whereRaw('pending_trail.id = (SELECT MAX(latest_pending_trail.id) FROM document_trails AS latest_pending_trail WHERE latest_pending_trail.document_id = documents.id)')
                    ->where('pending_trail.status', 'pending')
                    ->where('pending_trail.to_office_id', $currentOfficeId));
            }
        } elseif ($statusFilter !== 'all') {
            if ($statusFilter === 'archived') {
                $newDocumentQuery->where(function ($query) {
                    $query->where('documents.is_archived', true)
                        ->orWhereIn(DB::raw('COALESCE((SELECT latest_status.status FROM document_trails AS latest_status WHERE latest_status.document_id = documents.id ORDER BY latest_status.id DESC LIMIT 1), documents.status)'), ['terminal', 'archived']);
                });
            } else {
                $statusValues = match ($statusFilter) {
                    'ongoing' => ['pending', 'ongoing'],
                    'released' => ['available', 'processed', 'released'],
                    default => [$statusFilter],
                };
                $newDocumentQuery->whereIn(DB::raw($latestStatusValue), $statusValues);
            }
        }
        $newDocuments = $newDocumentQuery
            ->with([
                'office', 'documentType', 'purposeType',
                'latestTrail.creator', 'latestTrail.fromOffice', 'latestTrail.toOffice',
                'latestTrail.holderOffice', 'latestTrail.legacyReceivingOffice',
            ])
            ->select(['documents.id', 'documents.legacy_doc_id', 'documents.legacy_needs_review', 'documents.is_archived', 'documents.tracking_number', 'documents.title', 'documents.status', 'documents.office_id', 'documents.created_by', 'documents.is_finalized', 'documents.remarks', 'documents.document_type_id', 'documents.action_type_id', 'documents.other_action', 'documents.purpose_type_id', 'documents.other_document_type', 'documents.other_purpose', 'documents.origin_type', 'documents.received_from', 'documents.urgent', 'documents.notify_by_email', 'documents.created_at'])
            ->when($sortKey !== null, function ($query) use ($sortKey, $sortDirection) {
                $sortColumns = [
                    'tracking_number' => 'documents.tracking_number',
                    'title' => 'documents.title',
                    'document_type' => DocumentType::query()->select('name')->whereColumn('document_types.id', 'documents.document_type_id')->limit(1),
                    'origin_type' => 'documents.origin_type',
                    'status' => DocumentTrail::query()->select('status')->whereColumn('document_trails.document_id', 'documents.id')->orderByDesc('id')->limit(1),
                    'office_name' => Office::query()->select('name')->whereColumn('offices.id', 'documents.office_id')->limit(1),
                    'last_transaction' => DocumentTrail::query()->selectRaw("COALESCE(NULLIF(action, ''), status)")->whereColumn('document_trails.document_id', 'documents.id')->orderByDesc('id')->limit(1),
                ];
                $query->orderBy($sortColumns[$sortKey], $sortDirection);
            }, fn ($query) => $query->orderBy('documents.created_at', 'desc'))
            ->orderBy('documents.id', 'desc')
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($document) use ($currentOfficeId, $isAdministrator, $user) {
                $latest = $document->latestTrail;
                $holderOfficeId = $latest?->to_office_id ?? $document->office_id;
                $isPendingHolder = strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
                    && $currentOfficeId !== null && (int) $holderOfficeId === (int) $currentOfficeId;
                $isIncoming = strtolower((string) ($latest?->status ?? '')) === 'available'
                    && $currentOfficeId !== null && (int) $latest?->to_office_id === (int) $currentOfficeId;
                $isOriginOffice = $currentOfficeId !== null && (int) $document->office_id === (int) $currentOfficeId;
                $isDraft = ! $document->legacy_needs_review && ! $document->is_finalized && strtolower((string) $document->status) === 'draft';

                return [
                    'id' => $document->id,
                    'tracking_number' => $document->tracking_number ?? '',
                    'tracking_url' => $document->tracking_number ? URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]) : null,
                    'title' => $document->title ?? '',
                    'status' => $document->is_archived ? 'archived' : $this->workflowStatus($latest?->status ?? $document->status),
                    'needs_review' => (bool) $document->legacy_needs_review,
                    'office_name' => $document->office?->name ?? '',
                    'office_short_name' => $document->office?->short_name,
                    'document_type' => $document->documentType?->name ?? '',
                    'other_document_type' => $document->other_document_type ?? '',
                    'purpose_type' => $document->purposeType?->name ?? '',
                    'other_purpose' => $document->other_purpose ?? '',
                    'origin_type' => $document->origin_type ?? '',
                    'last_transaction' => $this->formatTrailTransaction($latest),
                    'last_transaction_summary' => $latest ? [
                        'action' => $latest->action ?: ucfirst(strtolower((string) $latest->status)),
                        'status' => $latest->status,
                        'from_office' => $latest->fromOffice?->name,
                        'from_office_short_name' => $latest->fromOffice?->short_name,
                        'to_office' => $latest->legacy_doc_trail_id ? $latest->legacyReceivingOffice?->name : $latest->toOffice?->name,
                        'to_office_short_name' => $latest->legacy_doc_trail_id ? $latest->legacyReceivingOffice?->short_name : $latest->toOffice?->short_name,
                        'holder' => $latest->legacy_doc_trail_id ? $latest->holderOffice?->name : $latest->toOffice?->name,
                        'holder_short_name' => $latest->legacy_doc_trail_id ? $latest->holderOffice?->short_name : $latest->toOffice?->short_name,
                        'created_by' => $latest->creator?->name,
                        'created_by_short_name' => trim(
                            (filled($latest->creator?->firstname) ? mb_substr(trim($latest->creator->firstname), 0, 1).'. ' : '').
                            ($latest->creator?->lastname ?? '')
                        ) ?: $latest->creator?->name,
                        'created_at' => $latest->created_at?->format('F j Y h:i:s A'),
                    ] : null,
                    'created_at' => $document->created_at?->format('F j Y h:i:s A'),
                    'created_at_timestamp' => $document->created_at?->timestamp,
                    'remarks' => $document->remarks ?? '',
                    'document_type_id' => $document->document_type_id,
                    'action_type_id' => $document->action_type_id,
                    'purpose_type_id' => $document->purpose_type_id,
                    'office_id' => $document->office_id,
                    'received_from' => $document->received_from,
                    'urgent' => $document->urgent,
                    'notify_by_email' => $document->notify_by_email,
                    'source' => 'New DB',
                    'is_finalized' => (bool) $document->is_finalized,
                    'can_update' => $isDraft && ($isAdministrator || ($isOriginOffice && (int) $document->created_by === (int) $user?->id)),
                    'can_release' => ! $document->legacy_needs_review && ! $document->is_archived && $isPendingHolder,
                    'can_terminal' => ! $document->legacy_needs_review && ! $document->is_archived && $isPendingHolder,
                    'can_receive' => ! $document->legacy_needs_review && ! $document->is_archived && $isIncoming && $user->canReceiveDocuments(),
                    'can_delete' => $isDraft && ($isAdministrator || ($isOriginOffice && (int) $document->created_by === (int) $user?->id)),
                ];
            });

        return Inertia::render('Documents/Index', [
            'documents' => $newDocuments->items(),
            'pagination' => [
                'current_page' => $newDocuments->currentPage(),
                'last_page' => $newDocuments->lastPage(),
                'total' => $newDocuments->total(),
                'from' => $newDocuments->firstItem(),
                'to' => $newDocuments->lastItem(),
                'per_page' => $newDocuments->perPage(),
            ],
            'filters' => [
                'search' => $search,
                'status' => $statusFilter,
                'sort' => $sortKey,
                'direction' => $sortDirection,
            ],
            'editDraftId' => request()->query('edit_draft_id'),
            'title' => $latestOnly ? 'Latest Documents' : 'All Documents',
            ...$this->documentFormOptions(),
        ]);
    }

    public function incoming()
    {
        $user = auth()->user();
        $documents = app(DocumentAccess::class)->scope(Document::query(), $user)
            ->with(['documentType', 'office', 'creator'])
            ->where('status', 'pending')
            ->latest('created_at')
            ->limit(200)
            ->get();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'title' => 'Incoming Documents',
            ...$this->documentFormOptions(),
        ]);
    }

    public function outgoing()
    {
        $user = auth()->user();
        $documents = app(DocumentAccess::class)->scope(Document::query(), $user)
            ->with(['documentType', 'office', 'creator'])
            ->where('status', 'processed')
            ->latest('created_at')
            ->limit(200)
            ->get();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'title' => 'Outgoing Documents',
            ...$this->documentFormOptions(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'approved_draft_id' => ['nullable', 'integer', 'exists:document_creation_drafts,id'],
            'title' => ['required_without:approved_draft_id', 'nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'document_type_id' => ['required_without:approved_draft_id', 'nullable', 'integer', 'exists:document_types,id'],
            'action_type_id' => ['nullable', 'integer', 'exists:action_types,id'],
            'other_action' => ['nullable', 'string', 'max:255'],
            'purpose_type_id' => ['nullable', 'integer', 'exists:purpose_types,id'],
            'other_document_type' => ['nullable', 'string', 'max:255'],
            'other_purpose' => ['nullable', 'string', 'max:255'],
            'origin_type' => ['nullable', 'string', 'max:100'],
            'urgent' => ['boolean'],
            'notify_by_email' => ['boolean'],
            'is_finalized' => ['required', 'boolean'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        $approvedDraft = null;
        if ($validated['approved_draft_id'] ?? null) {
            $approvedDraft = DocumentCreationDraft::query()
                ->whereKey($validated['approved_draft_id'])
                ->whereNull('archived_at')
                ->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered'])
                ->where('created_by', auth()->id())
                ->first();
            abort_unless($approvedDraft, 422, 'The approved document is no longer available for finalization.');
            $validated['title'] = $approvedDraft->title;
            $validated['document_type_id'] = $approvedDraft->document_type_id;
            $validated['is_finalized'] = true;
        }
        $validated = $this->normalizeActionTypeDetails($validated);
        $validated = $this->normalizeDocumentTypeAndPurpose($validated);

        $document = null;
        $initialTrail = null;
        DB::transaction(function () use ($validated, $approvedDraft, &$document, &$initialTrail) {
            $user = auth()->user();
            $access = app(DocumentAccess::class);
            $officeId = $access->currentOfficeId($user);
            $userOffice = $officeId ? Office::query()->find($officeId) : null;
            $date = now();
            $officeName = trim((string) $userOffice?->short_name) ?: ($userOffice?->name ?: 'DOTS');
            $bureauPrefix = trim(
                preg_replace('/-+/', '-', preg_replace('/\s+/', '-', trim($officeName))),
                '-'
            );

            $document = Document::create([
                'title' => $validated['title'],
                'tracking_number' => 'draft-'.Str::uuid(),
                'status' => $validated['is_finalized'] ? 'pending' : 'draft',
                'remarks' => $validated['remarks'] ?? null,
                'document_type_id' => $validated['document_type_id'] ?? null,
                'action_type_id' => $validated['action_type_id'] ?? null,
                'other_action' => $validated['other_action'],
                'purpose_type_id' => $validated['purpose_type_id'] ?? null,
                'other_document_type' => $validated['other_document_type'],
                'other_purpose' => $validated['other_purpose'],
                'origin_type' => $validated['origin_type'] ?? null,
                'office_id' => $officeId,
                'urgent' => $validated['urgent'] ?? false,
                'notify_by_email' => $validated['notify_by_email'] ?? false,
                'is_finalized' => $validated['is_finalized'],
                'created_by' => auth()->id(),
            ]);

            $document->update([
                'tracking_number' => $bureauPrefix.'-'.$date->format('y-m-d').'-'.str_pad((string) $document->id, 4, '0', STR_PAD_LEFT),
            ]);

            if ($validated['is_finalized']) {
                $initialTrail = $document->trails()->create([
                    'from_office_id' => $officeId,
                    'created_by' => auth()->id(),
                    'status' => 'pending',
                    'action' => 'Finalized',
                ]);
            }

            if ($approvedDraft) {
                $approvedDraft = DocumentCreationDraft::query()->whereNull('archived_at')->lockForUpdate()->findOrFail($approvedDraft->id);
                // Keep the first registration link; events link every subsequent submission.
                $approvedDraft->update(['official_document_id' => $approvedDraft->official_document_id ?? $document->id, 'status' => 'registered']);
                $approvedDraft->events()->create([
                    'user_id' => auth()->id(),
                    'event' => 'Registered in DOTS',
                    'metadata' => ['document_id' => $document->id, 'tracking_number' => $document->tracking_number],
                ]);
            }

        });

        if ($request->hasFile('file')) {
            $this->storeDocumentFile($document, $request->file('file'), 'original', $initialTrail);
        } elseif ($approvedDraft) {
            $path = 'documents/'.$document->tracking_number.'.pdf';
            $pdf = $this->approvedDraftPdf($approvedDraft);
            Storage::disk('document_private')->put($path, $pdf->output());
            $document->files()->create([
                'file_name' => basename($path),
                'original_name' => $document->title.'.pdf',
                'file_path' => $path,
                'mime_type' => 'application/pdf',
                'size_bytes' => Storage::disk('document_private')->size($path),
                'uploaded_by' => auth()->id(),
                'type' => 'original',
                'document_trail_id' => $initialTrail?->id,
            ]);
            app(AuditTrailWriter::class)->record('document.attachment_uploaded', $document, [
                'tracking_number' => $document->tracking_number,
                'file_name' => $document->title.'.pdf',
                'type' => 'original',
            ]);
        }

        app(AuditTrailWriter::class)->record(
            $approvedDraft ? 'document.registered' : 'document.created',
            $document,
            ['tracking_number' => $document->tracking_number, 'title' => $document->title],
        );

        return redirect()->route('documents.index')->with('success', 'Document created successfully.');
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'document_type_id' => ['nullable', 'integer', 'exists:document_types,id'],
            'action_type_id' => ['nullable', 'integer', 'exists:action_types,id'],
            'other_action' => ['nullable', 'string', 'max:255'],
            'purpose_type_id' => ['nullable', 'integer', 'exists:purpose_types,id'],
            'other_document_type' => ['nullable', 'string', 'max:255'],
            'other_purpose' => ['nullable', 'string', 'max:255'],
            'origin_type' => ['nullable', 'string', 'max:100'],
            'urgent' => ['boolean'],
            'notify_by_email' => ['boolean'],
            'is_finalized' => ['required', 'boolean'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        $validated = $this->normalizeActionTypeDetails($validated);
        $validated = $this->normalizeDocumentTypeAndPurpose($validated);

        $document = Document::findOrFail($id);
        abort_unless($this->canManageDraft($document), 403);

        $before = $document->only([
            'title', 'remarks', 'document_type_id', 'action_type_id', 'other_action',
            'purpose_type_id', 'other_document_type', 'other_purpose', 'origin_type',
            'urgent', 'notify_by_email', 'is_finalized',
        ]);
        $document->update([
            'title' => $validated['title'],
            'status' => $validated['is_finalized'] ? 'pending' : 'draft',
            'remarks' => $validated['remarks'] ?? null,
            'document_type_id' => $validated['document_type_id'] ?? null,
            'action_type_id' => $validated['action_type_id'] ?? null,
            'other_action' => $validated['other_action'],
            'purpose_type_id' => $validated['purpose_type_id'] ?? null,
            'other_document_type' => $validated['other_document_type'],
            'other_purpose' => $validated['other_purpose'],
            'origin_type' => $validated['origin_type'] ?? null,
            'urgent' => $validated['urgent'] ?? false,
            'notify_by_email' => $validated['notify_by_email'] ?? false,
            'is_finalized' => $validated['is_finalized'],
        ]);

        $finalizationTrail = null;
        if ($validated['is_finalized']) {
            $finalizationTrail = $document->trails()->create([
                'from_office_id' => $document->office_id,
                'created_by' => auth()->id(),
                'status' => 'pending',
                'action' => 'Finalized',
            ]);
        }

        if ($file = $request->file('file')) {
            $this->storeDocumentFile($document, $file, 'version', $finalizationTrail);
        }

        $after = $document->only(array_keys($before));
        $changes = collect($after)->filter(fn ($value, $key) => $value !== $before[$key])
            ->map(fn ($value, $key) => ['before' => $before[$key], 'after' => $value])->all();
        app(AuditTrailWriter::class)->record('document.updated', $document, [
            'tracking_number' => $document->tracking_number,
            'changes' => $changes,
        ]);

        return redirect()->route('documents.index')->with('success', 'Document updated successfully.');
    }

    public function release(Request $request, $id)
    {
        $validated = $request->validate([
            'action_type_id' => ['required', 'integer', 'exists:action_types,id'],
            'other_action' => ['nullable', 'string', 'max:255'],
            'to_office_id' => ['required', 'integer', 'exists:offices,id'],
            'remarks' => ['nullable', 'string', 'max:250'],
            'document_source' => ['nullable', 'in:current,upload,approved'],
            'approved_draft_id' => ['required_if:document_source,approved', 'nullable', 'integer', 'prohibited_unless:document_source,approved'],
            'file' => ['required_if:document_source,upload', 'prohibited_if:document_source,current,approved', 'nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        $validated = $this->normalizeActionTypeDetails($validated);
        $targetOffice = Office::findOrFail($validated['to_office_id']);
        if (! $this->officeIsInCurrentUserRange($targetOffice)) {
            throw ValidationException::withMessages([
                'to_office_id' => 'Choose a receiving office within your assigned office range.',
            ]);
        }
        if (! $this->officeHasActiveUsers($targetOffice)) {
            throw ValidationException::withMessages([
                'to_office_id' => 'Choose a receiving office with at least one active user.',
            ]);
        }
        $document = Document::with('latestTrail')->findOrFail($id);
        $this->authorizeCurrentHolder($document);
        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());
        $sourceOfficeName = Office::query()->whereKey($officeId)->value('name');

        $approvedPath = null;
        try {
            $trail = DB::transaction(function () use ($document, $validated, $officeId, $sourceOfficeName, $targetOffice, &$approvedPath) {
                $approvedDraft = null;
                if (($validated['document_source'] ?? null) === 'approved') {
                    $approvedDraft = DocumentCreationDraft::query()
                        ->whereKey($validated['approved_draft_id'])
                        ->where('created_by', auth()->id())
                        ->whereNull('archived_at')
                        ->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered'])
                        ->lockForUpdate()
                        ->first();
                    if (! $approvedDraft) {
                        throw ValidationException::withMessages([
                            'approved_draft_id' => 'This approved document is no longer available. Choose another document.',
                        ]);
                    }
                }
                $trail = $document->trails()->create([
                    'from_office_id' => $officeId,
                    'to_office_id' => $validated['to_office_id'],
                    'created_by' => auth()->id(),
                    'status' => 'available',
                    'action' => 'Released - '.$validated['action_type_name'].(mb_strtolower($validated['action_type_name']) === 'others' ? ': '.$validated['other_action'] : ''),
                    'remarks' => $validated['remarks'] ?? null,
                ]);
                $document->update(['status' => 'available']);
                app(AuditTrailWriter::class)->record('document.released', $document, [
                    'tracking_number' => $document->tracking_number,
                    'from_office_id' => $officeId,
                    'from_office_name' => $sourceOfficeName,
                    'to_office_id' => $targetOffice->id,
                    'to_office_name' => $targetOffice->name,
                    'action_type' => $validated['action_type_name'],
                ]);

                if ($approvedDraft) {
                    $pdf = $this->approvedDraftPdf($approvedDraft)->output();
                    $approvedPath = 'documents/versions/'.Str::uuid().'.pdf';
                    if (! Storage::disk('document_private')->put($approvedPath, $pdf)) {
                        throw new \RuntimeException('Could not save the approved document version.');
                    }
                    $document->files()->create([
                        'document_trail_id' => $trail->id,
                        'type' => 'version',
                        'file_name' => basename($approvedPath),
                        'original_name' => $approvedDraft->title.'.pdf',
                        'file_path' => $approvedPath,
                        'mime_type' => 'application/pdf',
                        'size_bytes' => strlen($pdf),
                        'uploaded_by' => auth()->id(),
                    ]);
                    $metadata = [
                        'document_id' => $document->id,
                        'tracking_number' => $document->tracking_number,
                        'document_trail_id' => $trail->id,
                        'approved_draft_id' => $approvedDraft->id,
                        'approved_draft_title' => $approvedDraft->title,
                        'approved_draft_version' => $approvedDraft->version_number,
                        'file_name' => $approvedDraft->title.'.pdf',
                        'type' => 'version',
                    ];
                    $approvedDraft->events()->create([
                        'user_id' => auth()->id(),
                        'event' => 'Used in document forwarding',
                        'metadata' => $metadata,
                    ]);
                    app(AuditTrailWriter::class)->record('document.version_added', $document, $metadata);
                }

                return $trail;
            });

        } catch (\Throwable $exception) {
            if ($approvedPath) {
                Storage::disk('document_private')->delete($approvedPath);
            }
            throw $exception;
        }

        if ($file = $request->file('file')) {
            $this->storeDocumentFile($document, $file, 'version', $trail);
        }

        return back()->with('success', 'Document released successfully.');
    }

    public function receive($id)
    {
        $user = auth()->user();
        abort_unless($user->canReceiveDocuments(), 403, 'Your role cannot receive documents.');

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        abort_unless($officeId, 403, 'Your account is not assigned to an office.');

        $document = DB::transaction(function () use ($id, $officeId, $user) {
            $document = Document::query()->lockForUpdate()->findOrFail($id);
            abort_if($document->legacy_needs_review || $document->is_archived, 403, 'This document needs review or is archived.');
            $latestTrail = $document->trails()->orderByDesc('id')->lockForUpdate()->first();

            if (! (
                $latestTrail
                    && strtolower((string) $latestTrail->status) === 'available'
                    && (int) $latestTrail->to_office_id === $officeId
            )) {
                throw ValidationException::withMessages([
                    'tracking_number' => 'This document is no longer available for your office to receive.',
                ]);
            }

            $latestTrail->loadMissing('fromOffice');
            $receivedAt = now();
            $document->trails()->create([
                // The AVAILABLE trail's sender is the originating office for this receipt.
                'from_office_id' => $latestTrail->from_office_id,
                // In the local schema, to_office_id represents both receiving and holder.
                'to_office_id' => $officeId,
                'created_by' => $user->id,
                'status' => 'pending',
                'action' => 'Received',
                'created_at' => $receivedAt,
                'updated_at' => $receivedAt,
            ]);
            $document->update([
                'status' => 'pending',
                'received_at' => $receivedAt,
                'received_from' => $latestTrail->fromOffice?->name,
            ]);

            $document->loadMissing('creator');
            app(AuditTrailWriter::class)->record('document.received', $document, [
                'tracking_number' => $document->tracking_number,
                'office_id' => $officeId,
                'from_office_id' => $latestTrail->from_office_id,
                'from_office_name' => $latestTrail->fromOffice?->name,
                'office_name' => $user->office?->name,
            ], actor: $user);

            return $document;
        });

        if ($document->notify_by_email) {
            $creator = $document->creator;
            $reason = match (true) {
                ! $creator => 'creator_missing',
                ! filter_var($creator->email, FILTER_VALIDATE_EMAIL) => 'creator_email_invalid',
                ! GmailConnection::query()->exists() => 'sender_not_connected',
                default => null,
            };

            if ($reason !== null) {
                Log::notice('Document tracking email was not queued.', [
                    'document_id' => $document->id,
                    'reason' => $reason,
                ]);
            } else {
                SendDocumentTrackingReceivedEmail::dispatch(
                    recipientEmail: $creator->email,
                    recipientName: $creator->name,
                    documentTitle: $document->title,
                    trackingNumber: $document->tracking_number,
                    receivingOfficeName: $user->office?->name ?? 'its destination office',
                )->afterCommit();

                Log::info('Document tracking email was queued.', [
                    'document_id' => $document->id,
                    'tracking_number' => $document->tracking_number,
                    'creator_id' => $creator->id,
                ]);
            }
        }

        return back()->with('success', 'Document received successfully.');
    }

    public function tagTerminal($id)
    {
        $document = Document::with('latestTrail')->findOrFail($id);
        $this->authorizeCurrentHolder($document);

        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());
        DB::transaction(function () use ($document, $officeId) {
            $document->trails()->create([
                'from_office_id' => $officeId,
                'created_by' => auth()->id(),
                'status' => 'terminal',
                'action' => 'Tagged as Terminal',
            ]);
            $document->update(['status' => 'terminal', 'is_archived' => true, 'archived_at' => now()]);
            $writer = app(AuditTrailWriter::class);
            $writer->record('document.terminal_tagged', $document, [
                'tracking_number' => $document->tracking_number,
                'office_id' => $officeId,
            ]);
            $writer->record('document.archived', $document, [
                'tracking_number' => $document->tracking_number,
                'reason' => 'Tagged as terminal',
            ]);
        });

        return back()->with('success', 'Document tagged as terminal.');
    }

    public function destroy($id)
    {
        $document = Document::findOrFail($id);
        abort_unless($this->canManageDraft($document), 403);
        app(AuditTrailWriter::class)->record('document.deleted', $document, [
            'tracking_number' => $document->tracking_number,
            'title' => $document->title,
        ]);
        $document->delete();

        return back()->with('success', 'Draft deleted successfully.');
    }

    private function canManageDraft(Document $document): bool
    {
        $user = auth()->user();
        $admin = $user?->isAdministrator() ?? false;
        $draft = ! $document->is_archived && ! $document->legacy_needs_review && ! $document->is_finalized && strtolower((string) $document->status) === 'draft';
        $officeId = $user ? app(DocumentAccess::class)->currentOfficeId($user) : null;
        $originOffice = $officeId && (int) $document->office_id === (int) $officeId;

        return $draft && ($admin || ($originOffice && (int) $document->created_by === (int) $user?->id));
    }

    private function normalizeActionTypeDetails(array $validated): array
    {
        $actionType = isset($validated['action_type_id']) ? ActionType::find($validated['action_type_id']) : null;
        $actionTypeName = trim((string) $actionType?->name);
        $isOtherAction = mb_strtolower($actionTypeName) === 'others';

        if ($isOtherAction && ! filled($validated['other_action'] ?? null)) {
            throw ValidationException::withMessages([
                'other_action' => 'Please specify the action when selecting Others.',
            ]);
        }

        $validated['action_type_name'] = $actionTypeName;
        $validated['other_action'] = $isOtherAction ? trim((string) $validated['other_action']) : null;

        return $validated;
    }

    private function normalizeDocumentTypeAndPurpose(array $validated): array
    {
        $documentType = isset($validated['document_type_id']) ? DocumentType::find($validated['document_type_id']) : null;
        $purposeType = isset($validated['purpose_type_id']) ? PurposeType::find($validated['purpose_type_id']) : null;
        $isOtherDocumentType = mb_strtolower(trim((string) $documentType?->name)) === 'others';
        $isOtherPurpose = mb_strtolower(trim((string) $purposeType?->name)) === 'others';

        if ($isOtherDocumentType && ! filled($validated['other_document_type'] ?? null)) {
            throw ValidationException::withMessages([
                'other_document_type' => 'Please specify the document type when selecting Others.',
            ]);
        }

        if ($isOtherPurpose && ! filled($validated['other_purpose'] ?? null)) {
            throw ValidationException::withMessages([
                'other_purpose' => 'Please specify the purpose when selecting Others.',
            ]);
        }

        $validated['other_document_type'] = $isOtherDocumentType ? trim((string) $validated['other_document_type']) : null;
        $validated['other_purpose'] = $isOtherPurpose ? trim((string) $validated['other_purpose']) : null;

        return $validated;
    }

    private function authorizeCurrentHolder(Document $document): void
    {
        abort_if($document->legacy_needs_review || $document->is_archived, 403, 'This document needs review or is archived.');
        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());
        $latest = $document->latestTrail;
        $holderOfficeId = $latest?->to_office_id ?? $document->office_id;

        abort_unless($officeId && strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
            && (int) $holderOfficeId === (int) $officeId, 403);
    }

    private function documentFormOptions(): array
    {
        $receivingOffices = Office::query()
            ->with('range:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'range_id', 'legacy_range_id'])
            ->filter(fn (Office $office) => $this->officeIsInCurrentUserRange($office))
            ->values();
        $officesWithActiveUsers = User::query()
            ->whereIn('office_id', $receivingOffices->modelKeys())
            ->where('is_active', true)
            ->distinct()
            ->pluck('office_id')
            ->flip();
        $receivingOffices = $receivingOffices
            ->map(fn (Office $office) => [
                'id' => (string) $office->id,
                'name' => $office->name,
                'source' => 'New DB',
                'disabled' => ! $officesWithActiveUsers->has($office->id),
            ])
            ->values()
            ->all();

        return [
            'maxUploadSizeKb' => self::MAX_DOCUMENT_UPLOAD_KB,
            'approvedDocuments' => DocumentCreationDraft::query()
                ->with('documentType:id,name')
                ->whereNull('archived_at')
                ->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered'])
                ->where('created_by', auth()->id())
                ->latest('decision_at')
                ->get(['id', 'title', 'document_type_id', 'status'])
                ->map(fn (DocumentCreationDraft $draft) => [
                    'id' => $draft->id,
                    'title' => $draft->title,
                    'document_type_id' => $draft->document_type_id,
                    'document_type' => $draft->documentType?->name,
                    'status' => $draft->status,
                    'disabled' => false,
                ])
                ->values()
                ->all(),
            'documentTypes' => DocumentType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])
                ->map(fn ($type) => ['id' => (string) $type->id, 'name' => $type->name, 'source' => 'New DB'])
                ->all(),
            'actionTypes' => ActionType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])
                ->map(fn ($type) => ['id' => (string) $type->id, 'name' => $type->name, 'source' => 'New DB'])
                ->all(),
            'purposeTypes' => PurposeType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])
                ->map(fn ($type) => ['id' => (string) $type->id, 'name' => $type->name, 'source' => 'New DB'])
                ->all(),
            'officeRangeLabel' => auth()->user()?->office?->range?->name,
            'offices' => $receivingOffices,
        ];
    }

    private function approvedDraftPdf(DocumentCreationDraft $draft): RenderedDocumentPdf
    {
        $pdf = app(DocumentPdf::class);

        return $pdf->pdf($draft->title, $pdf->approvedContent($draft));
    }

    private function formatTrailTransaction(?DocumentTrail $trail): string
    {
        if (! $trail) {
            return 'No transactions recorded';
        }

        $parts = [filled($trail->action) ? $trail->action : ucfirst(strtolower((string) $trail->status))];
        $fromOffice = trim((string) $trail->fromOffice?->short_name) ?: $trail->fromOffice?->name;
        $toOffice = trim((string) $trail->toOffice?->short_name) ?: $trail->toOffice?->name;
        if ($fromOffice && $toOffice) {
            $parts[] = $fromOffice.' → '.$toOffice;
        } elseif ($fromOffice) {
            $parts[] = 'From '.$fromOffice;
        } elseif ($toOffice) {
            $parts[] = 'To '.$toOffice;
        }
        if ($trail->creator?->name) {
            $parts[] = 'by '.$trail->creator->name;
        }
        if ($trail->created_at) {
            $parts[] = $trail->created_at->format('M j, Y g:i A');
        }

        return implode(' · ', $parts);
    }

    private function workflowStatus(?string $status): string
    {
        return match (strtolower(trim((string) $status))) {
            'pending', 'ongoing' => 'ongoing',
            'available', 'processed', 'released' => 'released',
            'terminal', 'archived' => 'archived',
            default => strtolower(trim((string) ($status ?: 'draft'))),
        };
    }

    private function currentUserRangeIdentity(): ?array
    {
        if ($this->userRangeResolved) {
            return $this->userRangeIdentity;
        }
        $this->userRangeResolved = true;

        $user = auth()->user();
        if (! $user) {
            return null;
        }

        $office = $user->office_id
            ? Office::query()->with('range')->find($user->office_id, ['id', 'name', 'code', 'range_id', 'legacy_range_id'])
            : null;

        return $this->userRangeIdentity = $office ? $this->officeRangeIdentity($office) : null;
    }

    private function officeIsInCurrentUserRange(Office $office): bool
    {
        $userRange = $this->currentUserRangeIdentity();
        $officeRange = $this->officeRangeIdentity($office);

        return $userRange !== null && $userRange === $officeRange;
    }

    private function officeRangeIdentity(Office $office): ?array
    {
        if ($office->range_id !== null && $office->range) {
            return ['source' => 'new', 'id' => (int) $office->range_id];
        }

        return null;
    }

    private function officeHasActiveUsers(Office $office): bool
    {
        return User::query()->where('office_id', $office->id)->where('is_active', true)->exists();
    }

    private function storeDocumentFile(Document $document, UploadedFile $file, string $type, ?DocumentTrail $trail = null): void
    {
        $officeName = $document->office?->name ?: 'DOTS';
        $username = auth()->user()?->username ?: 'unknown-user';
        $directory = implode('/', [
            'documents',
            now()->format('m-Y'),
            Str::slug($officeName) ?: 'office',
            Str::slug($username) ?: 'user',
            now()->format('Ymd_His'),
        ]);
        $path = $file->store($directory, 'document_private');

        $storedFile = $document->files()->create([
            'document_trail_id' => $trail?->id,
            'type' => $type,
            'file_name' => basename($path),
            'original_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'uploaded_by' => auth()->id(),
        ]);
        app(AuditTrailWriter::class)->record(
            $type === 'version' ? 'document.version_added' : 'document.attachment_uploaded',
            $document,
            [
                'tracking_number' => $document->tracking_number,
                'file_name' => $storedFile->original_name,
                'type' => $type,
                'size_bytes' => $storedFile->size_bytes,
            ],
        );
    }
}
