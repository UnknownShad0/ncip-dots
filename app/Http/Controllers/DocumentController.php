<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\AuditTrail;
use App\Models\DocumentLegacy;
use App\Models\DocumentTrail;
use App\Models\DocumentTrailLegacy;
use App\Models\DocumentType;
use App\Models\ActionType;
use App\Models\PurposeType;
use App\Models\Office;
use App\Models\Range;
use App\Models\RangeLegacy;
use App\Models\DocumentTypeLegacy;
use App\Models\ActionTypeLegacy;
use App\Models\PurposeTypeLegacy;
use App\Models\BureauLegacy;
use App\Models\User;
use App\Models\UserLegacy;
use App\Services\DocumentAccess;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class DocumentController extends Controller
{
    private const MAX_DOCUMENT_UPLOAD_KB = 10240;
    private bool $userRangeResolved = false;
    private ?array $userRangeIdentity = null;
    private ?array $legacyRangeNames = null;

    public function index()
    {
        return $this->renderDocumentList();
    }

    public function latest()
    {
        return $this->renderDocumentList(true);
    }

    private function renderDocumentList(bool $latestOnly = false)
    {
        $legacyDocuments = collect();
        $legacyTrailRows = collect();
        $legacyTransactions = collect();
        $legacyTransactionUsers = collect();
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

        $legacyTransactionUsers = UserLegacy::query()
            ->whereIn('userUuid', $legacyTrailRows->pluck('createdBy')->merge($legacyDocuments->pluck('createdBy'))->filter()->unique())
            ->get(['userUuid', 'username', 'firstname', 'middlename', 'lastname', 'extensionname'])
            ->mapWithKeys(function (UserLegacy $user) {
                $name = collect([$user->firstname, $user->middlename, $user->lastname, $user->extensionname])
                    ->filter(fn ($part) => filled($part))
                    ->implode(' ');

                return [$user->userUuid => $name ?: ($user->username ?? '')];
            });
        } catch (\Throwable $exception) {
            // The current Documents module must remain usable while the optional
            // legacy database is offline or its credentials are unavailable.
            report($exception);
            $legacyDocuments = collect();
            $legacyTrailRows = collect();
        }

        $legacyDocumentTypes = $latestOnly ? collect() : DocumentTypeLegacy::query()
            ->whereIn('dtId', $legacyDocuments->pluck('dtId')->filter()->unique())
            ->get(['dtId', 'name'])
            ->keyBy('dtId');

        $legacyBureaus = $latestOnly ? collect() : BureauLegacy::query()
            ->whereIn('bureauId', $legacyTrailRows->flatMap(fn ($trail) => [$trail->originating, $trail->receiving, $trail->holder])->filter()->unique())
            ->get(['bureauId', 'longName', 'shortName'])
            ->keyBy('bureauId');
        $legacyTransactionsByDocument = $legacyTrailRows->groupBy('trackingNo');
        $legacyDocuments = $legacyDocuments
            ->map(function ($document) use ($legacyTransactions, $legacyTransactionUsers, $legacyDocumentTypes, $legacyTransactionsByDocument, $legacyBureaus) {
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
                    'title' => $document->title ?? '',
                    'created_at' => $document->dateCreated?->format('F j Y h:i:s A'),
                    'status' => $status,
                    'office_name' => $legacyBureaus->get($originatingBureauId)?->longName ?? $legacyBureaus->get($originatingBureauId)?->shortName ?? '',
                    'document_type' => $typeName,
                    'other_document_type' => $document->otherDtype ?? '',
                    'purpose_type' => $document->purpose ?? '',
                    'created_by_name' => $legacyTransactionUsers->get($document->createdBy) ?? $document->createdBy,
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
            ->with(['office', 'documentType', 'purposeType', 'creator', 'files', 'latestTrail.creator', 'latestTrail.fromOffice', 'latestTrail.toOffice', 'trails.creator', 'trails.fromOffice', 'trails.toOffice'])
            ->select(['id', 'tracking_number', 'title', 'status', 'office_id', 'created_by', 'is_finalized', 'remarks', 'document_type_id', 'action_type_id', 'other_action', 'purpose_type_id', 'other_document_type', 'other_purpose', 'origin_type', 'received_from', 'urgent', 'notify_by_email', 'created_at'])
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
                $isDraft = !$document->is_finalized && strtolower((string) $document->status) === 'draft';

                return [
                    'id' => $document->id,
                    'tracking_number' => $document->tracking_number ?? '',
                    'title' => $document->title ?? '',
                    'status' => $this->workflowStatus($document->latestTrail?->status ?? $document->status),
                    'office_name' => $document->office?->name ?? '',
                    'document_type' => $document->documentType?->name ?? '',
                    'other_document_type' => $document->other_document_type ?? '',
                    'purpose_type' => $document->purposeType?->name ?? '',
                    'other_purpose' => $document->other_purpose ?? '',
                    'created_by_name' => $document->creator?->name ?? '',
                    'file_name' => $latestFile?->original_name ?? $latestFile?->file_name,
                    'file_url' => $latestFile ? Storage::disk('public')->url($latestFile->file_path) : null,
                    'origin_type' => $document->origin_type ?? '',
                    'last_transaction' => $this->formatTrailTransaction($document->latestTrail),
                    'transactions' => $document->trails->sortByDesc('id')->values()->map(fn (DocumentTrail $trail) => [
                        'action' => $trail->action ?: ucfirst(strtolower((string) $trail->status)),
                        'status' => $trail->status,
                        'remarks' => $trail->remarks,
                        'from_office' => $trail->fromOffice?->name,
                        'to_office' => $trail->toOffice?->name,
                        'holder' => $trail->toOffice?->name,
                        'created_by' => $trail->creator?->name,
                        'created_at' => $trail->created_at?->format('F j Y h:i:s A'),
                    ]),
                    'created_at' => $document->created_at?->format('F j Y h:i:s A'),
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
                    'can_release' => $isPendingHolder,
                    'can_terminal' => $isPendingHolder,
                    'can_receive' => $isIncoming,
                    'can_delete' => $isDraft && ($admin || ($isOriginOffice && (int) $document->created_by === (int) $user?->id)),
                ];
            });

        return Inertia::render('Documents/Index', [
            'documents' => [
                ...$legacyDocuments->toArray(),
                ...$newDocuments->toArray(),
            ],
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
        $this->resolveLegacySelections($request);
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
            'file' => ['nullable', 'file', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        $approvedDraft = null;
        if ($validated['approved_draft_id'] ?? null) {
            $approvedDraft = DocumentCreationDraft::query()
                ->whereKey($validated['approved_draft_id'])
                ->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered'])
                ->where('created_by', auth()->id())
                ->first();
            abort_unless($approvedDraft, 422, 'The approved document is no longer available for finalization.');
            if ($approvedDraft->status === 'registered' && $approvedDraft->official_document_id) {
                return redirect()->route('documents.index')->with('success', 'The existing document is ready for another trail action. Select Release from its row.');
            }
            $validated['title'] = $approvedDraft->title;
            $validated['document_type_id'] = $approvedDraft->document_type_id;
            $validated['is_finalized'] = true;
        }
        $validated = $this->normalizeActionTypeDetails($validated);
        $validated = $this->normalizeDocumentTypeAndPurpose($validated);

        $document = null;
        DB::transaction(function () use ($validated, $approvedDraft, &$document) {
            $user = auth()->user();
            $access = app(DocumentAccess::class);
            $officeId = $access->currentOfficeId($user);
            $userOffice = $officeId ? Office::query()->find($officeId) : null;
            $date = now();
            $officeName = $userOffice?->name ?: 'DOTS';
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
                $document->trails()->create([
                    'from_office_id' => $officeId,
                    'created_by' => auth()->id(),
                    'status' => 'pending',
                    'action' => 'Finalized',
                ]);
            }

            if ($approvedDraft) {
                $approvedDraft->update(['official_document_id' => $document->id, 'status' => 'registered']);
                $approvedDraft->events()->create([
                    'user_id' => auth()->id(),
                    'event' => 'Registered in DOTS',
                    'metadata' => ['document_id' => $document->id],
                ]);
            }

        });

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $path = $file->store('documents', 'public');
            $document->files()->create([
                'file_name' => basename($path), 'original_name' => $file->getClientOriginalName(),
                'file_path' => $path, 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(),
                'uploaded_by' => auth()->id(),
            ]);
        } elseif ($approvedDraft) {
            $path = 'documents/'.$document->tracking_number.'.pdf';
            $pdf = Pdf::loadHTML($this->approvedDraftHtml($approvedDraft))->setPaper('letter');
            Storage::disk('public')->put($path, $pdf->output());
            $document->files()->create([
                'file_name' => basename($path),
                'original_name' => $document->title.'.pdf',
                'file_path' => $path,
                'mime_type' => 'application/pdf',
                'size_bytes' => Storage::disk('public')->size($path),
                'uploaded_by' => auth()->id(),
            ]);
        }

        return redirect()->route('documents.index')->with('success', 'Document created successfully.');
    }

    public function update(Request $request, $id)
    {
        $this->resolveLegacySelections($request);
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
            'file' => ['nullable', 'file', 'max:'.self::MAX_DOCUMENT_UPLOAD_KB],
        ]);
        $validated = $this->normalizeActionTypeDetails($validated);
        $validated = $this->normalizeDocumentTypeAndPurpose($validated);

        $document = Document::findOrFail($id);
        abort_unless($this->canManageDraft($document), 403);

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

        if ($validated['is_finalized']) {
            $document->trails()->create([
                'from_office_id' => $document->office_id,
                'created_by' => auth()->id(),
                'status' => 'pending',
                'action' => 'Finalized',
            ]);
        }

        if ($file = $request->file('file')) {
            $path = $file->store('documents', 'public');
            $document->files()->create([
                'file_name' => basename($path), 'original_name' => $file->getClientOriginalName(),
                'file_path' => $path, 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(),
                'uploaded_by' => auth()->id(),
            ]);
        }

        return redirect()->route('documents.index')->with('success', 'Document updated successfully.');
    }

    public function release(Request $request, $id)
    {
        $request->merge(['office_id' => $request->input('to_office_id')]);
        $this->resolveLegacySelections($request);
        $request->merge(['to_office_id' => $request->input('office_id')]);
        $validated = $request->validate([
            'action_type_id' => ['required', 'integer', 'exists:action_types,id'],
            'other_action' => ['nullable', 'string', 'max:255'],
            'to_office_id' => ['required', 'integer', 'exists:offices,id'],
            'remarks' => ['nullable', 'string', 'max:250'],
        ]);
        $validated = $this->normalizeActionTypeDetails($validated);
        $targetOffice = Office::findOrFail($validated['to_office_id']);
        if (! $this->officeIsInCurrentUserRange($targetOffice)) {
            throw ValidationException::withMessages([
                'to_office_id' => 'Choose a receiving office within your assigned range.',
            ]);
        }
        if (!$this->officeHasActiveUsers($targetOffice)) {
            throw ValidationException::withMessages([
                'to_office_id' => 'Choose a receiving office with at least one active user.',
            ]);
        }
        $document = Document::with('latestTrail')->findOrFail($id);
        $this->authorizeCurrentHolder($document);
        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());

        DB::transaction(function () use ($document, $validated, $officeId) {
            $document->trails()->create([
                'from_office_id' => $officeId,
                'to_office_id' => $validated['to_office_id'],
                'created_by' => auth()->id(),
                'status' => 'available',
                'action' => 'Released - '.$validated['action_type_name'].(mb_strtolower($validated['action_type_name']) === 'others' ? ': '.$validated['other_action'] : ''),
                'remarks' => $validated['remarks'] ?? null,
            ]);
            $document->update(['status' => 'available']);
        });

        return back()->with('success', 'Document released successfully.');
    }

    public function receive($id)
    {
        $user = auth()->user();
        abort_unless($user->canReceiveDocuments(), 403, 'Your role cannot receive documents.');

        $officeId = app(DocumentAccess::class)->currentOfficeId($user);
        abort_unless($officeId, 403, 'Your account is not assigned to an office.');

        $canReceiveAcrossOffices = app(DocumentAccess::class)->canViewAllDocuments($user);
        $document = DB::transaction(function () use ($id, $officeId, $user, $canReceiveAcrossOffices) {
            $document = Document::query()->lockForUpdate()->findOrFail($id);
            $latestTrail = $document->trails()->orderByDesc('id')->lockForUpdate()->first();

            if (!(
                $latestTrail
                    && strtolower((string) $latestTrail->status) === 'available'
                    && ($canReceiveAcrossOffices || (int) $latestTrail->to_office_id === $officeId)
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
            AuditTrail::query()->create([
                'user_id' => $user->id,
                'action' => 'document.received',
                'model_type' => Document::class,
                'model_id' => $document->id,
                'details' => sprintf(
                    'Received %s at office %d from office %s.',
                    $document->tracking_number,
                    $officeId,
                    $latestTrail->from_office_id ?? 'unknown'
                ),
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            return $document;
        });

        if ($document->notify_by_email && filled($document->creator?->email)) {
            try {
                Mail::raw(
                    sprintf('Your document %s (%s) was received by %s.', $document->title, $document->tracking_number, $user->office?->name ?? 'its destination office'),
                    fn ($message) => $message->to($document->creator->email)->subject('Document received: '.$document->tracking_number)
                );
            } catch (\Throwable $exception) {
                report($exception);
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
            $document->update(['status' => 'terminal', 'is_archived' => true]);
        });

        return back()->with('success', 'Document tagged as terminal.');
    }

    public function destroy($id)
    {
        $document = Document::findOrFail($id);
        abort_unless($this->canManageDraft($document), 403);
        $document->delete();

        return back()->with('success', 'Draft deleted successfully.');
    }

    private function canManageDraft(Document $document): bool
    {
        $user = auth()->user();
        $admin = $user?->isAdministrator() ?? false;
        $draft = !$document->is_finalized && strtolower((string) $document->status) === 'draft';
        $officeId = $user ? app(DocumentAccess::class)->currentOfficeId($user) : null;
        $originOffice = $officeId && (int) $document->office_id === (int) $officeId;

        return $draft && ($admin || ($originOffice && (int) $document->created_by === (int) $user?->id));
    }

    private function normalizeActionTypeDetails(array $validated): array
    {
        $actionType = isset($validated['action_type_id']) ? ActionType::find($validated['action_type_id']) : null;
        $actionTypeName = trim((string) $actionType?->name);
        $isOtherAction = mb_strtolower($actionTypeName) === 'others';

        if ($isOtherAction && !filled($validated['other_action'] ?? null)) {
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

        if ($isOtherDocumentType && !filled($validated['other_document_type'] ?? null)) {
            throw ValidationException::withMessages([
                'other_document_type' => 'Please specify the document type when selecting Others.',
            ]);
        }

        if ($isOtherPurpose && !filled($validated['other_purpose'] ?? null)) {
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
        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());
        $latest = $document->latestTrail;
        $holderOfficeId = $latest?->to_office_id ?? $document->office_id;

        abort_unless($officeId && strtolower((string) ($latest?->status ?? $document->status)) === 'pending'
            && (int) $holderOfficeId === (int) $officeId, 403);
    }

    private function documentFormOptions(): array
    {
        return [
            'maxUploadSizeKb' => self::MAX_DOCUMENT_UPLOAD_KB,
            'approvedDocuments' => DocumentCreationDraft::query()
                ->with('documentType:id,name')
                ->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered'])
                ->where('created_by', auth()->id())
                ->latest('decision_at')
                ->get(['id', 'title', 'document_type_id'])
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
            'documentTypes' => $this->mergeLibraryOptions(
                DocumentType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                $this->legacyRows(fn () => DocumentTypeLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('name')->get(['name']))
            ),
            'actionTypes' => $this->mergeLibraryOptions(
                ActionType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                $this->legacyRows(fn () => ActionTypeLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('name')->get(['name']))
            ),
            'purposeTypes' => $this->mergeLibraryOptions(
                PurposeType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                $this->legacyRows(fn () => PurposeTypeLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('name')->get(['name']))
            ),
            'offices' => Office::query()
                ->with('range:id,name')
                ->orderBy('name')
                ->get(['id', 'name', 'range_id', 'legacy_range_id'])
                ->filter(fn (Office $office) => $this->officeIsInCurrentUserRange($office))
                ->map(fn (Office $office) => [
                    'id' => (string) $office->id,
                    'name' => $office->name,
                    'source' => 'New DB',
                    'disabled' => ! $this->officeHasActiveUsers($office),
                ])
                ->values()
                ->all(),
        ];
    }

    private function approvedDraftHtml(DocumentCreationDraft $draft): string
    {
        $content = $draft->content ?? [];
        $field = static fn (string $key): string => e((string) ($content[$key] ?? ''));
        $paragraphs = collect(preg_split('/\R/', (string) ($content['body'] ?? '')))
            ->filter(fn (string $paragraph) => trim($paragraph) !== '')
            ->map(fn (string $paragraph) => '<p>'.e($paragraph).'</p>')
            ->implode('');
        $cc = collect($content['cc'] ?? [])
            ->filter(fn ($recipient) => filled($recipient))
            ->map(fn ($recipient) => e((string) $recipient))
            ->implode('; ');

        return '<!doctype html><html><head><meta charset="utf-8"><style>
            @page { margin: 0.65in; }
            body { font-family: DejaVu Sans, sans-serif; font-size: 11pt; line-height: 1.55; color: #111; }
            h1 { text-align: center; font-size: 14pt; margin: 0 0 28px; }
            .meta { margin-bottom: 26px; }
            .meta div { margin: 4px 0; }
            .label { display: inline-block; width: 82px; font-weight: bold; }
            .body { min-height: 360px; }
            p { margin: 0 0 10px; }
        </style></head><body>
            <h1>'.e($draft->title).'</h1>
            <div class="meta">
                <div><span class="label">FOR:</span> '.$field('for').'</div>
                <div><span class="label">THRU:</span> '.$field('thru').'</div>
                <div><span class="label">ATTENTION:</span> '.$field('attention').'</div>
                <div><span class="label">FROM:</span> '.$field('from').'</div>
                <div><span class="label">SUBJECT:</span> '.$field('subject').'</div>
                <div><span class="label">DATE:</span> '.$field('date').'</div>
            </div>
            <div class="body">'.$paragraphs.'</div>
            '.($cc !== '' ? '<div><strong>CC:</strong> '.$cc.'</div>' : '').'
        </body></html>';
    }

    private function legacyRows(callable $query)
    {
        try {
            return $query();
        } catch (\Throwable $exception) {
            report($exception);

            return collect();
        }
    }

    private function formatLastTransaction(?string $action, ?string $status, ?string $userName, ?string $date): string
    {
        $transaction = filled($action) ? $action : (filled($status) ? ucfirst(strtolower($status)) : '');

        if ($transaction !== '' && filled($userName)) {
            $transaction .= ' by '.$userName;
        } elseif ($transaction === '' && filled($userName)) {
            $transaction = 'Processed by '.$userName;
        }

        if (filled($date)) {
            $transaction .= ($transaction !== '' ? ' · ' : '').$date;
        }

        return $transaction !== '' ? $transaction : '—';
    }

    private function formatTrailTransaction(?DocumentTrail $trail): string
    {
        if (!$trail) {
            return 'No transactions recorded';
        }

        $parts = [filled($trail->action) ? $trail->action : ucfirst(strtolower((string) $trail->status))];
        if ($trail->fromOffice?->name && $trail->toOffice?->name) {
            $parts[] = $trail->fromOffice->name.' → '.$trail->toOffice->name;
        } elseif ($trail->fromOffice?->name) {
            $parts[] = 'From '.$trail->fromOffice->name;
        } elseif ($trail->toOffice?->name) {
            $parts[] = 'To '.$trail->toOffice->name;
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

    private function mergeLibraryOptions($current, $legacy): array
    {
        $options = $current->map(fn ($row) => ['id' => (string) $row->id, 'name' => $row->name, 'source' => 'New DB']);
        $names = $options->map(fn ($row) => mb_strtolower($row['name']))->all();

        foreach ($legacy as $row) {
            $name = $row->name ?? $row->longName ?? '';
            if ($name !== '' && !in_array(mb_strtolower($name), $names, true)) {
                $options->push(['id' => 'legacy:'.rawurlencode($name), 'name' => $name, 'source' => 'Old DB']);
                $names[] = mb_strtolower($name);
            }
        }

        return $options->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    private function mergeOfficeOptions($current, $legacy): array
    {
        $options = $current->map(fn (Office $row) => [
            'id' => (string) $row->id,
            'name' => $row->name,
            'source' => 'New DB',
            'disabled' => !$this->officeHasActiveUsers($row),
        ]);
        $names = $options->map(fn ($row) => mb_strtolower($row['name']))->all();

        foreach ($legacy as $row) {
            $name = $row->longName ?? '';
            if ($name !== '' && !in_array(mb_strtolower($name), $names, true)) {
                $options->push([
                    'id' => 'legacy:'.$row->bureauId,
                    'name' => $name,
                    'source' => 'Old DB',
                    'disabled' => !$this->legacyBureauIsActive($row) || !$this->legacyBureauHasActiveUsers($row),
                ]);
                $names[] = mb_strtolower($name);
            }
        }

        return $options->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    private function currentUserRangeIdentity(): ?array
    {
        if ($this->userRangeResolved) return $this->userRangeIdentity;
        $this->userRangeResolved = true;

        $user = auth()->user();
        if (! $user) return null;

        $office = $user->office_id
            ? Office::query()->with('range')->find($user->office_id, ['id', 'name', 'code', 'range_id', 'legacy_range_id'])
            : null;

        if (! $office && filled($user->office_code)) {
            $office = Office::query()->with('range')->where('code', $user->office_code)
                ->first(['id', 'name', 'code', 'range_id', 'legacy_range_id']);
        }

        if ($office && ($identity = $this->officeRangeIdentity($office))) {
            return $this->userRangeIdentity = $identity;
        }

        if ($user->legacy_office_id) {
            $bureau = BureauLegacy::query()->whereKey($user->legacy_office_id)->first(['bureauId', 'range']);
            if ($bureau && ($identity = $this->legacyBureauRangeIdentity($bureau))) {
                return $this->userRangeIdentity = $identity;
            }
        }

        return null;
    }

    private function legacyBureauIsInCurrentUserRange(BureauLegacy $bureau): bool
    {
        $userRange = $this->currentUserRangeIdentity();
        $bureauRange = $this->legacyBureauRangeIdentity($bureau);

        return $userRange !== null && $userRange === $bureauRange;
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

        if ($office->legacy_range_id !== null && RangeLegacy::query()->whereKey($office->legacy_range_id)->exists()) {
            return ['source' => 'legacy', 'id' => (int) $office->legacy_range_id];
        }

        $bureau = BureauLegacy::query()->where('longName', $office->name)->first(['bureauId', 'range']);

        return $bureau ? $this->legacyBureauRangeIdentity($bureau) : null;
    }

    private function legacyBureauRangeIdentity(BureauLegacy $bureau): ?array
    {
        $value = trim((string) ($bureau->range ?? ''));
        if ($value === '') return null;

        $range = ctype_digit($value)
            ? RangeLegacy::query()->whereKey((int) $value)->first(['id'])
            : RangeLegacy::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($value)])->first(['id']);

        return $range ? ['source' => 'legacy', 'id' => (int) $range->id] : null;
    }

    private function legacyBureauIsActive(BureauLegacy $bureau): bool
    {
        return in_array(strtolower(trim((string) $bureau->status)), ['1', 'active', 'enabled', 'y'], true);
    }

    private function legacyBureauHasActiveUsers(BureauLegacy $bureau): bool
    {
        $hasLegacyUser = UserLegacy::query()
            ->where('bureauId', $bureau->bureauId)
            ->whereIn('status', ['1', 'active', 'Active', 'y', 'Y'])
            ->exists();
        $hasLocalUser = User::query()
            ->where('legacy_office_id', $bureau->bureauId)
            ->where('is_active', true)
            ->exists();
        if (!$hasLocalUser) {
            $officeId = Office::query()->where('name', $bureau->longName)->value('id');
            $hasLocalUser = $officeId !== null && User::query()
                ->where('office_id', $officeId)
                ->where('is_active', true)
                ->exists();
        }

        return $hasLegacyUser || $hasLocalUser;
    }

    private function officeHasActiveUsers(Office $office): bool
    {
        $legacyBureau = BureauLegacy::query()->where('longName', $office->name)->first();
        if ($legacyBureau) {
            return $this->legacyBureauIsActive($legacyBureau) && $this->legacyBureauHasActiveUsers($legacyBureau);
        }

        return User::query()->where('office_id', $office->id)->where('is_active', true)->exists();
    }

    private function legacyRangeName(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') return null;
        if (!ctype_digit($value)) return $value;

        $this->legacyRangeNames ??= RangeLegacy::query()->pluck('name', 'id')->all();
        return $this->legacyRangeNames[(int) $value] ?? null;
    }

    private function resolveLegacySelections(Request $request): void
    {
        $libraries = [
            'document_type_id' => [DocumentType::class, DocumentTypeLegacy::class],
            'action_type_id' => [ActionType::class, ActionTypeLegacy::class],
            'purpose_type_id' => [PurposeType::class, PurposeTypeLegacy::class],
            'office_id' => [Office::class, BureauLegacy::class],
        ];

        foreach ($libraries as $field => [$currentModel, $legacyModel]) {
            $value = $request->input($field);
            if (!is_string($value) || !str_starts_with($value, 'legacy:')) {
                continue;
            }

            $selection = rawurldecode(substr($value, 7));
            $legacyRecord = $field === 'office_id' && ctype_digit($selection)
                ? $legacyModel::query()->find((int) $selection)
                : $legacyModel::query()->where($field === 'office_id' ? 'longName' : 'name', $selection)->first();
            abort_unless($legacyRecord, 422, 'The selected library item is no longer available.');

            if ($field === 'office_id' && (!$this->legacyBureauIsActive($legacyRecord)
                || !$this->legacyBureauHasActiveUsers($legacyRecord)
                || !$this->legacyBureauIsInCurrentUserRange($legacyRecord))) {
                throw ValidationException::withMessages([
                    'to_office_id' => 'Choose an active receiving office within your bureau range.',
                ]);
            }

            $name = $field === 'office_id' ? $legacyRecord->longName : $legacyRecord->name;
            $currentRecord = $currentModel::query()->firstOrCreate(['name' => $name]);
            $request->merge([$field => $currentRecord->id]);
        }
    }
}
