<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\AuditTrail;
use App\Models\DocumentLegacy;
use App\Models\DocumentTrail;
use App\Models\DocumentTrailLegacy;
use App\Models\DocumentType;
use App\Models\ActionType;
use App\Models\PurposeType;
use App\Models\Office;
use App\Models\DocumentTypeLegacy;
use App\Models\ActionTypeLegacy;
use App\Models\PurposeTypeLegacy;
use App\Models\BureauLegacy;
use App\Models\UserLegacy;
use App\Services\DocumentAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class DocumentController extends Controller
{
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
                'docId', 'trackingNo', 'dtId', 'otherDtype', 'originType', 'title', 'remarks',
                'Archived', 'createdBy', 'dateCreated', 'isFinalized',
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
            ->whereIn('userUuid', $legacyTrailRows->pluck('createdBy')->filter()->unique())
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

                if (strtolower($typeName) === 'others' && filled($document->otherDtype)) {
                    $typeName .= ' ('.$document->otherDtype.')';
                }

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
            ->with(['office', 'documentType', 'purposeType', 'latestTrail.creator', 'latestTrail.fromOffice', 'latestTrail.toOffice', 'trails.creator', 'trails.fromOffice', 'trails.toOffice'])
            ->select(['id', 'tracking_number', 'title', 'status', 'office_id', 'created_by', 'is_finalized', 'remarks', 'document_type_id', 'action_type_id', 'purpose_type_id', 'origin_type', 'received_from', 'urgent', 'notify_by_email', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->limit(200)
            ->get()
            ->map(function ($document) use ($currentOfficeId, $isAdministrator, $user) {
                $latest = $document->latestTrail;
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
                    'purpose_type' => $document->purposeType?->name ?? '',
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
            'title' => ['required', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'document_type_id' => ['nullable', 'integer', 'exists:document_types,id'],
            'purpose_type_id' => ['nullable', 'integer', 'exists:purpose_types,id'],
            'origin_type' => ['nullable', 'string', 'max:100'],
            'urgent' => ['boolean'],
            'notify_by_email' => ['boolean'],
            'is_finalized' => ['required', 'boolean'],
            'file' => ['nullable', 'file', 'max:10240'],
        ]);

        $document = null;
        DB::transaction(function () use ($validated, &$document) {
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
                'purpose_type_id' => $validated['purpose_type_id'] ?? null,
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

        });

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $path = $file->store('documents', 'public');
            $document->files()->create([
                'file_name' => basename($path), 'original_name' => $file->getClientOriginalName(),
                'file_path' => $path, 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(),
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
            'purpose_type_id' => ['nullable', 'integer', 'exists:purpose_types,id'],
            'origin_type' => ['nullable', 'string', 'max:100'],
            'urgent' => ['boolean'],
            'notify_by_email' => ['boolean'],
            'is_finalized' => ['required', 'boolean'],
            'file' => ['nullable', 'file', 'max:10240'],
        ]);

        $document = Document::findOrFail($id);
        abort_unless($this->canManageDraft($document), 403);

        $document->update([
            'title' => $validated['title'],
            'status' => $validated['is_finalized'] ? 'pending' : 'draft',
            'remarks' => $validated['remarks'] ?? null,
            'document_type_id' => $validated['document_type_id'] ?? null,
            'purpose_type_id' => $validated['purpose_type_id'] ?? null,
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
        $validated = $request->validate([
            'to_office_id' => ['required', 'integer', 'exists:offices,id'],
            'remarks' => ['nullable', 'string'],
        ]);
        $document = Document::with('latestTrail')->findOrFail($id);
        $this->authorizeCurrentHolder($document);
        $officeId = app(DocumentAccess::class)->currentOfficeId(auth()->user());

        DB::transaction(function () use ($document, $validated, $officeId) {
            $document->trails()->create([
                'from_office_id' => $officeId,
                'to_office_id' => $validated['to_office_id'],
                'created_by' => auth()->id(),
                'status' => 'available',
                'action' => 'Released',
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
            'offices' => $this->mergeLibraryOptions(
                Office::query()->orderBy('name')->get(['id', 'name']),
                $this->legacyRows(fn () => BureauLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('longName')->get(['longName']))
            ),
        ];
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

            $name = rawurldecode(substr($value, 7));
            $legacyNameColumn = $field === 'office_id' ? 'longName' : 'name';
            $legacyRecord = $legacyModel::query()->where($legacyNameColumn, $name)->first();
            abort_unless($legacyRecord, 422, 'The selected library item is no longer available.');

            $currentName = $field === 'office_id' ? 'name' : 'name';
            $currentRecord = $currentModel::query()->firstOrCreate([$currentName => $name]);
            $request->merge([$field => $currentRecord->id]);
        }
    }
}
