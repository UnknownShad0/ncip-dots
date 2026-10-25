<?php

namespace App\Http\Controllers;

use App\Jobs\SendDocumentRouteNotification;
use App\Jobs\SendDocumentTrackingReceivedEmail;
use App\Models\ActionType;
use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentRoute;
use App\Models\DocumentRouteStep;
use App\Models\DocumentTrail;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\PurposeType;
use App\Models\User;
use App\Services\AuditTrailWriter;
use App\Services\DocumentAccess;
use App\Services\DocumentPdf;
use App\Services\EmailNotificationMailer;
use App\Services\RenderedDocumentPdf;
use App\Services\TrackingNumberPdfStamper;
use App\Support\DateTimePresenter;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class DocumentController extends Controller
{
    private const MAX_DOCUMENT_UPLOAD_KB = 102400;

    private const MAX_SUPPORTING_FILES = 5;

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
                'latestRoute.fromOffice', 'latestRoute.steps.office', 'latestRoute.steps.receiver', 'latestRoute.steps.decider',
                'routes.fromOffice', 'routes.steps.office', 'routes.steps.receiver', 'routes.steps.decider',
            ])
            ->findOrFail($id);
        $latestFile = $document->files->sortByDesc('id')->first();
        $rootRoute = $document->routes->whereNull('parent_step_id')->sortByDesc('id')->first();
        $currentOfficeId = app(DocumentAccess::class)->currentOfficeId($user);
        $activeRouteStep = $currentOfficeId
            ? $this->findRouteStepForOffice($document, (int) $currentOfficeId, 'in_progress')
            : null;
        $editableRoute = $this->findEditableApprovalRoute($document, $user);

        return response()->json([
            'document_type' => $document->documentType?->name ?? '',
            'other_document_type' => $document->other_document_type,
            'purpose_type' => $document->purposeType?->name ?? '',
            'origin_type' => $document->origin_type ?? '',
            'approval_status' => $document->approval_status ?? 'not_required',
            'signature_status' => $document->signature_status ?? 'not_required',
            'can_approve' => $this->canApproveDocument($document, $user),
            'can_receive' => $document->routes->isNotEmpty()
                ? $this->canReceiveRouteStep($document, $user)
                : $this->canReceiveLegacyDocument($document, $user),
            'can_release' => $this->canForwardDocument($document, $user),
            'forwarding_under' => $activeRouteStep ? $activeRouteStep[1]->office?->name : null,
            'forwarding_blocked_office_ids' => $activeRouteStep ? $this->branchAncestorOfficeIds($activeRouteStep[1]) : [],
            'editable_route' => $editableRoute ? [
                'id' => $editableRoute->id,
                'mode' => $editableRoute->mode,
                'revision' => $this->routeRevisionToken($editableRoute),
                'from_office' => $editableRoute->fromOffice?->name,
                'steps' => $editableRoute->steps->sortBy('position')->map(fn (DocumentRouteStep $step) => [
                    'id' => $step->id,
                    'office_id' => $step->office_id,
                    'office' => $step->office?->name,
                    'position' => $step->position,
                    'status' => $step->status,
                    'received_by' => $step->receiver?->name,
                    'received_at' => DateTimePresenter::format($step->received_at, 'F j Y h:i:s A'),
                    'decided_by' => $step->decider?->name,
                    'decided_at' => DateTimePresenter::format($step->decided_at, 'F j Y h:i:s A'),
                ])->values(),
            ] : null,
            'route_mode' => $rootRoute?->mode,
            'route_status' => $rootRoute?->status,
            'route_from_office' => $rootRoute?->fromOffice?->name ?? $document->office?->name,
            'route_steps' => $rootRoute?->steps->map(fn (DocumentRouteStep $step) => [
                'id' => $step->id,
                'office_id' => $step->office_id,
                'office' => $step->office?->name,
                'position' => $step->position,
                'status' => $step->status,
                'decision' => $step->decision,
                'remarks' => $step->decision_remarks,
                'received_by' => $step->receiver?->name,
                'received_at' => DateTimePresenter::format($step->received_at, 'F j Y h:i:s A'),
                'decided_by' => $step->decider?->name,
                'decided_at' => DateTimePresenter::format($step->decided_at, 'F j Y h:i:s A'),
            ])->values() ?? [],
            'route_tree' => $this->serializeRouteTree($document),
            'file_name' => $latestFile?->original_name ?? $latestFile?->file_name,
            'file_url' => $latestFile?->downloadUrl(),
            'files' => $document->files->sortBy('id')->map(fn ($file) => [
                'id' => $file->id,
                'name' => $file->original_name ?: $file->file_name,
                'type' => $file->type ?: 'original',
                'url' => $file->downloadUrl(),
                'view_url' => $file->previewUrl(),
                'is_pdf' => $file->isPdf(),
                'uploaded_at' => DateTimePresenter::format($file->created_at, 'M j, Y g:i A'),
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
                'created_at' => DateTimePresenter::format($trail->created_at, 'F j Y h:i:s A'),
                'created_at_timestamp' => $trail->created_at?->timestamp,
                'id' => $trail->id,
            ]),
            'created_by_name' => $document->creator?->name ?? '',
        ]);
    }

    public function downloadFile(int $document, int $file)
    {
        [$attachment, $disk, $relativePath] = $this->resolveDocumentFile($document, $file);

        $filename = basename((string) ($attachment->original_name ?: $attachment->file_name));
        $filename = preg_replace('/[\\x00-\\x1F\\x7F]/u', '', $filename) ?: 'document';

        return response()->download($disk->path($relativePath), $filename, [
            'Content-Type' => 'application/octet-stream',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function viewFile(int $document, int $file)
    {
        [$attachment, $disk, $relativePath] = $this->resolveDocumentFile($document, $file);
        $filename = basename((string) ($attachment->original_name ?: $attachment->file_name));
        $filename = preg_replace('/[\\x00-\\x1F\\x7F]/u', '', $filename) ?: 'document';
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $expectedMimeType = match ($extension) {
            'pdf' => 'application/pdf',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            default => null,
        };
        $mimeType = $disk->mimeType($relativePath);

        abort_unless($expectedMimeType !== null && $mimeType === $expectedMimeType, 415);

        $headerFilename = addcslashes($filename, '\\"');

        return response()->file($disk->path($relativePath), [
            'Content-Type' => $mimeType,
            'Content-Disposition' => 'inline; filename="'.$headerFilename.'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function resolveDocumentFile(int $document, int $file): array
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

        return [$attachment, $disk, $relativePath];
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
                    'created_at' => DateTimePresenter::format($document->dateCreated, 'F j Y h:i:s A'),
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
                        DateTimePresenter::format($transaction?->dateCreated, 'M j, Y g:i A'),
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
                        'created_at' => DateTimePresenter::format($trail->dateCreated, 'F j Y h:i:s A'),
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
            ->select(['documents.id', 'documents.legacy_doc_id', 'documents.legacy_needs_review', 'documents.is_archived', 'documents.tracking_number', 'documents.title', 'documents.status', 'documents.approval_status', 'documents.signature_status', 'documents.office_id', 'documents.created_by', 'documents.is_finalized', 'documents.remarks', 'documents.document_type_id', 'documents.action_type_id', 'documents.other_action', 'documents.purpose_type_id', 'documents.other_document_type', 'documents.other_purpose', 'documents.origin_type', 'documents.received_from', 'documents.urgent', 'documents.notify_by_email', 'documents.created_at'])
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
                        'view_url' => $file->previewUrl(),
                        'is_pdf' => $file->isPdf(),
                        'uploaded_at' => DateTimePresenter::format($file->created_at, 'M j, Y g:i A'),
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
                        'created_at' => DateTimePresenter::format($trail->created_at, 'F j Y h:i:s A'),
                    ]),
                    'created_at' => DateTimePresenter::format($document->created_at, 'F j Y h:i:s A'),
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
            'status' => ['nullable', 'in:all,pending,ongoing,approved,released,archived,changes_requested,rejected'],
            'sort' => ['nullable', 'in:tracking_number,title,document_type,origin_type,status,office_name,last_transaction'],
            'direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'in:5,10,15,20,50'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $search = trim((string) ($filters['search'] ?? ''));
        $requestedStatus = $filters['status'] ?? 'all';
        $statusFilter = $requestedStatus === 'archived' ? 'all' : $requestedStatus;
        $sortKey = $filters['sort'] ?? null;
        $sortDirection = $filters['direction'] ?? 'asc';
        $perPage = (int) ($filters['per_page'] ?? 10);
        $openDocumentId = request()->integer('open_document_id');
        $createRoutingDraftId = request()->integer('create_routing_draft_id');
        $access = app(DocumentAccess::class);
        $currentOfficeId = $access->currentOfficeId($user);
        $isAdministrator = $access->canViewAllDocuments($user);
        $newDocumentQuery = $access->scope(Document::query(), $user)
            ->where('documents.is_archived', false);
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

        if ($openDocumentId > 0 && $editDraftId === 0) {
            $newDocumentQuery->where('documents.id', $openDocumentId);
            $search = '';
        }

        if ($latestOnly) {
            $newDocumentQuery->where('created_at', '>=', now()->subDays(15));
        }
        $latestStatusValue = "CASE WHEN EXISTS (SELECT 1 FROM document_routes AS active_route WHERE active_route.document_id = documents.id AND active_route.status = 'pending') THEN 'pending' ELSE COALESCE((SELECT latest_route.status FROM document_routes AS latest_route WHERE latest_route.document_id = documents.id ORDER BY latest_route.id DESC LIMIT 1), (SELECT latest_status.status FROM document_trails AS latest_status WHERE latest_status.document_id = documents.id ORDER BY latest_status.id DESC LIMIT 1), documents.status) END";
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
                }
            });
        }
        if ($statusFilter === 'pending') {
            $newDocumentQuery->where('documents.is_archived', false)
                ->where('documents.legacy_needs_review', false);
            if ($currentOfficeId === null) {
                $newDocumentQuery->whereRaw('1 = 0');
            } else {
                $newDocumentQuery->where(function ($pending) use ($currentOfficeId) {
                    $pending->whereExists(DB::table('document_trails as pending_trail')
                        ->selectRaw('1')
                        ->whereColumn('pending_trail.document_id', 'documents.id')
                        ->whereRaw('pending_trail.id = (SELECT MAX(latest_pending_trail.id) FROM document_trails AS latest_pending_trail WHERE latest_pending_trail.document_id = documents.id)')
                        ->where('pending_trail.status', 'pending')
                        ->where('pending_trail.to_office_id', $currentOfficeId))
                        ->orWhereExists(DB::table('document_route_steps as route_step')
                            ->join('document_routes as route', 'route.id', '=', 'route_step.document_route_id')
                            ->selectRaw('1')
                            ->whereColumn('route.document_id', 'documents.id')
                            ->where('route.status', 'pending')
                            ->where('route_step.office_id', $currentOfficeId)
                            ->whereIn('route_step.status', ['available', 'in_progress', 'waiting_on_branch']));
                });
            }
        } elseif ($statusFilter !== 'all') {
            $statusValues = match ($statusFilter) {
                'ongoing' => ['pending', 'ongoing'],
                'released' => ['available', 'processed', 'released'],
                default => [$statusFilter],
            };
            $newDocumentQuery->whereIn(DB::raw($latestStatusValue), $statusValues);
        }
        $newDocuments = $newDocumentQuery
            ->with([
                'office', 'documentType', 'purposeType',
                'latestTrail.creator', 'latestTrail.fromOffice', 'latestTrail.toOffice',
                'latestTrail.holderOffice', 'latestTrail.legacyReceivingOffice',
                'latestRoute.fromOffice', 'latestRoute.steps.office', 'latestRoute.steps.receiver', 'latestRoute.steps.decider',
                'routes.fromOffice', 'routes.steps.office', 'routes.steps.receiver', 'routes.steps.decider',
            ])
            ->select(['documents.id', 'documents.legacy_doc_id', 'documents.legacy_needs_review', 'documents.is_archived', 'documents.tracking_number', 'documents.title', 'documents.status', 'documents.approval_status', 'documents.signature_status', 'documents.office_id', 'documents.created_by', 'documents.is_finalized', 'documents.remarks', 'documents.document_type_id', 'documents.action_type_id', 'documents.other_action', 'documents.purpose_type_id', 'documents.other_document_type', 'documents.other_purpose', 'documents.origin_type', 'documents.received_from', 'documents.urgent', 'documents.notify_by_email', 'documents.created_at'])
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
            }, fn ($query) => $query->orderByRaw('COALESCE((SELECT latest_transaction.created_at FROM document_trails AS latest_transaction WHERE latest_transaction.document_id = documents.id ORDER BY latest_transaction.created_at DESC, latest_transaction.id DESC LIMIT 1), documents.created_at) DESC'))
            ->orderBy('documents.id', 'desc')
            ->paginate($perPage)
            ->withQueryString()
            ->through(function ($document) use ($currentOfficeId, $isAdministrator, $user) {
                $latest = $document->latestTrail;
                $routes = $document->routes;
                $rootRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();
                $routeTreeHasPending = $routes->contains(fn (DocumentRoute $candidate) => $candidate->status === 'pending');
                $isIncoming = strtolower((string) ($latest?->status ?? '')) === 'available'
                    && $currentOfficeId !== null && (int) $latest?->to_office_id === (int) $currentOfficeId;
                $isOriginOffice = $currentOfficeId !== null && (int) $document->office_id === (int) $currentOfficeId;
                $isDraft = ! $document->legacy_needs_review && ! $document->is_finalized && strtolower((string) $document->status) === 'draft';
                $routeIsPending = $routeTreeHasPending;

                return [
                    'id' => $document->id,
                    'tracking_number' => $document->tracking_number ?? '',
                    'tracking_url' => $document->tracking_number ? URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]) : null,
                    'title' => $document->title ?? '',
                    'status' => $document->is_archived ? 'archived' : ($routeIsPending ? 'pending' : $this->workflowStatus($latest?->status ?? $document->status)),
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
                        'created_at' => DateTimePresenter::format($latest->created_at, 'F j Y h:i:s A'),
                    ] : null,
                    'created_at' => DateTimePresenter::format($document->created_at, 'F j Y h:i:s A'),
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
                    'approval_status' => $document->approval_status ?? 'not_required',
                    'signature_status' => $document->signature_status ?? 'not_required',
                    'route_mode' => $rootRoute?->mode,
                    'route_status' => $rootRoute?->status,
                    'route_from_office' => $rootRoute?->fromOffice?->name ?? $document->office?->name,
                    'route_steps' => $rootRoute?->steps->map(fn (DocumentRouteStep $step) => [
                        'id' => $step->id,
                        'office_id' => $step->office_id,
                        'office' => $step->office?->name,
                        'position' => $step->position,
                        'status' => $step->status,
                        'decision' => $step->decision,
                        'remarks' => $step->decision_remarks,
                        'received_by' => $step->receiver?->name,
                        'received_at' => DateTimePresenter::format($step->received_at, 'F j Y h:i:s A'),
                        'decided_by' => $step->decider?->name,
                        'decided_at' => DateTimePresenter::format($step->decided_at, 'F j Y h:i:s A'),
                    ])->values() ?? [],
                    'route_tree' => $this->serializeRouteTree($document),
                    'can_approve' => $this->canApproveDocument($document, $user),
                    'can_update' => $isDraft && ($isAdministrator || ($isOriginOffice && (int) $document->created_by === (int) $user?->id)),
                    'can_release' => ! $document->legacy_needs_review && ! $document->is_archived
                        && $this->canForwardDocument($document, $user),
                    'can_terminal' => ! $document->legacy_needs_review && ! $document->is_archived
                        && $this->canTagDocumentTerminal($document, $user),
                    'can_receive' => ! $document->legacy_needs_review && ! $document->is_archived
                        && ($this->canReceiveRouteStep($document, $user) || ($routes->isEmpty() && $isIncoming && $user->canReceiveDocuments())),
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
            'openDocumentId' => $openDocumentId ?: null,
            'createRoutingDraftId' => $createRoutingDraftId ?: null,
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
            'signature_required' => ['sometimes', 'boolean'],
            'is_finalized' => ['required', 'accepted'],
            'file' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
            'supporting_files' => ['sometimes', 'array', 'max:'.self::MAX_SUPPORTING_FILES],
            'supporting_files.*' => ['file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        if (($validated['approved_draft_id'] ?? null) && $request->hasFile('file')) {
            throw ValidationException::withMessages([
                'file' => 'Choose either a generated document or an uploaded source file.',
            ]);
        }
        $approvedDraft = null;
        if ($validated['approved_draft_id'] ?? null) {
            $approvedDraft = DocumentCreationDraft::query()
                ->whereKey($validated['approved_draft_id'])
                ->whereNull('archived_at')
                ->whereIn('status', ['ready_for_routing', 'approved', 'awaiting_verification', 'verified', 'registered'])
                ->where('created_by', auth()->id())
                ->first();
            abort_unless($approvedDraft, 422, 'This generated document is no longer Ready for Routing.');
            $validated['title'] = $approvedDraft->title;
            $validated['document_type_id'] = $approvedDraft->document_type_id;
            $validated['is_finalized'] = true;
        }
        if ($validated['is_finalized'] && ! $approvedDraft && ! $request->hasFile('file')) {
            throw ValidationException::withMessages(['file' => 'Attach a source file before creating the routing record.']);
        }
        if (($validated['signature_required'] ?? false) && ! $approvedDraft
            && (! $request->hasFile('file') || strtolower($request->file('file')->getClientOriginalExtension()) !== 'pdf')) {
            throw ValidationException::withMessages(['signature_required' => 'Only an attached PDF can be marked as needing a signature.']);
        }
        $validated = $this->normalizeActionTypeDetails($validated);
        $validated = $this->normalizeDocumentTypeAndPurpose($validated);

        $document = null;
        $initialTrail = null;
        $storedPaths = [];
        try {
            DB::transaction(function () use ($request, $validated, $approvedDraft, &$document, &$initialTrail, &$storedPaths) {
                $user = auth()->user();
                $access = app(DocumentAccess::class);
                $officeId = $access->currentOfficeId($user);
                abort_unless($officeId, 422, 'Assign your account to an office before creating a routing record.');
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
                    // Approval starts only after the sender selects receiving offices
                    // in the Forward dialog. A new routing record has no approver yet.
                    'approval_status' => 'not_required',
                    'signature_status' => $validated['is_finalized'] && ($validated['signature_required'] ?? false) ? 'needs_signature' : 'not_required',
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
                        'action' => 'Created routing record; ready for routing',
                    ]);
                }

                if ($approvedDraft) {
                    $approvedDraft = DocumentCreationDraft::query()->whereNull('archived_at')->lockForUpdate()->findOrFail($approvedDraft->id);
                    abort_unless(in_array($approvedDraft->status, ['ready_for_routing', 'approved', 'awaiting_verification', 'verified', 'registered'], true)
                        && (int) $approvedDraft->created_by === (int) auth()->id(), 409, 'This generated document is no longer available for routing.');
                    $approvedDraft->update([
                        'official_document_id' => $approvedDraft->official_document_id ?: $document->id,
                        'status' => 'registered',
                    ]);
                    $approvedDraft->events()->create([
                        'user_id' => auth()->id(),
                        'event' => 'Attached to routing record',
                        'metadata' => ['document_id' => $document->id, 'tracking_number' => $document->tracking_number],
                    ]);
                }

                if ($file = $request->file('file')) {
                    $storedPaths[] = $this->storeRoutedDocumentFile($document, $file, 'original', $initialTrail);
                } elseif ($approvedDraft) {
                    $generatedPath = 'documents/'.$document->tracking_number.'.pdf';
                    $basePdf = $this->approvedDraftPdf($approvedDraft)->output();
                    $pdf = app(TrackingNumberPdfStamper::class)->stampBytes(
                        $basePdf,
                        (string) $document->tracking_number,
                        URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]),
                    );
                    if (! Storage::disk('document_private')->put($generatedPath, $pdf)) {
                        throw new \RuntimeException('Could not save the generated PDF.');
                    }
                    $storedPaths[] = $generatedPath;
                    $document->files()->create([
                        'file_name' => basename($generatedPath),
                        'original_name' => $document->title.'.pdf',
                        'file_path' => $generatedPath,
                        'mime_type' => 'application/pdf',
                        'size_bytes' => strlen($pdf),
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

                foreach ($request->file('supporting_files', []) as $supportingFile) {
                    $storedPaths[] = $this->storeRoutedDocumentFile(
                        $document,
                        $supportingFile,
                        'supporting',
                        $initialTrail,
                        'supporting_files',
                    );
                }

            });
        } catch (\Throwable $exception) {
            foreach ($storedPaths as $storedPath) {
                Storage::disk('document_private')->delete($storedPath);
            }
            throw $exception;
        }

        app(AuditTrailWriter::class)->record(
            $approvedDraft ? 'document.registered' : 'document.created',
            $document,
            ['tracking_number' => $document->tracking_number, 'title' => $document->title],
        );

        return redirect()->route('documents.index')->with('success', 'Routing record created successfully.');
    }

    public function decideApproval(Request $request, int $id)
    {
        $user = $request->user();
        $validated = $request->validate([
            'decision' => ['required', 'in:approved,changes_requested,rejected'],
            'remarks' => ['nullable', 'string', 'max:4000'],
        ]);
        $access = app(DocumentAccess::class);
        $document = $access->scope(Document::query(), $user)->findOrFail($id);

        DB::transaction(function () use ($document, $user, $validated, $access) {
            $document = Document::query()->with(['latestTrail', 'latestRoute'])->lockForUpdate()->findOrFail($document->id);
            $routes = $document->routes()
                ->with(['steps.office', 'steps.receiver', 'steps.decider', 'parentStep.office'])
                ->orderByDesc('id')
                ->lockForUpdate()
                ->get();
            $document->setRelation('routes', $routes);
            $officeId = $access->currentOfficeId($user);
            $activeRouteStep = $officeId ? $this->findRouteStepForOffice($document, (int) $officeId, 'in_progress') : null;

            if ($routes->isNotEmpty()) {
                abort_unless($this->canApproveDocument($document, $user), 403, 'Only an authorized approver at an active route office can decide this submission.');
                abort_unless($activeRouteStep, 403, 'This office does not have an active approval step.');
                [$route, $step] = $activeRouteStep;

                $decision = $validated['decision'];
                $action = match ($decision) {
                    'approved' => 'Approved',
                    'changes_requested' => 'Changes requested',
                    default => 'Rejected',
                };
                $trail = $document->trails()->create([
                    'from_office_id' => $officeId,
                    'to_office_id' => $officeId,
                    'created_by' => $user->id,
                    'status' => $decision,
                    'action' => $action,
                    'remarks' => $validated['remarks'] ?? null,
                ]);
                $step->update([
                    'status' => $decision,
                    'decision' => $decision,
                    'decision_remarks' => $validated['remarks'] ?? null,
                    'decision_trail_id' => $trail->id,
                    'decided_by' => $user->id,
                    'decided_at' => now(),
                ]);

                if ($decision !== 'approved') {
                    foreach ($routes as $candidateRoute) {
                        if ($candidateRoute->status !== 'pending') {
                            continue;
                        }

                        $candidateRoute->steps
                            ->where('id', '!=', $step->id)
                            ->whereIn('status', ['waiting', 'available', 'in_progress', 'waiting_on_branch'])
                            ->each(fn (DocumentRouteStep $candidateStep) => $candidateStep->update(['status' => 'paused']));
                        $candidateRoute->update([
                            'status' => $candidateRoute->id === $route->id ? $decision : 'paused',
                            'completed_at' => now(),
                        ]);
                    }
                    $document->update(['approval_status' => $decision, 'status' => $decision]);
                    if ($decision === 'changes_requested') {
                        $originRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();
                        $originOfficeId = $originRoute?->from_office_id ?? $document->office_id;
                        if ($originOfficeId && (int) $originOfficeId !== (int) $officeId) {
                            $document->trails()->create([
                                'from_office_id' => $officeId,
                                'to_office_id' => $originOfficeId,
                                'created_by' => $user->id,
                                'status' => 'changes_requested',
                                'action' => 'Returned to the originating office for adjustments',
                                'remarks' => $validated['remarks'] ?? null,
                            ]);
                        }
                    }
                } else {
                    $route->load('steps');
                    $nextStep = $route->mode === 'sequential'
                        ? $route->steps
                            ->filter(fn (DocumentRouteStep $candidate) => $candidate->status === 'waiting'
                                && (int) $candidate->position > (int) $step->position)
                            ->sortBy('position')
                            ->first()
                        : null;

                    if ($nextStep && $nextStep->status === 'waiting') {
                        $dispatchTrail = $document->trails()->create([
                            'from_office_id' => $officeId,
                            'to_office_id' => $nextStep->office_id,
                            'created_by' => $user->id,
                            'status' => 'available',
                            'action' => 'Advanced to sequential approval step '.($nextStep->position),
                        ]);
                        $nextStep->update([
                            'status' => 'available',
                            'dispatch_trail_id' => $dispatchTrail->id,
                        ]);
                        $document->update(['approval_status' => 'awaiting_approval', 'status' => 'pending']);
                        $nextStep->loadMissing('office');
                        if ($nextStep->office) {
                            $this->notifyRouteOffice($document, $route, $nextStep->office);
                        }
                    } elseif ($route->steps->every(fn (DocumentRouteStep $candidate) => $candidate->status === 'approved')) {
                        $route->update(['status' => 'approved', 'completed_at' => now()]);
                        if ($route->parent_step_id) {
                            $parentStep = DocumentRouteStep::query()->with('office')->lockForUpdate()->findOrFail($route->parent_step_id);
                            $parentStep->update(['status' => 'in_progress']);
                            $parentStep->route()->update(['updated_at' => now()]);
                            $branchCompleteTrail = $document->trails()->create([
                                'from_office_id' => $officeId,
                                'to_office_id' => $parentStep->office_id,
                                'created_by' => $user->id,
                                'status' => 'pending',
                                'action' => 'Branch complete; parent office decision required',
                            ]);
                            app(AuditTrailWriter::class)->record('document.route_branch_completed', $document, [
                                'tracking_number' => $document->tracking_number,
                                'child_route_id' => $route->id,
                                'parent_step_id' => $parentStep->id,
                                'document_trail_id' => $branchCompleteTrail->id,
                            ], actor: $user);
                            if ($parentStep->office) {
                                $this->notifyRouteOffice($document, $route, $parentStep->office);
                            }
                            if ($parentStep->office) {
                                $this->notifyRouteCreator($document, $route, $parentStep->office, 'A forwarded branch is complete', null);
                            }
                            $document->update(['approval_status' => 'awaiting_approval', 'status' => 'pending']);
                        } else {
                            $document->update(['approval_status' => 'approved', 'status' => 'approved']);
                        }
                    } else {
                        $document->update(['approval_status' => 'awaiting_approval', 'status' => 'pending']);
                    }
                }

                $step->loadMissing('office');
                if ($step->office) {
                    $this->notifyRouteCreator($document, $route, $step->office, $decision, $validated['remarks'] ?? null);
                }

                $draft = DocumentCreationDraft::query()->where('official_document_id', $document->id)->first();
                if ($draft) {
                    if (in_array($decision, ['changes_requested', 'rejected'], true)) {
                        $draft->update([
                            'status' => $decision === 'changes_requested' ? 'revision_requested' : 'registered',
                            'decision_at' => now(),
                            'decision_remarks' => $validated['remarks'] ?? null,
                        ]);
                    }
                    $draft->events()->create([
                        'user_id' => $user->id,
                        'event' => $action,
                        'remarks' => $validated['remarks'] ?? null,
                        'metadata' => [
                            'document_id' => $document->id,
                            'document_route_id' => $route->id,
                            'document_route_step_id' => $step->id,
                            'document_trail_id' => $trail->id,
                        ],
                    ]);
                }

                app(AuditTrailWriter::class)->record('document.approval.'.$decision, $document, [
                    'tracking_number' => $document->tracking_number,
                    'document_route_id' => $route->id,
                    'document_route_step_id' => $step->id,
                    'document_trail_id' => $trail->id,
                    'remarks' => $validated['remarks'] ?? null,
                ], actor: $user);

                return;
            }

            abort_unless($this->canApproveDocument($document, $user), 403, 'Only an authorized approver at the current office can decide this submission.');
            $officeId = $access->currentOfficeId($user);
            $decision = $validated['decision'];
            $action = match ($decision) {
                'approved' => 'Approved',
                'changes_requested' => 'Changes requested',
                default => 'Rejected',
            };
            $trail = $document->trails()->create([
                'from_office_id' => $officeId,
                'to_office_id' => $officeId,
                'created_by' => $user->id,
                'status' => $decision === 'rejected' ? 'rejected' : 'pending',
                'action' => $action,
                'remarks' => $validated['remarks'] ?? null,
            ]);
            $document->update([
                'approval_status' => $decision,
                'status' => $decision === 'rejected' ? 'rejected' : 'pending',
            ]);

            $draft = DocumentCreationDraft::query()->where('official_document_id', $document->id)->first();
            if ($draft) {
                $draft->update([
                    'status' => match ($decision) {
                        'changes_requested' => 'revision_requested',
                        'rejected' => 'registered',
                        default => 'registered',
                    },
                    'decision_at' => now(),
                    'decision_remarks' => $validated['remarks'] ?? null,
                ]);
                $draft->events()->create([
                    'user_id' => $user->id,
                    'event' => $action,
                    'remarks' => $validated['remarks'] ?? null,
                    'metadata' => ['document_id' => $document->id, 'document_trail_id' => $trail->id],
                ]);
            }

            app(AuditTrailWriter::class)->record('document.approval.'.$decision, $document, [
                'tracking_number' => $document->tracking_number,
                'document_trail_id' => $trail->id,
                'remarks' => $validated['remarks'] ?? null,
            ], actor: $user);
        });

        return back()->with('success', 'Approval decision recorded in the routing history.');
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
            $this->storeRoutedDocumentFile($document, $file, 'version', $finalizationTrail);
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
            'routing_mode' => ['nullable', 'in:sequential,parallel'],
            'to_office_ids' => ['required_without:to_office_id', 'array', 'min:1', 'max:30'],
            'to_office_ids.*' => ['required', 'integer', 'distinct', 'exists:offices,id'],
            'to_office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'remarks' => ['nullable', 'string', 'max:250'],
            'document_source' => ['nullable', 'in:current,upload'],
            'approved_draft_id' => ['prohibited'],
            'file' => ['required_if:document_source,upload', 'prohibited_if:document_source,current', 'nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        $validated = $this->normalizeActionTypeDetails($validated);
        $validated['routing_mode'] = $validated['routing_mode'] ?? 'sequential';
        $officeIds = array_values(array_unique(array_map('intval', $validated['to_office_ids'] ?? [$validated['to_office_id'] ?? 0])));
        $officeIds = array_values(array_filter($officeIds, fn (int $officeId) => $officeId > 0));
        if ($officeIds === []) {
            throw ValidationException::withMessages(['to_office_ids' => 'Choose at least one receiving office.']);
        }
        $document = app(DocumentAccess::class)->scope(Document::query(), $request->user())
            ->with(['latestTrail', 'latestRoute'])
            ->findOrFail($id);
        abort_unless($this->canForwardDocument($document, $request->user()), 403, 'This document is not available for forwarding.');
        $parentStep = $this->authorizeCurrentHolder($document, allowBranch: true);
        $officeId = app(DocumentAccess::class)->currentOfficeId($request->user());
        if (in_array((int) $officeId, $officeIds, true)) {
            throw ValidationException::withMessages(['to_office_ids' => 'Choose another office; the sending office cannot be a receiving step.']);
        }
        if ($parentStep && array_intersect($officeIds, $this->branchAncestorOfficeIds($parentStep)) !== []) {
            throw ValidationException::withMessages([
                'to_office_ids' => 'A branch cannot route back to an office already included above it. Use Request changes to return the document to an earlier office.',
            ]);
        }
        $targetOffices = Office::query()->whereIn('id', $officeIds)->get()->keyBy('id');
        foreach ($officeIds as $targetOfficeId) {
            $targetOffice = $targetOffices->get($targetOfficeId);
            if (! $targetOffice || ! $this->officeIsInCurrentUserRange($targetOffice)) {
                throw ValidationException::withMessages([
                    'to_office_ids' => 'Choose receiving offices within your assigned office range.',
                ]);
            }
            if (! $this->officeHasActiveApprovers($targetOffice, (int) $document->created_by)) {
                throw ValidationException::withMessages([
                    'to_office_ids' => 'Every receiving office must have at least one active approver.',
                ]);
            }
        }
        $sourceOfficeName = Office::query()->whereKey($officeId)->value('name');

        $hasReplacementFile = $request->hasFile('file');
        $storedPath = null;
        try {
            $trail = DB::transaction(function () use ($request, $document, $validated, $officeIds, $targetOffices, $officeId, $sourceOfficeName, $hasReplacementFile, &$storedPath) {
                $lockedDocument = Document::query()->with(['latestTrail', 'latestRoute'])->lockForUpdate()->findOrFail($document->id);
                abort_unless($this->canForwardDocument($lockedDocument, $request->user()), 403, 'This document is not available for forwarding.');
                $parentStep = $this->authorizeCurrentHolder($lockedDocument, allowBranch: true);
                if ($parentStep && array_intersect($officeIds, $this->branchAncestorOfficeIds($parentStep)) !== []) {
                    throw ValidationException::withMessages([
                        'to_office_ids' => 'A branch cannot route back to an office already included above it. Use Request changes to return the document to an earlier office.',
                    ]);
                }
                $now = now();
                $route = $lockedDocument->routes()->create([
                    'created_by' => auth()->id(),
                    'from_office_id' => $officeId,
                    'parent_step_id' => $parentStep?->id,
                    'action_type_id' => $validated['action_type_id'],
                    'mode' => $validated['routing_mode'],
                    'status' => 'pending',
                    'other_action' => $validated['other_action'] ?? null,
                    'remarks' => $validated['remarks'] ?? null,
                    'started_at' => $now,
                ]);
                $firstDispatchTrail = null;
                foreach ($officeIds as $position => $targetOfficeId) {
                    $targetOffice = $targetOffices->get($targetOfficeId);
                    $isImmediatelyActive = $validated['routing_mode'] === 'parallel' || $position === 0;
                    $step = $route->steps()->create([
                        'office_id' => $targetOfficeId,
                        'position' => $position + 1,
                        'status' => $isImmediatelyActive ? 'available' : 'waiting',
                    ]);
                    if (! $isImmediatelyActive) {
                        continue;
                    }

                    $dispatchTrail = $lockedDocument->trails()->create([
                        'from_office_id' => $officeId,
                        'to_office_id' => $targetOfficeId,
                        'created_by' => auth()->id(),
                        'status' => 'available',
                        'action' => ($validated['routing_mode'] === 'parallel' ? 'Routed for parallel approval - ' : 'Routed for sequential approval - ').$validated['action_type_name'].(mb_strtolower($validated['action_type_name']) === 'others' ? ': '.$validated['other_action'] : ''),
                        'remarks' => $validated['remarks'] ?? null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                    $step->update(['dispatch_trail_id' => $dispatchTrail->id]);
                    $firstDispatchTrail ??= $dispatchTrail;
                    $this->notifyRouteOffice($lockedDocument, $route, $targetOffice);
                }
                if ($parentStep) {
                    $parentStep->update(['status' => 'waiting_on_branch']);
                }
                $lockedDocument->update([
                    'status' => 'pending',
                    'approval_status' => 'awaiting_approval',
                    ...($hasReplacementFile ? [
                        'signature_status' => ($lockedDocument->signature_status ?? 'not_required') === 'not_required' ? 'not_required' : 'needs_signature',
                    ] : []),
                ]);
                if ($file = $request->file('file')) {
                    $storedPath = $this->storeRoutedDocumentFile($lockedDocument, $file, 'version', $firstDispatchTrail);
                }
                app(AuditTrailWriter::class)->record('document.routed', $lockedDocument, [
                    'tracking_number' => $lockedDocument->tracking_number,
                    'route_id' => $route->id,
                    'parent_step_id' => $parentStep?->id,
                    'mode' => $route->mode,
                    'from_office_id' => $officeId,
                    'from_office_name' => $sourceOfficeName,
                    'to_offices' => collect($officeIds)->map(fn ($targetId) => [
                        'id' => $targetId,
                        'name' => $targetOffices->get($targetId)?->name,
                    ])->all(),
                    'action_type' => $validated['action_type_name'],
                ]);

                return $firstDispatchTrail;
            });
        } catch (\Throwable $exception) {
            if ($storedPath !== null) {
                Storage::disk('document_private')->delete($storedPath);
            }
            throw $exception;
        }

        return back()->with('success', 'Document routed to the selected offices successfully.');
    }

    public function updateRemainingRouteSteps(Request $request, int $document, int $route)
    {
        $validated = $request->validate([
            'office_ids' => ['present', 'array', 'max:30'],
            'office_ids.*' => ['required', 'integer', 'distinct', 'exists:offices,id'],
            'reason' => ['required', 'string', 'max:1000'],
            'revision' => ['required', 'string', 'size:64'],
        ]);
        $user = $request->user();
        $accessibleDocument = app(DocumentAccess::class)->scope(Document::query(), $user)->findOrFail($document);
        $officeIds = array_values(array_map('intval', $validated['office_ids']));

        DB::transaction(function () use ($accessibleDocument, $route, $user, $officeIds, $validated) {
            $document = Document::query()->lockForUpdate()->findOrFail($accessibleDocument->id);
            $documentRoute = DocumentRoute::query()
                ->where('document_id', $document->id)
                ->with(['fromOffice', 'parentStep.route.steps', 'steps.office', 'steps.receiver', 'steps.decider'])
                ->lockForUpdate()
                ->findOrFail($route);
            $documentRoute->steps()->lockForUpdate()->get();
            $documentRoute->load(['steps.office', 'steps.receiver', 'steps.decider']);

            abort_unless($this->canEditApprovalRoute($document, $documentRoute, $user), 403, 'You cannot edit this approval route.');
            if (! hash_equals($this->routeRevisionToken($documentRoute), $validated['revision'])) {
                throw ValidationException::withMessages([
                    'route' => 'The approval route changed while you were editing it. Reload the document and try again.',
                ]);
            }

            $editableStatuses = ['available', 'waiting'];
            $orderedSteps = $documentRoute->steps->sortBy('position')->values();
            $lockedSteps = $orderedSteps->reject(fn (DocumentRouteStep $step) => in_array($step->status, $editableStatuses, true))->values();
            $editableSteps = $orderedSteps->filter(fn (DocumentRouteStep $step) => in_array($step->status, $editableStatuses, true))->values();
            $lockedOfficeIds = $lockedSteps->pluck('office_id')->map(fn ($id) => (int) $id)->all();
            $currentEditableOfficeIds = $editableSteps->pluck('office_id')->map(fn ($id) => (int) $id)->all();
            $isParallel = $documentRoute->mode === 'parallel';
            $submittedComparison = $officeIds;
            $currentComparison = $currentEditableOfficeIds;
            if ($isParallel) {
                sort($submittedComparison);
                sort($currentComparison);
            }

            if ($submittedComparison === $currentComparison) {
                throw ValidationException::withMessages([
                    'office_ids' => $isParallel
                        ? 'Add or remove at least one unreceived office before saving.'
                        : 'Change at least one remaining office or its position before saving.',
                ]);
            }

            if (array_intersect($officeIds, $lockedOfficeIds) !== []) {
                throw ValidationException::withMessages([
                    'office_ids' => 'Approved, received, or branch-active offices cannot be added to the editable remainder.',
                ]);
            }
            if ($lockedSteps->count() + count($officeIds) > 30) {
                throw ValidationException::withMessages(['office_ids' => 'A route may contain no more than 30 active offices.']);
            }
            if ($lockedSteps->isEmpty() && $officeIds === []) {
                throw ValidationException::withMessages(['office_ids' => 'Keep at least one office in the approval route.']);
            }

            $blockedOfficeIds = collect([(int) $documentRoute->from_office_id]);
            if ($documentRoute->parentStep) {
                $blockedOfficeIds = $blockedOfficeIds->merge($this->branchAncestorOfficeIds($documentRoute->parentStep));
            }
            if (array_intersect($officeIds, $blockedOfficeIds->filter()->unique()->all()) !== []) {
                throw ValidationException::withMessages([
                    'office_ids' => 'The sending office and offices already above this route cannot be selected.',
                ]);
            }

            $targetOffices = Office::query()->with('range')->whereIn('id', $officeIds)->get()->keyBy('id');
            foreach ($officeIds as $targetOfficeId) {
                $targetOffice = $targetOffices->get($targetOfficeId);
                if (! $targetOffice || ! $this->officeIsInCurrentUserRange($targetOffice)) {
                    throw ValidationException::withMessages([
                        'office_ids' => 'Choose receiving offices within your assigned office range.',
                    ]);
                }
                if (! $this->officeHasActiveApprovers($targetOffice, (int) $document->created_by)) {
                    throw ValidationException::withMessages([
                        'office_ids' => 'Every receiving office must have at least one active approver.',
                    ]);
                }
            }

            $before = $orderedSteps->map(fn (DocumentRouteStep $step) => [
                'step_id' => $step->id,
                'office_id' => $step->office_id,
                'office' => $step->office?->name,
                'position' => $step->position,
                'status' => $step->status,
            ])->all();
            $newlyAvailableSteps = collect();

            if ($isParallel) {
                $existingEditableByOffice = $editableSteps->keyBy(fn (DocumentRouteStep $step) => (int) $step->office_id);
                $removedSteps = $editableSteps->reject(fn (DocumentRouteStep $step) => in_array((int) $step->office_id, $officeIds, true));
                foreach ($removedSteps as $removedStep) {
                    if ($removedStep->status === 'available') {
                        $document->trails()->create([
                            'from_office_id' => $documentRoute->from_office_id,
                            'to_office_id' => $removedStep->office_id,
                            'created_by' => $user->id,
                            'status' => 'cancelled',
                            'action' => 'Parallel approval assignment cancelled before receipt',
                        ]);
                    }
                    $removedStep->delete();
                }

                $nextPosition = ((int) $documentRoute->steps()->max('position')) + 1;
                foreach ($officeIds as $targetOfficeId) {
                    $existingStep = $existingEditableByOffice->get($targetOfficeId);
                    if ($existingStep && ! $removedSteps->contains('id', $existingStep->id)) {
                        if ($existingStep->status === 'available') {
                            continue;
                        }
                        $step = $existingStep;
                        $step->update(['status' => 'available']);
                    } else {
                        $step = $documentRoute->steps()->create([
                            'office_id' => $targetOfficeId,
                            'position' => $nextPosition++,
                            'status' => 'available',
                        ]);
                    }

                    $dispatchTrail = $document->trails()->create([
                        'from_office_id' => $documentRoute->from_office_id,
                        'to_office_id' => $targetOfficeId,
                        'created_by' => $user->id,
                        'status' => 'available',
                        'action' => 'Added to the active parallel approval route',
                    ]);
                    $step->update(['dispatch_trail_id' => $dispatchTrail->id]);
                    $newlyAvailableSteps->push($step);
                }
            } else {
                $currentAvailable = $editableSteps->first(fn (DocumentRouteStep $step) => $step->status === 'available');
                $preserveAvailable = $currentAvailable && ($officeIds[0] ?? null) === (int) $currentAvailable->office_id;

                if ($currentAvailable && ! $preserveAvailable) {
                    $document->trails()->create([
                        'from_office_id' => $documentRoute->from_office_id,
                        'to_office_id' => $currentAvailable->office_id,
                        'created_by' => $user->id,
                        'status' => 'cancelled',
                        'action' => 'Approval assignment cancelled before receipt',
                    ]);
                }

                // Move existing rows away from their active positions first so the unique
                // route/position constraint cannot collide while the sequence is rebuilt.
                $temporaryPosition = max(1000, ((int) $orderedSteps->max('position')) + $orderedSteps->count() + 100);
                foreach ($orderedSteps as $index => $existingStep) {
                    $existingStep->update(['position' => $temporaryPosition + $index]);
                }
                foreach ($editableSteps as $editableStep) {
                    if (! $preserveAvailable || $editableStep->id !== $currentAvailable->id) {
                        $editableStep->delete();
                    }
                }

                $position = 1;
                foreach ($lockedSteps as $lockedStep) {
                    $lockedStep->update(['position' => $position++]);
                }
                $hasActiveLockedStep = $lockedSteps->contains(fn (DocumentRouteStep $step) => in_array($step->status, ['in_progress', 'waiting_on_branch'], true));

                foreach ($officeIds as $index => $targetOfficeId) {
                    $status = ! $hasActiveLockedStep && $index === 0 ? 'available' : 'waiting';
                    if ($preserveAvailable && $index === 0) {
                        $step = $currentAvailable;
                        $step->update(['position' => $position, 'status' => $status]);
                    } else {
                        $step = $documentRoute->steps()->create([
                            'office_id' => $targetOfficeId,
                            'position' => $position,
                            'status' => $status,
                        ]);
                    }

                    if ($status === 'available' && ! $preserveAvailable) {
                        $dispatchTrail = $document->trails()->create([
                            'from_office_id' => $documentRoute->from_office_id,
                            'to_office_id' => $targetOfficeId,
                            'created_by' => $user->id,
                            'status' => 'available',
                            'action' => 'Approval route updated; advanced to sequential approval step '.$position,
                        ]);
                        $step->update(['dispatch_trail_id' => $dispatchTrail->id]);
                        $newlyAvailableSteps->push($step);
                    }
                    $position++;
                }
            }

            $documentRoute->load('steps.office');
            if ($documentRoute->steps->isNotEmpty()
                && $documentRoute->steps->every(fn (DocumentRouteStep $step) => $step->status === 'approved')) {
                $documentRoute->update(['status' => 'approved', 'completed_at' => now()]);
                if ($documentRoute->parent_step_id) {
                    $parentStep = DocumentRouteStep::query()->with('office')->lockForUpdate()->findOrFail($documentRoute->parent_step_id);
                    $parentStep->update(['status' => 'in_progress']);
                    $branchCompleteTrail = $document->trails()->create([
                        'from_office_id' => $documentRoute->from_office_id,
                        'to_office_id' => $parentStep->office_id,
                        'created_by' => $user->id,
                        'status' => 'pending',
                        'action' => 'Branch complete after approval route update; parent office decision required',
                    ]);
                    app(AuditTrailWriter::class)->record('document.route_branch_completed', $document, [
                        'tracking_number' => $document->tracking_number,
                        'child_route_id' => $documentRoute->id,
                        'parent_step_id' => $parentStep->id,
                        'document_trail_id' => $branchCompleteTrail->id,
                    ], actor: $user);
                    if ($parentStep->office) {
                        $this->notifyRouteOffice($document, $documentRoute, $parentStep->office);
                    }
                    $document->update(['approval_status' => 'awaiting_approval', 'status' => 'pending']);
                } else {
                    $document->update(['approval_status' => 'approved', 'status' => 'approved']);
                }
            } else {
                $documentRoute->update(['updated_at' => now()]);
                $document->update(['approval_status' => 'awaiting_approval', 'status' => 'pending']);
            }

            $documentRoute->load('steps.office');
            $after = $documentRoute->steps->sortBy('position')->map(fn (DocumentRouteStep $step) => [
                'step_id' => $step->id,
                'office_id' => $step->office_id,
                'office' => $step->office?->name,
                'position' => $step->position,
                'status' => $step->status,
            ])->values()->all();
            app(AuditTrailWriter::class)->record('document.route_updated', $document, [
                'tracking_number' => $document->tracking_number,
                'route_id' => $documentRoute->id,
                'mode' => $documentRoute->mode,
                'reason' => trim($validated['reason']),
                'before' => $before,
                'after' => $after,
            ], actor: $user);

            foreach ($newlyAvailableSteps as $newlyAvailableStep) {
                $newlyAvailableStep->loadMissing('office');
                if ($newlyAvailableStep->office) {
                    $this->notifyRouteOffice($document, $documentRoute, $newlyAvailableStep->office);
                }
            }
        });

        return back()->with('success', 'The active approval route was updated.');
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
            $routes = $document->routes()->with('steps')->orderByDesc('id')->lockForUpdate()->get();
            $document->setRelation('routes', $routes);
            $routeStep = $this->findRouteStepForOffice($document, (int) $officeId, 'available');
            if ($routeStep) {
                [$route, $step] = $routeStep;

                $dispatchTrail = $step->dispatchTrail()->with('fromOffice')->first();
                $receivedAt = now();
                $receiptTrail = $document->trails()->create([
                    'from_office_id' => $dispatchTrail?->from_office_id ?? $route->from_office_id,
                    'to_office_id' => $officeId,
                    'created_by' => $user->id,
                    'status' => 'pending',
                    'action' => 'Received for approval',
                    'created_at' => $receivedAt,
                    'updated_at' => $receivedAt,
                ]);
                $step->update([
                    'status' => 'in_progress',
                    'received_by' => $user->id,
                    'received_at' => $receivedAt,
                ]);
                $document->update([
                    'status' => 'pending',
                    'approval_status' => 'awaiting_approval',
                    'received_at' => $receivedAt,
                    'received_from' => $dispatchTrail?->fromOffice?->name,
                ]);
                $document->loadMissing('creator');
                app(AuditTrailWriter::class)->record('document.route_step_received', $document, [
                    'tracking_number' => $document->tracking_number,
                    'route_id' => $route->id,
                    'route_step_id' => $step->id,
                    'office_id' => $officeId,
                    'office_name' => $user->office?->name,
                    'document_trail_id' => $receiptTrail->id,
                ], actor: $user);

                return $document;
            }
            if ($routes->isNotEmpty()) {
                throw ValidationException::withMessages([
                    'tracking_number' => 'This document is not currently waiting for your office to receive it.',
                ]);
            }

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
            $deliveryIssue = app(EmailNotificationMailer::class)->automatedDeliveryIssue();
            $reason = match (true) {
                ! $creator => 'creator_missing',
                ! filter_var($creator->email, FILTER_VALIDATE_EMAIL) => 'creator_email_invalid',
                $deliveryIssue !== null => $deliveryIssue,
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

    private function authorizeCurrentHolder(Document $document, bool $allowBranch = false): ?DocumentRouteStep
    {
        abort_if($document->legacy_needs_review || $document->is_archived, 403, 'This document needs review or is archived.');
        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with('steps')->get();

        if ($routes->isNotEmpty()) {
            $document->setRelation('routes', $routes);
            if ($allowBranch && $officeId !== null) {
                $activeStep = $this->findRouteStepForOffice($document, (int) $officeId, 'in_progress');
                if ($activeStep) {
                    [, $step] = $activeStep;
                    abort_if($routes->contains(fn (DocumentRoute $route) => (int) $route->parent_step_id === (int) $step->id), 403,
                        'This office already used its branch and must make its own decision.');

                    return $step;
                }
            }

            $hasPendingRoutes = $routes->contains(fn (DocumentRoute $candidate) => $candidate->status === 'pending');
            $rootRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();
            $isRootOffice = $officeId !== null
                && (int) ($rootRoute?->from_office_id ?? $document->office_id) === (int) $officeId;
            $completedRoot = $rootRoute?->status === 'approved' && $isRootOffice;
            $resubmittingAfterChanges = $allowBranch
                && ($document->approval_status ?? null) === 'changes_requested'
                && ! $hasPendingRoutes
                && $isRootOffice;

            abort_unless(! $hasPendingRoutes && ($completedRoot || $resubmittingAfterChanges), 403,
                'Complete the active office decisions before forwarding this document.');

            return null;
        }

        $latest = $document->latestTrail;
        $isUnroutedInitialRecord = ($document->approval_status ?? null) === 'awaiting_approval'
            && $latest?->to_office_id === null
            && strtolower((string) $latest?->status) === 'pending';
        abort_unless(in_array($document->approval_status ?? 'not_required', ['approved', 'not_required'], true)
            || $isUnroutedInitialRecord,
            403,
            'The current office must approve this document before it can be routed onward.'
        );

        $holderOfficeId = $latest?->to_office_id ?? $document->office_id;

        abort_unless($officeId && strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
            && (int) $holderOfficeId === (int) $officeId, 403);

        return null;
    }

    private function documentFormOptions(): array
    {
        $currentOfficeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());
        $receivingOffices = Office::query()
            ->with('range:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'range_id', 'legacy_range_id'])
            ->filter(fn (Office $office) => $this->officeIsInCurrentUserRange($office)
                && (int) $office->id !== (int) $currentOfficeId)
            ->values();
        $officesWithActiveApprovers = User::query()
            ->whereIn('office_id', $receivingOffices->modelKeys())
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isAdministrator() && $user->canReceiveDocuments())
            ->pluck('office_id')
            ->unique()
            ->flip();
        $receivingOffices = $receivingOffices
            ->map(fn (Office $office) => [
                'id' => (string) $office->id,
                'name' => $office->name,
                'source' => 'New DB',
                'disabled' => ! $officesWithActiveApprovers->has($office->id),
            ])
            ->values()
            ->all();

        return [
            'maxUploadSizeKb' => self::MAX_DOCUMENT_UPLOAD_KB,
            'maxSupportingFiles' => self::MAX_SUPPORTING_FILES,
            'approvedDocuments' => DocumentCreationDraft::query()
                ->with('documentType:id,name')
                ->whereNull('archived_at')
                ->whereIn('status', ['ready_for_routing', 'approved', 'awaiting_verification', 'verified', 'registered'])
                ->where('created_by', auth()->id())
                ->latest()
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
        return app(DocumentPdf::class)->renderDraft($draft);
    }

    private function canApproveDocument(Document $document, User $user): bool
    {
        if (! $user->is_active || ! $user->isAdministrator()
            || $document->is_archived || $document->legacy_needs_review
            || (int) $document->created_by === (int) $user->id
            || ($document->approval_status ?? 'not_required') !== 'awaiting_approval') {
            return false;
        }

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with('steps')->get();
        if ($routes->isNotEmpty()) {
            if ($officeId === null) {
                return false;
            }
            $document->setRelation('routes', $routes);

            return $this->findRouteStepForOffice($document, (int) $officeId, 'in_progress') !== null;
        }

        $latest = $document->latestTrail;

        return $officeId !== null
            && $latest !== null
            && strtolower((string) $latest->status) === 'pending'
            && $latest->to_office_id !== null
            && (int) $latest->to_office_id === $officeId;
    }

    private function canReceiveRouteStep(Document $document, User $user): bool
    {
        if (! $user->is_active || ! $user->canReceiveDocuments()
            || $document->is_archived || $document->legacy_needs_review) {
            return false;
        }

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        if ($officeId === null) {
            return false;
        }

        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with('steps')->get();
        if ($routes->isEmpty()) {
            return false;
        }
        $document->setRelation('routes', $routes);

        return $this->findRouteStepForOffice($document, (int) $officeId, 'available') !== null;
    }

    private function findRouteStepForOffice(Document $document, int $officeId, string $status): ?array
    {
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with('steps')->get();

        foreach ($routes->sortByDesc('id') as $route) {
            if ($route->status !== 'pending') {
                continue;
            }
            $step = $route->steps->first(fn (DocumentRouteStep $candidate) => (int) $candidate->office_id === $officeId && $candidate->status === $status
            );
            if (! $step) {
                continue;
            }
            if ($route->mode === 'sequential'
                && $route->steps->where('position', '<', $step->position)->contains(fn (DocumentRouteStep $previous) => $previous->status !== 'approved')) {
                continue;
            }

            return [$route, $step];
        }

        return null;
    }

    private function canForwardDocument(Document $document, User $user): bool
    {
        if (! $user->is_active || $document->is_archived || $document->legacy_needs_review
            || ($document->approval_status ?? null) === 'approved') {
            return false;
        }
        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        if ($officeId === null) {
            return false;
        }
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with('steps')->get();
        if ($routes->isNotEmpty()) {
            $document->setRelation('routes', $routes);
            $activeStep = $this->findRouteStepForOffice($document, (int) $officeId, 'in_progress');
            if ($activeStep) {
                [, $step] = $activeStep;

                return ! $routes->contains(fn (DocumentRoute $route) => (int) $route->parent_step_id === (int) $step->id);
            }

            $hasPendingRoutes = $routes->contains(fn (DocumentRoute $route) => $route->status === 'pending');
            $rootRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();
            $isRootOffice = (int) ($rootRoute?->from_office_id ?? $document->office_id) === (int) $officeId;

            return ! $hasPendingRoutes && $isRootOffice
                && ($rootRoute?->status === 'approved'
                    || (($document->approval_status ?? null) === 'changes_requested' && $rootRoute !== null));
        }

        $latest = $document->relationLoaded('latestTrail') ? $document->latestTrail : $document->latestTrail()->first();
        $isInitialUnrouted = ($document->approval_status ?? null) === 'awaiting_approval'
            && $latest?->to_office_id === null
            && strtolower((string) $latest?->status) === 'pending';
        $holderOfficeId = $latest?->to_office_id ?? $document->office_id;

        return (in_array($document->approval_status ?? 'not_required', ['approved', 'not_required'], true)
                || $isInitialUnrouted)
            && strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
            && (int) $holderOfficeId === (int) $officeId;
    }

    private function canTagDocumentTerminal(Document $document, User $user): bool
    {
        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        if (! $officeId) {
            return false;
        }
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->get();
        if ($routes->isNotEmpty()) {
            $rootRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();

            return ! $routes->contains(fn (DocumentRoute $route) => $route->status === 'pending')
                && $rootRoute?->status === 'approved'
                && (int) $rootRoute->from_office_id === (int) $officeId;
        }

        $latest = $document->relationLoaded('latestTrail') ? $document->latestTrail : $document->latestTrail()->first();
        $holderOfficeId = $latest?->to_office_id ?? $document->office_id;

        return strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
            && (int) $holderOfficeId === (int) $officeId
            && in_array($document->approval_status ?? 'not_required', ['approved', 'not_required'], true);
    }

    private function branchAncestorOfficeIds(DocumentRouteStep $parentStep): array
    {
        $officeIds = collect([(int) $parentStep->office_id]);
        $step = $parentStep;
        $seenRoutes = [];

        while (true) {
            $route = $step->relationLoaded('route') ? $step->route : $step->route()->with('steps')->first();
            if (! $route || in_array($route->id, $seenRoutes, true)) {
                break;
            }
            $seenRoutes[] = $route->id;
            if ($route->from_office_id) {
                $officeIds->push((int) $route->from_office_id);
            }
            $route->steps->each(fn (DocumentRouteStep $ancestorStep) => $officeIds->push((int) $ancestorStep->office_id));
            $step = $route->parentStep()->with('route.steps')->first();
            if (! $step) {
                break;
            }
        }

        return $officeIds->unique()->values()->all();
    }

    private function findEditableApprovalRoute(Document $document, User $user): ?DocumentRoute
    {
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with(['fromOffice', 'parentStep.route.steps', 'steps.office', 'steps.receiver', 'steps.decider'])->get();

        $route = $routes->sortByDesc('id')
            ->first(fn (DocumentRoute $candidate) => $this->canEditApprovalRoute($document, $candidate, $user));
        if (! $route) {
            return null;
        }

        $route->loadMissing(['fromOffice', 'steps.office', 'steps.receiver', 'steps.decider']);

        return $route;
    }

    private function canEditApprovalRoute(Document $document, DocumentRoute $route, User $user): bool
    {
        $documentStatus = strtolower((string) $document->status);
        $approvalStatus = strtolower((string) $document->approval_status);
        if (! $user->is_active || $document->is_archived || $document->legacy_needs_review
            || in_array($documentStatus, ['archived', 'terminal', 'rejected', 'changes_requested'], true)
            || in_array($approvalStatus, ['approved', 'rejected', 'changes_requested'], true)
            || ! in_array($route->mode, ['sequential', 'parallel'], true) || $route->status !== 'pending') {
            return false;
        }

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        if ($officeId === null || (int) $route->from_office_id !== (int) $officeId) {
            return false;
        }

        return (int) $route->created_by === (int) $user->id || $user->isAdministrator();
    }

    private function routeRevisionToken(DocumentRoute $route): string
    {
        $route->loadMissing('steps');
        $stepState = $route->steps->sortBy('position')->map(fn (DocumentRouteStep $step) => implode(':', [
            $step->id,
            $step->office_id,
            $step->position,
            $step->status,
            $step->received_at?->format('Y-m-d H:i:s.u') ?? '',
            $step->decided_at?->format('Y-m-d H:i:s.u') ?? '',
            $step->updated_at?->format('Y-m-d H:i:s.u') ?? '',
        ]))->implode('|');

        return hash('sha256', implode('|', [$route->id, $route->mode, $route->status, $stepState]));
    }

    private function serializeRouteTree(Document $document, bool $public = false): array
    {
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with(['fromOffice', 'steps.office', 'steps.receiver', 'steps.decider'])->get();

        $serializeRoute = function (DocumentRoute $route) use (&$serializeRoute, $routes, $public): array {
            return [
                'id' => $route->id,
                'mode' => $route->mode,
                'status' => $route->status,
                'from_office' => $route->fromOffice?->name,
                'parent_step_id' => $route->parent_step_id,
                'steps' => $route->steps->map(function (DocumentRouteStep $step) use (&$serializeRoute, $routes, $public) {
                    $serialized = [
                        'id' => $step->id,
                        'office_id' => $step->office_id,
                        'office' => $step->office?->name,
                        'position' => $step->position,
                        'status' => $step->status,
                        'child_routes' => $routes->where('parent_step_id', $step->id)->sortBy('id')
                            ->map(fn (DocumentRoute $childRoute) => $serializeRoute($childRoute))->values()->all(),
                    ];
                    if (! $public) {
                        $serialized += [
                            'decision' => $step->decision,
                            'remarks' => $step->decision_remarks,
                            'received_by' => $step->receiver?->name,
                            'received_at' => DateTimePresenter::format($step->received_at, 'F j Y h:i:s A'),
                            'decided_by' => $step->decider?->name,
                            'decided_at' => DateTimePresenter::format($step->decided_at, 'F j Y h:i:s A'),
                        ];
                    }

                    return $serialized;
                })->values()->all(),
            ];
        };

        return $routes->whereNull('parent_step_id')->sortBy('id')
            ->map(fn (DocumentRoute $route) => $serializeRoute($route))->values()->all();
    }

    private function canReceiveLegacyDocument(Document $document, User $user): bool
    {
        if (! $user->is_active || ! $user->canReceiveDocuments()
            || $document->is_archived || $document->legacy_needs_review) {
            return false;
        }

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        $latest = $document->latestTrail;

        return $officeId !== null
            && $latest !== null
            && strtolower((string) $latest->status) === 'available'
            && $latest->to_office_id !== null
            && (int) $latest->to_office_id === $officeId;
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
            $parts[] = DateTimePresenter::format($trail->created_at, 'M j, Y g:i A');
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

    private function officeHasActiveApprovers(Office $office, ?int $exceptUserId = null): bool
    {
        return User::query()
            ->where('office_id', $office->id)
            ->where('is_active', true)
            ->get()
            ->contains(fn (User $user) => $user->isAdministrator() && $user->canReceiveDocuments()
                && (int) $user->id !== (int) $exceptUserId);
    }

    private function notifyRouteOffice(Document $document, DocumentRoute $route, Office $office): void
    {
        if (! app(EmailNotificationMailer::class)->canSendAutomated()) {
            return;
        }

        User::query()
            ->where('office_id', $office->id)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isAdministrator() && $user->canReceiveDocuments()
                && (int) $user->id !== (int) $document->created_by
                && filter_var($user->email, FILTER_VALIDATE_EMAIL))
            ->each(fn (User $user) => SendDocumentRouteNotification::dispatch(
                recipientEmail: $user->email,
                recipientName: $user->name,
                documentId: (int) $document->id,
                documentTitle: $document->title,
                trackingNumber: $document->tracking_number,
                officeName: $office->name,
                event: 'approval_required',
                routingMode: $route->mode,
            )->afterCommit());
    }

    private function notifyRouteCreator(Document $document, DocumentRoute $route, Office $office, string $event, ?string $remarks = null): void
    {
        if (! $document->notify_by_email || ! app(EmailNotificationMailer::class)->canSendAutomated()) {
            return;
        }

        $creator = $document->creator()->first();
        if (! $creator || ! filter_var($creator->email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        SendDocumentRouteNotification::dispatch(
            recipientEmail: $creator->email,
            recipientName: $creator->name,
            documentId: (int) $document->id,
            documentTitle: $document->title,
            trackingNumber: $document->tracking_number,
            officeName: $office->name,
            event: $event,
            routingMode: $route->mode,
            remarks: $remarks,
        )->afterCommit();
    }

    private function storeDocumentFile(Document $document, UploadedFile $file, string $type, ?DocumentTrail $trail = null): string
    {
        $officeName = $document->office?->name ?: 'DOTS';
        $username = auth()->user()?->username ?: 'unknown-user';
        $directory = implode('/', [
            'documents',
            DateTimePresenter::format(now(), 'm-Y'),
            Str::slug($officeName) ?: 'office',
            Str::slug($username) ?: 'user',
            DateTimePresenter::format(now(), 'Ymd_His'),
        ]);
        $path = $file->store($directory, 'document_private');
        if (! is_string($path) || $path === '') {
            throw new \RuntimeException('Could not save the attached document.');
        }

        try {
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
        } catch (\Throwable $exception) {
            Storage::disk('document_private')->delete($path);
            throw $exception;
        }

        return $path;
    }

    private function storeRoutedDocumentFile(
        Document $document,
        UploadedFile $file,
        string $type,
        ?DocumentTrail $trail = null,
        string $validationKey = 'file',
    ): string {
        if (strtolower($file->getClientOriginalExtension()) !== 'pdf') {
            return $this->storeDocumentFile($document, $file, $type, $trail);
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'dots-tracking-');
        if (! is_string($temporaryPath)) {
            throw new \RuntimeException('Could not prepare the stamped PDF.');
        }

        try {
            try {
                $stampedPdf = app(TrackingNumberPdfStamper::class)->stamp(
                    (string) $file->getRealPath(),
                    (string) $document->tracking_number,
                    URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]),
                );
            } catch (\Throwable $exception) {
                report($exception);
                $message = $validationKey === 'supporting_files'
                    ? 'DOTS could not stamp supporting PDF "'.$file->getClientOriginalName().'". Upload a standard, unprotected PDF and try again.'
                    : 'DOTS could not stamp this PDF. Upload a standard, unprotected PDF and try again.';
                throw ValidationException::withMessages([
                    $validationKey => $message,
                ]);
            }

            if (file_put_contents($temporaryPath, $stampedPdf, LOCK_EX) !== strlen($stampedPdf)) {
                throw new \RuntimeException('Could not prepare the stamped PDF.');
            }
            chmod($temporaryPath, 0600);

            $stampedUpload = new UploadedFile(
                $temporaryPath,
                $file->getClientOriginalName(),
                'application/pdf',
                UPLOAD_ERR_OK,
                true,
            );

            return $this->storeDocumentFile($document, $stampedUpload, $type, $trail);
        } finally {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }
}
