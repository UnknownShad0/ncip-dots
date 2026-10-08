<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Office;
use App\Models\OfficeList;
use App\Models\Range;
use App\Models\RangeLegacy;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class OfficeController extends Controller
{
    public function index()
    {
        $legacyRangeRows = RangeLegacy::query()->orderBy('name')->get(['id', 'name', 'status']);
        $rangesById = $legacyRangeRows->keyBy('id');
        $rangesByName = $legacyRangeRows->keyBy(fn ($range) => mb_strtolower(trim((string) $range->name)));
        $legacyOfficeNames = BureauLegacy::query()->pluck('longName', 'bureauId');
        $legacyOffices = BureauLegacy::query()
            ->select([
                'bureauId',
                'parentbureauId',
                'officeCode',
                'officeEmail',
                'longName',
                'shortName',
                'status',
                'range',
                'dateAdded',
                'addedBy',
            ])
            ->orderBy('longName')
            ->get()
            ->map(function ($office) use ($rangesById, $rangesByName, $legacyOfficeNames) {
                $rangeValue = trim((string) ($office->range ?? ''));
                $range = ctype_digit($rangeValue)
                    ? $rangesById->get((int) $rangeValue)
                    : $rangesByName->get(mb_strtolower($rangeValue));

                return [
                    'id' => $office->bureauId,
                    'name' => $office->longName ?? '',
                    'short_name' => $office->shortName ?? '',
                    'code' => $office->officeCode ?? '',
                    'email' => $office->officeEmail ?? '',
                    'location' => $range?->name ?? '',
                    'parentOfficeId' => $office->parentbureauId ?? null,
                    'parent_name' => $legacyOfficeNames->get($office->parentbureauId) ?? '',
                    'range_id' => $range?->id,
                    'range_name' => $range?->name ?? $rangeValue,
                    'source' => 'Old DB',
                ];
            });    

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
            ->map(function ($office) use ($rangesById) {
                $legacyRange = $office->legacy_range_id ? $rangesById->get((int) $office->legacy_range_id) : null;
                return [
                    'id' => $office->id,
                    'name' => $office->name,
                    'short_name' => $office->short_name ?? '',
                    'code' => $office->code ?? '',
                    'email' => $office->email ?? '',
                    'location' => $office->location ?? '',
                    'parentOfficeId' => $office->parent_id,
                    'parent_name' => $office->parent?->name,
                    'range_id' => $legacyRange ? 'legacy-'.$legacyRange->id : $office->range_id,
                    'range_name' => $legacyRange?->name ?? $office->range?->name,
                    'range_is_active' => $office->range?->is_active,
                    'source' => 'New DB',
                ];
            });

        $parentOffices = BureauLegacy::query()
            ->whereIn('status', ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'Y', 'y'])
            ->orderBy('longName')
            ->get(['bureauId', 'longName'])
            ->map(fn (BureauLegacy $office) => ['id' => (int) $office->bureauId, 'name' => $office->longName]);
        $legacyRangeOptions = $legacyRangeRows
            ->filter(fn ($range) => in_array(strtolower((string) ($range->status ?? 'inactive')), ['1', 'active', 'enabled', 'yes', 'y'], true))
            ->map(fn ($range) => [
                'id' => 'legacy-'.$range->id,
                'name' => $range->name,
                'is_active' => true,
                'source' => 'Old DB',
            ]);
        $newRangeOptions = Range::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (Range $range) => [
                'id' => (int) $range->id,
                'name' => $range->name,
                'is_active' => (bool) $range->is_active,
                'source' => 'New DB',
            ]);
        $ranges = $legacyRangeOptions
            ->concat($newRangeOptions)
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();

        return Inertia::render('Offices/Index', [
            'offices' => [
                // ...$legacyOffices->toArray(),
                ...$newOffices->toArray(),
            ],
            'parentOffices' => $parentOffices,
            'ranges' => $ranges,
            'officeListOptions' => $officeListOptions,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'operation' => ['required', 'in:create'],
            'division_code' => ['required', 'string', 'exists:office_lists,division_code', Rule::unique('offices', 'code')],
            'range_id' => ['nullable', 'string'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('offices', 'email')],
        ], [
            'division_code.unique' => 'Office already exists.',
        ]);

        [$rangeId, $legacyRangeId] = $this->resolveRangeSelection($validated['range_id'] ?? null);

        $officeList = OfficeList::query()->where('division_code', $validated['division_code'])->firstOrFail();
        Office::query()->create([
            'name' => $officeList->long_name ?: $officeList->division_name,
            'short_name' => $officeList->short_name,
            'code' => $officeList->division_code,
            'email' => $validated['email'] ?? null,
            'location' => $officeList->office_address,
            'range_id' => $rangeId,
            'legacy_range_id' => $legacyRangeId,
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
            'email' => ['nullable', 'email', 'max:255', Rule::unique('offices', 'email')->ignore($office->id)],
        ], [
            'division_code.unique' => 'Office already exists.',
        ]);

        [$rangeId, $legacyRangeId] = $this->resolveRangeSelection($validated['range_id'] ?? null);

        $officeList = OfficeList::query()->where('division_code', $validated['division_code'])->firstOrFail();
        $office->update([
            'name' => $officeList->long_name ?: $officeList->division_name,
            'short_name' => $officeList->short_name,
            'code' => $officeList->division_code,
            'email' => $validated['email'] ?? null,
            'location' => $officeList->office_address,
            'range_id' => $rangeId,
            'legacy_range_id' => $legacyRangeId,
        ]);

        return redirect()->route('offices.index')->with('success', 'Office updated.');
    }

    private function resolveRangeSelection(?string $selection): array
    {
        if ($selection === null || $selection === '') {
            return [null, null];
        }

        if (preg_match('/^legacy-(\d+)$/', $selection, $matches)) {
            $legacyRangeId = (int) $matches[1];
            $isActive = RangeLegacy::query()
                ->whereKey($legacyRangeId)
                ->whereIn('status', ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'yes', 'Yes', 'y', 'Y'])
                ->exists();

            if (! $isActive) {
                throw ValidationException::withMessages(['range_id' => 'Please select a valid active range.']);
            }

            return [null, $legacyRangeId];
        }

        if (! ctype_digit($selection) || ! Range::query()->whereKey((int) $selection)->exists()) {
            throw ValidationException::withMessages(['range_id' => 'Please select a valid range.']);
        }

        return [(int) $selection, null];
    }

}
