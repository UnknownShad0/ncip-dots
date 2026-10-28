<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\OfficeList;
use App\Models\HrisOfficeMapping;
use App\Models\HrisOfficeSync;
use App\Models\Range;
use App\Models\User;
use App\Services\AuditTrailWriter;
use App\Services\HrisOfficeSynchronizer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class OfficeController extends Controller
{
    public function index(Request $request)
    {
        $officeListOptions = OfficeList::query()
            ->orderBy('division_name')
            ->get(['id', 'division_code', 'division_name', 'long_name', 'short_name', 'email'])
            ->map(fn (OfficeList $office) => [
                'id' => $office->id,
                'code' => $office->division_code,
                'name' => $office->long_name ?: $office->division_name,
                'division_name' => $office->division_name,
                'short_name' => $office->short_name ?? '',
                'email' => $office->email ?? '',
            ])
            ->values();
        $newOffices = Office::query()
            ->with(['parent:id,name', 'range:id,name,is_active'])
            ->select(['id', 'name', 'short_name', 'code', 'email', 'location', 'parent_id', 'range_id', 'legacy_range_id'])
            ->orderBy('name')
            ->get()
            ->map(function ($office) {
                return [
                    'id' => $office->id,
                    'name' => $office->name,
                    'short_name' => $office->short_name ?? '',
                    'code' => $office->code ?? '',
                    'email' => $office->email ?? '',
                    'location' => $office->location ?? '',
                    'parentOfficeId' => $office->parent_id,
                    'parent_name' => $office->parent?->name,
                    'range_id' => $office->range_id,
                    'range_name' => $office->range?->name,
                    'range_is_active' => $office->range?->is_active,
                    'source' => 'New DB',
                ];
            });

        $parentOffices = Office::query()
            ->whereIn('id', User::query()->where('is_active', true)->whereNotNull('office_id')->select('office_id'))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Office $office) => ['id' => (int) $office->id, 'name' => $office->name]);
        $ranges = Range::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (Range $range) => [
                'id' => (int) $range->id,
                'name' => $range->name,
                'is_active' => (bool) $range->is_active,
                'source' => 'New DB',
            ])
            ->values();

        $hrisDirectoryEntries = DB::table('office_lists')
            ->leftJoin('hris_office_mappings as mapping', 'mapping.division_code', '=', 'office_lists.division_code')
            ->leftJoin('offices as mapped_office', 'mapped_office.id', '=', 'mapping.office_id')
            ->whereNull('office_lists.deleted_at')
            ->orderBy('office_lists.division_code')
            ->get([
                'office_lists.id', 'office_lists.division_code', 'office_lists.division_name',
                'office_lists.hris_office_code', 'office_lists.hris_office_name', 'office_lists.region_code',
                'office_lists.status as directory_status', 'office_lists.last_synced_at',
                'office_lists.is_current',
                'mapping.office_id as mapped_office_id', 'mapping.match_method',
                'mapping.status as mapping_status', 'mapping.review_note',
                'mapped_office.name as mapped_office_name', 'mapped_office.code as mapped_office_code',
            ])
            ->map(fn ($entry) => [
                'id' => (int) $entry->id,
                'division_code' => $entry->division_code,
                'division_name' => $entry->division_name,
                'hris_office_code' => $entry->hris_office_code,
                'hris_office_name' => $entry->hris_office_name,
                'region_code' => $entry->region_code,
                'directory_status' => $entry->directory_status,
                'is_current' => (bool) $entry->is_current,
                'last_synced_at' => $entry->last_synced_at,
                'mapped_office_id' => $entry->mapped_office_id === null ? null : (int) $entry->mapped_office_id,
                'mapped_office_name' => $entry->mapped_office_name,
                'mapped_office_code' => $entry->mapped_office_code,
                'match_method' => $entry->match_method,
                'mapping_status' => $entry->mapping_status,
                'review_note' => $entry->review_note,
            ])
            ->values();
        $latestOfficeSync = HrisOfficeSync::query()->latest('id')->first();
        $lastSuccessfulOfficeSync = HrisOfficeSync::query()->where('status', 'succeeded')->latest('id')->first();

        return Inertia::render('Offices/Index', [
            'offices' => $newOffices,
            'parentOffices' => $parentOffices,
            'ranges' => $ranges,
            'officeListOptions' => $officeListOptions,
            'hrisDirectoryEntries' => $hrisDirectoryEntries,
            'hrisOfficeSync' => $latestOfficeSync?->only([
                'id', 'status', 'records_received', 'records_created', 'records_updated', 'error_summary', 'started_at', 'finished_at',
            ]),
            'lastSuccessfulHrisOfficeSync' => $lastSuccessfulOfficeSync?->only(['records_received', 'finished_at']),
            'hrisDirectoryCounts' => [
                'total' => $hrisDirectoryEntries->count(),
                'current' => $hrisDirectoryEntries->where('is_current', true)->count(),
                'mapped' => $hrisDirectoryEntries->whereIn('mapping_status', ['auto_confirmed', 'confirmed'])->count(),
                'pending' => $hrisDirectoryEntries->where('mapping_status', 'pending_review')->count(),
                'unmapped' => $hrisDirectoryEntries->whereNull('mapping_status')->count(),
            ],
            'canManageMappings' => $request->user()?->canManageLibraries() ?? false,
            'flash' => [
                'success' => $request->session()->get('success'),
                'warning' => $request->session()->get('warning'),
            ],
        ]);
    }

    public function syncHris(Request $request, HrisOfficeSynchronizer $synchronizer)
    {
        abort_unless($request->user()?->canManageLibraries(), 403);

        try {
            $sync = $synchronizer->sync($request->user()->id);
        } catch (\Throwable $exception) {
            report($exception);

            return redirect()->route('offices.index')->with('warning', $exception->getMessage());
        }

        return redirect()->route('offices.index')->with(
            'success',
            number_format($sync->records_received)." HRIS divisions synced; {$sync->records_created} added, {$sync->records_updated} updated.",
        );
    }

    public function updateHrisMapping(Request $request, string $divisionCode)
    {
        abort_unless($request->user()?->canManageLibraries(), 403);
        $directoryEntry = OfficeList::query()->where('division_code', $divisionCode)->firstOrFail();
        $validated = $request->validate([
            'office_id' => ['required', 'integer', 'exists:offices,id'],
            'review_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $mapping = HrisOfficeMapping::query()->updateOrCreate(
            ['division_code' => $directoryEntry->division_code],
            [
                'office_id' => (int) $validated['office_id'],
                'match_method' => 'manual',
                'status' => 'confirmed',
                'mapped_by' => $request->user()->id,
                'mapped_at' => now(),
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
                'review_note' => $validated['review_note'] ?? null,
            ],
        );

        $office = Office::query()->findOrFail($mapping->office_id);
        app(AuditTrailWriter::class)->record('library.hris_office_mapping_confirmed', $office, [
            'division_code' => $mapping->division_code,
            'office_id' => $mapping->office_id,
            'match_method' => $mapping->match_method,
            'status' => $mapping->status,
        ]);

        return redirect()->route('offices.index')->with('success', 'HRIS division mapping saved and confirmed.');
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'operation' => ['required', 'in:create'],
            'division_code' => ['required', 'string', 'exists:office_lists,division_code', Rule::unique('offices', 'code')],
            'range_id' => ['nullable', 'string'],
            'short_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('offices', 'email')],
        ], [
            'division_code.unique' => 'Office already exists.',
        ]);

        [$rangeId, $legacyRangeId] = $this->resolveRangeSelection($validated['range_id'] ?? null);

        $officeList = OfficeList::query()->where('division_code', $validated['division_code'])->firstOrFail();
        $office = Office::query()->create([
            'name' => $officeList->long_name ?: $officeList->division_name,
            'short_name' => $validated['short_name'] ?? null,
            'code' => $officeList->division_code,
            'email' => $validated['email'] ?? null,
            'location' => $officeList->office_address,
            'range_id' => $rangeId,
            'legacy_range_id' => $legacyRangeId,
        ]);
        app(AuditTrailWriter::class)->record('library.bureau_created', $office, [
            'name' => $office->name,
            'code' => $office->code,
            'range_id' => $office->range_id,
        ]);

        return redirect()->route('offices.index')->with('success', 'Office added.');
    }

    public function update(Request $request, $id)
    {
        $office = Office::query()->findOrFail($id);
        $validated = $request->validate([
            'operation' => ['required', 'in:update'],
            'division_code' => ['required', 'string', 'exists:office_lists,division_code', Rule::unique('offices', 'code')->ignore($office->id)],
            'range_id' => ['nullable', 'string'],
            'short_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('offices', 'email')->ignore($office->id)],
        ], [
            'division_code.unique' => 'Office already exists.',
        ]);

        [$rangeId, $legacyRangeId] = $this->resolveRangeSelection($validated['range_id'] ?? null);

        $officeList = OfficeList::query()->where('division_code', $validated['division_code'])->firstOrFail();
        $before = $office->only(['name', 'short_name', 'code', 'email', 'range_id']);
        $office->update([
            'name' => $officeList->long_name ?: $officeList->division_name,
            'short_name' => $validated['short_name'] ?? null,
            'code' => $officeList->division_code,
            'email' => $validated['email'] ?? null,
            'location' => $officeList->office_address,
            'range_id' => $rangeId,
            'legacy_range_id' => $legacyRangeId,
        ]);
        app(AuditTrailWriter::class)->record('library.bureau_updated', $office, [
            'before' => $before,
            'after' => $office->only(array_keys($before)),
        ]);

        return redirect()->route('offices.index')->with('success', 'Office updated.');
    }

    private function resolveRangeSelection(?string $selection): array
    {
        if ($selection === null || $selection === '') {
            return [null, null];
        }

        if (! ctype_digit($selection) || ! Range::query()->whereKey((int) $selection)->exists()) {
            throw ValidationException::withMessages(['range_id' => 'Please select a valid range.']);
        }

        return [(int) $selection, null];
    }
}
