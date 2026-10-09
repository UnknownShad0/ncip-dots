<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\RangeLegacy;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DocumentCreationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $userOffice = $this->userOffice($user);
        $canReviewOfficeApprovals = $user->is_active && $user->isAdministrator() && $userOffice !== null;
        $approvedOnly = $request->query('queue') === 'approved';
        $draftQuery = DocumentCreationDraft::query()->with([
            'creator:id,name,firstname,lastname',
            'approver:id,name,firstname,lastname',
            'approverOffice:id,name,short_name',
            'decisionMaker:id,name,firstname,lastname',
            'documentType:id,name',
            'events.user:id,name,firstname,lastname,office_id,office_code,legacy_office_id',
            'events.user.office:id,name,short_name',
            'events.user.officeByCode:id,name,short_name',
        ])->where(function ($query) use ($user, $userOffice, $canReviewOfficeApprovals) {
            $query->where('created_by', $user->id)
                ->orWhere('approver_id', $user->id)
                ->orWhere('verified_by', $user->id);
            if ($canReviewOfficeApprovals) {
                $query->orWhere('approver_office_id', $userOffice->id);
            }
        });

        $drafts = $draftQuery
            ->when($request->query('queue') === 'approval', function ($query) use ($user, $userOffice, $canReviewOfficeApprovals) {
                $query->where('status', 'pending_approval')
                    ->where(function ($approvalQuery) use ($user, $userOffice, $canReviewOfficeApprovals) {
                        $approvalQuery->where('approver_id', $user->id);
                        if ($canReviewOfficeApprovals) {
                            $approvalQuery->orWhere('approver_office_id', $userOffice->id);
                        }
                    });
            })
            ->when($request->query('queue') === 'submitted', fn ($q) => $q->where('created_by', $user->id)->where('status', 'pending_approval'))
            ->when($request->query('queue') === 'revision', fn ($q) => $q->where('created_by', $user->id)->where('status', 'revision_requested'))
            ->when($approvedOnly, fn ($q) => $q->where('created_by', $user->id)->whereIn('status', ['approved', 'awaiting_verification', 'verified', 'registered']))
            ->latest()->get()
            ->map(function (DocumentCreationDraft $draft) use ($user, $userOffice, $canReviewOfficeApprovals) {
                $version = $draft->versions()->where('version_number', $draft->version_number)->first();
                $draft->setAttribute('current_submission', $version ? [
                    'version_number' => $version->version_number,
                    'content' => $version->content,
                    'submitted_at' => $version->created_at,
                ] : null);
                $draft->setAttribute('can_decide', (int) $draft->created_by !== (int) $user->id
                    && ((int) $draft->approver_id === (int) $user->id
                        || ($canReviewOfficeApprovals && (int) $draft->approver_office_id === (int) $userOffice->id)));
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

        return Inertia::render('DocumentCreation/Index', [
            'drafts' => $drafts,
            'documentTypes' => $this->documentTypeOptions(),
            'approverOffices' => $this->approverOffices()
                ->map(fn (Office $office) => ['id' => $office->id, 'name' => $office->name, 'short_name' => $office->short_name])
                ->all(),
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
        $data = $request->validate(['approver_office_id' => ['required', 'integer', 'exists:offices,id']]);
        $approverOffice = $this->approverOffices()->first(fn (Office $office) => (int) $office->id === (int) $data['approver_office_id']);
        abort_unless($approverOffice, 422, 'Choose an office with an active admin.');
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
        $draft->events()->create(['user_id' => $request->user()->id, 'event' => 'Submitted for approval', 'metadata' => ['version' => $number]]);

        return back()->with('success', 'PDF version submitted for approval.');
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
            $office = $request->user()->office;
            $officeName = trim((string) $office?->short_name) ?: ($office?->name ?: 'DOTS');
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

        if (! $user->legacy_office_id) {
            return null;
        }

        $bureau = BureauLegacy::query()->whereKey($user->legacy_office_id)->first(['officeCode', 'longName']);
        if (! $bureau) {
            return null;
        }

        $officeQuery = Office::query();
        if (filled($bureau->officeCode)) {
            $officeQuery->where('code', $bureau->officeCode);
        }
        if (filled($bureau->longName)) {
            if (filled($bureau->officeCode)) {
                $officeQuery->orWhere('name', $bureau->longName);
            } else {
                $officeQuery->where('name', $bureau->longName);
            }
        }

        return $officeQuery->first();
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
