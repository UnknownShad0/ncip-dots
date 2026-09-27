<?php

namespace App\Http\Controllers;

use App\Models\Document;
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
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function index()
    {
        $legacyDocuments = DocumentLegacy::query()
            ->select([
                'docId', 'trackingNo', 'dtId', 'otherDtype', 'originType', 'title', 'remarks',
                'Archived', 'createdBy', 'dateCreated',
            ])
            ->orderBy('dateCreated', 'desc')
            ->limit(200)
            ->get();

        $legacyTrackingNumbers = $legacyDocuments->pluck('trackingNo')->filter()->unique()->values();
        $legacyTransactions = DocumentTrailLegacy::query()
            ->whereIn('trackingNo', $legacyTrackingNumbers)
            ->select(['docTrailId', 'trackingNo', 'status', 'action', 'createdBy', 'dateCreated'])
            ->orderByDesc('dateCreated')
            ->orderByDesc('docTrailId')
            ->get()
            ->unique('trackingNo')
            ->keyBy('trackingNo');

        $legacyTransactionUsers = UserLegacy::query()
            ->whereIn('userUuid', $legacyTransactions->pluck('createdBy')->filter()->unique())
            ->get(['userUuid', 'username', 'firstname', 'middlename', 'lastname', 'extensionname'])
            ->mapWithKeys(function (UserLegacy $user) {
                $name = collect([$user->firstname, $user->middlename, $user->lastname, $user->extensionname])
                    ->filter(fn ($part) => filled($part))
                    ->implode(' ');

                return [$user->userUuid => $name ?: ($user->username ?? '')];
            });

        $legacyDocumentTypes = DocumentTypeLegacy::query()
            ->whereIn('dtId', $legacyDocuments->pluck('dtId')->filter()->unique())
            ->get(['dtId', 'name'])
            ->keyBy('dtId');

        $legacyDocuments = $legacyDocuments
            ->map(function ($document) use ($legacyTransactions, $legacyTransactionUsers, $legacyDocumentTypes) {
                $transaction = $legacyTransactions->get($document->trackingNo);
                $typeName = $legacyDocumentTypes->get($document->dtId)?->name ?? '';

                if (strtolower($typeName) === 'others' && filled($document->otherDtype)) {
                    $typeName .= ' ('.$document->otherDtype.')';
                }

                $status = strtolower((string) ($transaction?->status ?? 'pending'));
                if (($document->Archived ?? null) === 'Y') {
                    $status = 'archived';
                }

                return [
                    'id' => $document->docId,
                    'tracking_number' => $document->trackingNo ?? '',
                    'title' => $document->title ?? '',
                    'status' => $status,
                    'office_name' => '',
                    'document_type' => $typeName,
                    'origin_type' => $document->originType ?? '',
                    'last_transaction' => $this->formatLastTransaction(
                        $transaction?->action,
                        $transaction?->status,
                        $legacyTransactionUsers->get($transaction?->createdBy) ?? $transaction?->createdBy,
                        $transaction?->dateCreated?->format('M j, Y g:i A'),
                    ),
                    'remarks' => $document->remarks ?? '',
                    'source' => 'Old DB',
                ];
            });

        $newDocuments = Document::query()
            ->with(['office', 'documentType', 'latestTrail.creator'])
            ->select(['id', 'tracking_number', 'title', 'status', 'office_id', 'remarks', 'document_type_id', 'action_type_id', 'purpose_type_id', 'origin_type', 'received_from'])
            ->orderBy('created_at', 'desc')
            ->limit(200)
            ->get()
            ->map(function ($document) {
                return [
                    'id' => $document->id,
                    'tracking_number' => $document->tracking_number ?? '',
                    'title' => $document->title ?? '',
                    'status' => $document->status ?? 'pending',
                    'office_name' => $document->office?->name ?? '',
                    'document_type' => $document->documentType?->name ?? '',
                    'origin_type' => $document->origin_type ?? '',
                    'last_transaction' => $this->formatLastTransaction(
                        $document->latestTrail?->action,
                        $document->latestTrail?->status,
                        $document->latestTrail?->creator?->name,
                        $document->latestTrail?->created_at?->format('M j, Y g:i A'),
                    ),
                    'remarks' => $document->remarks ?? '',
                    'document_type_id' => $document->document_type_id,
                    'action_type_id' => $document->action_type_id,
                    'purpose_type_id' => $document->purpose_type_id,
                    'office_id' => $document->office_id,
                    'received_from' => $document->received_from,
                    'source' => 'New DB',
                ];
            });

        return Inertia::render('Documents/Index', [
            'documents' => [
                ...$legacyDocuments->toArray(),
                ...$newDocuments->toArray(),
            ],
            ...$this->documentFormOptions(),
        ]);
    }

    public function latest()
    {
        $documents = Document::with(['documentType', 'office', 'creator'])
            ->latest('created_at')
            ->limit(200)
            ->get();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'title' => 'Latest Documents',
            ...$this->documentFormOptions(),
        ]);
    }

    public function incoming()
    {
        $documents = Document::with(['documentType', 'office', 'creator'])
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
        $documents = Document::with(['documentType', 'office', 'creator'])
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
            'status' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
            'document_type_id' => ['nullable', 'integer', 'exists:document_types,id'],
            'action_type_id' => ['nullable', 'integer', 'exists:action_types,id'],
            'purpose_type_id' => ['nullable', 'integer', 'exists:purpose_types,id'],
            'origin_type' => ['nullable', 'string', 'max:100'],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'received_from' => ['nullable', 'string', 'max:255'],
        ]);

        DB::transaction(function () use ($validated) {
            $userOffice = auth()->user()?->office;
            $officeId = $validated['office_id'] ?? $userOffice?->id;
            $date = now();
            $officeName = $userOffice?->name ?: 'DOTS';
            $bureauPrefix = preg_replace('/\s+/', '-', trim($officeName));

            $document = Document::create([
                'title' => $validated['title'],
                'tracking_number' => 'draft-'.Str::uuid(),
                'status' => $validated['status'] ?? 'pending',
                'remarks' => $validated['remarks'] ?? null,
                'document_type_id' => $validated['document_type_id'] ?? null,
                'action_type_id' => $validated['action_type_id'] ?? null,
                'purpose_type_id' => $validated['purpose_type_id'] ?? null,
                'origin_type' => $validated['origin_type'] ?? null,
                'office_id' => $officeId,
                'received_from' => $validated['received_from'] ?? null,
                'created_by' => auth()->id(),
            ]);

            $document->update([
                'tracking_number' => $bureauPrefix.'-'.$date->format('y-m-d').'-'.str_pad((string) $document->id, 4, '0', STR_PAD_LEFT),
            ]);
        });

        return redirect()->route('documents.index')->with('success', 'Document created successfully.');
    }

    public function update(Request $request, $id)
    {
        $this->resolveLegacySelections($request);
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', 'string'],
            'remarks' => ['nullable', 'string'],
            'document_type_id' => ['nullable', 'integer', 'exists:document_types,id'],
            'action_type_id' => ['nullable', 'integer', 'exists:action_types,id'],
            'purpose_type_id' => ['nullable', 'integer', 'exists:purpose_types,id'],
            'origin_type' => ['nullable', 'string', 'max:100'],
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'received_from' => ['nullable', 'string', 'max:255'],
        ]);

        $document = Document::findOrFail($id);

        $document->update([
            'title' => $validated['title'],
            'status' => $validated['status'],
            'remarks' => $validated['remarks'] ?? null,
            'document_type_id' => $validated['document_type_id'] ?? null,
            'action_type_id' => $validated['action_type_id'] ?? null,
            'purpose_type_id' => $validated['purpose_type_id'] ?? null,
            'origin_type' => $validated['origin_type'] ?? null,
            'office_id' => $validated['office_id'] ?? null,
            'received_from' => $validated['received_from'] ?? null,
        ]);

        return redirect()->route('documents.index')->with('success', 'Document updated successfully.');
    }

    private function documentFormOptions(): array
    {
        return [
            'documentTypes' => $this->mergeLibraryOptions(
                DocumentType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                DocumentTypeLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('name')->get(['name'])
            ),
            'actionTypes' => $this->mergeLibraryOptions(
                ActionType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                ActionTypeLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('name')->get(['name'])
            ),
            'purposeTypes' => $this->mergeLibraryOptions(
                PurposeType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                PurposeTypeLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('name')->get(['name'])
            ),
            'offices' => $this->mergeLibraryOptions(
                Office::query()->orderBy('name')->get(['id', 'name']),
                BureauLegacy::query()->whereIn('status', ['active', 'Active', 'enabled', 'Enabled', '1', 'Y'])->orderBy('longName')->get(['longName'])
            ),
        ];
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
