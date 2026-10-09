<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\RangeLegacy;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DocumentCreationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $approvedOnly = $request->query('queue') === 'approved';
        $drafts = DocumentCreationDraft::query()->with(['creator:id,name', 'approver:id,name', 'documentType:id,name', 'events.user:id,name'])
            ->where(fn ($q) => $q->where('created_by', $user->id)->orWhere('approver_id', $user->id)->orWhere('verified_by', $user->id))
            ->when($request->query('queue') === 'approval', fn ($q) => $q->where('approver_id', $user->id)->where('status', 'pending_approval'))
            ->when($request->query('queue') === 'submitted', fn ($q) => $q->where('created_by', $user->id)->where('status', 'pending_approval'))
            ->when($request->query('queue') === 'revision', fn ($q) => $q->where('created_by', $user->id)->where('status', 'revision_requested'))
            ->when($approvedOnly, fn ($q) => $q->where('created_by', $user->id)->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered']))
            ->latest()->get()
            ->map(function (DocumentCreationDraft $draft) {
                $version = $draft->versions()->where('version_number', $draft->version_number)->first();
                $draft->setAttribute('current_submission', $version ? [
                    'version_number' => $version->version_number,
                    'content' => $version->content,
                    'submitted_at' => $version->created_at,
                ] : null);

                return $draft;
            });

        return Inertia::render('DocumentCreation/Index', [
            'drafts' => $drafts,
            'documentTypes' => $this->documentTypeOptions(),
            'approvers' => $this->approversInCurrentUserRange($user),
            'currentUserId' => $user->id,
            'approvedOnly' => $approvedOnly,
        ]);
    }

    public function store(Request $request)
    {
        $data = $this->validateDraft($request);
        $draft = DocumentCreationDraft::create([...$data, 'created_by' => $request->user()->id, 'status' => 'draft']);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Draft created']);

        return back()->with('success', 'Draft saved.');
    }

    public function update(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->id && in_array($draft->status, ['draft', 'revision_requested'], true), 403);
        $data = $this->validateDraft($request);
        $draft->update([...$data, 'status' => 'draft']);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Draft updated']);

        return back()->with('success', 'Draft updated.');
    }

    public function submit(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->created_by === (int) $request->user()->id && in_array($draft->status, ['draft', 'revision_requested'], true), 403);
        $data = $request->validate(['approver_id' => ['required', 'integer', 'exists:users,id']]);
        abort_if((int) $data['approver_id'] === (int) $request->user()->id, 422, 'Choose a different approver.');
        $approver = User::query()->with(['office.range', 'officeByCode.range'])
            ->whereKey($data['approver_id'])
            ->where('is_active', true)
            ->first();
        abort_unless($approver, 422, 'Choose an active approver.');
        $currentRange = $this->userRangeIdentity($request->user());
        abort_unless($currentRange !== null && $this->userRangeIdentity($approver) === $currentRange, 422, 'Choose an approver in your office range.');
        $number = $draft->version_number + 1;
        $draft->versions()->create(['version_number' => $number, 'content' => $draft->content, 'created_by' => $request->user()->id]);
        $draft->update(['approver_id' => $data['approver_id'], 'version_number' => $number, 'status' => 'pending_approval', 'submitted_at' => now(), 'decision_at' => null, 'decision_remarks' => null]);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Submitted for approval', 'metadata' => ['version' => $number]]);

        return back()->with('success', 'PDF version submitted for approval.');
    }

    public function decide(Request $request, DocumentCreationDraft $draft)
    {
        abort_unless((int) $draft->approver_id === (int) $request->user()->id && $draft->status === 'pending_approval', 403);
        $data = $request->validate(['decision' => ['required', 'in:approved,revision_requested,rejected'], 'version_number' => ['required', 'integer'], 'remarks' => ['nullable', 'string', 'max:4000']]);
        abort_unless((int) $data['version_number'] === (int) $draft->version_number, 409, 'This submission has changed. Refresh and review the latest version.');
        $nextStatus = $data['decision'];
        $draft->update(['status' => $nextStatus, 'decision_at' => now(), 'decision_remarks' => $data['remarks'] ?? null]);
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => ucfirst(str_replace('_', ' ', $data['decision'])), 'remarks' => $data['remarks'] ?? null, 'metadata' => ['version' => $draft->version_number]]);

        return back()->with('success', 'Approval decision recorded.');
    }

    public function register(Request $request, DocumentCreationDraft $draft)
    {
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
            $officeName = $request->user()->office?->name ?: 'DOTS';
            $prefix = trim(preg_replace('/-+/', '-', preg_replace('/\s+/', '-', trim($officeName))), '-');
            $document->update(['tracking_number' => $prefix.'-'.now()->format('y-m-d').'-'.str_pad((string) $document->id, 4, '0', STR_PAD_LEFT)]);
            $document->trails()->create(['from_office_id' => $officeId, 'created_by' => $request->user()->id, 'status' => 'pending', 'action' => 'Registered from Document Creation']);
            $draft->update(['official_document_id' => $document->id, 'status' => 'registered']);
            $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Registered in DOTS', 'metadata' => ['document_id' => $document->id]]);

            return $document;
        });

        return back()->with('success', 'Registered as '.$document->tracking_number.'.');
    }

    private function validateDraft(Request $request): array
    {
        $data = $request->validate([
            'document_type_id' => ['required', 'integer', 'exists:document_types,id'],
            'title' => ['required', 'string', 'max:255'],
            'content' => ['required', 'array'],
            'content.for' => ['nullable', 'string', 'max:255'], 'content.thru' => ['nullable', 'string', 'max:255'],
            'content.attention' => ['nullable', 'string', 'max:255'], 'content.from' => ['required', 'string', 'max:255'],
            'content.subject' => ['required', 'string', 'max:255'], 'content.date' => ['required', 'date'],
            'content.body' => ['required', 'string', 'max:50000'], 'content.cc' => ['nullable', 'array'], 'content.cc.*' => ['nullable', 'string', 'max:255'],
        ]);
        abort_unless(DocumentType::query()->whereKey($data['document_type_id'])->where('is_active', true)->exists(), 422, 'Choose an active document type.');
        $data['content']['cc'] = array_values(array_filter($data['content']['cc'] ?? []));

        return $data;
    }

    private function documentTypeOptions(): array
    {
        $options = DocumentType::query()
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (DocumentType $type) => [
                'id' => (string) $type->id,
                'name' => $type->name,
                'source' => 'New DB',
                'disabled' => ! (bool) $type->is_active,
            ]);

        return $options->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
    }

    private function canAccess(DocumentCreationDraft $draft, Request $request): bool
    {
        return in_array((int) $request->user()->id, [(int) $draft->created_by, (int) $draft->approver_id, (int) $draft->verified_by], true);
    }

    private function approversInCurrentUserRange(User $user): array
    {
        $range = $this->userRangeIdentity($user);
        if ($range === null) {
            return [];
        }

        return User::query()
            ->with(['office.range', 'officeByCode.range'])
            ->where('is_active', true)
            ->where('id', '<>', $user->id)
            ->orderBy('name')
            ->get()
            ->filter(fn (User $approver) => $this->userRangeIdentity($approver) === $range)
            ->map(fn (User $approver) => ['id' => $approver->id, 'name' => $approver->name, 'role' => $approver->role])
            ->values()
            ->all();
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

        if ($user->legacy_office_id) {
            $bureau = BureauLegacy::query()->whereKey($user->legacy_office_id)->first(['bureauId', 'range']);
            if ($bureau && ($range = $this->legacyBureauRangeIdentity($bureau))) {
                return $range;
            }
        }

        return null;
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
        if ($value === '') {
            return null;
        }

        $range = ctype_digit($value)
            ? RangeLegacy::query()->whereKey((int) $value)->first(['id'])
            : RangeLegacy::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($value)])->first(['id']);

        return $range ? ['source' => 'legacy', 'id' => (int) $range->id] : null;
    }
}
