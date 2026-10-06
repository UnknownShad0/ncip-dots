<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\BureauLegacy;
use App\Models\RangeLegacy;
use App\Models\UserLegacy;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
                    'location' => $range?->name ?? $rangeValue,
                    'parentOfficeId' => $office->parentbureauId ?? null,
                    'parent_name' => $legacyOfficeNames->get($office->parentbureauId) ?? '',
                    'range_id' => $range?->id,
                    'range_name' => $range?->name ?? $rangeValue,
                    'source' => 'Old DB',
                ];
            });

        $newOffices = Office::query()
            ->with(['parent:id,name', 'range:id,name,is_active'])
            ->select(['id', 'name', 'short_name', 'code', 'email', 'location', 'parent_id', 'range_id'])
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

        $parentOffices = BureauLegacy::query()
            ->whereIn('status', ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'Y', 'y'])
            ->orderBy('longName')
            ->get(['bureauId', 'longName'])
            ->map(fn (BureauLegacy $office) => ['id' => (int) $office->bureauId, 'name' => $office->longName]);
        $ranges = $legacyRangeRows
            ->filter(fn ($range) => in_array(strtolower((string) ($range->status ?? 'inactive')), ['1', 'active', 'enabled', 'yes', 'y'], true))
            ->map(fn ($range) => ['id' => (int) $range->id, 'name' => $range->name, 'is_active' => true])
            ->values();

        return Inertia::render('Offices/Index', [
            'offices' => [
                // ...$legacyOffices->toArray(),
                ...$newOffices->toArray(),
            ],
            'parentOffices' => $parentOffices,
            'ranges' => $ranges,
        ]);
    }

    public function store(Request $request)
    {
        $activeOfficeStatuses = ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'Y', 'y'];
        $activeRangeStatuses = ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'yes', 'Yes', 'YES', 'Y', 'y'];
        $validated = $request->validate([
            'operation' => ['required', 'in:create'],
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'code' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'parentOfficeId' => ['nullable', 'integer', Rule::exists('legacy.bureau', 'bureauId')->whereIn('status', $activeOfficeStatuses)],
            'range_id' => ['nullable', 'integer', Rule::exists('legacy.rangeregion', 'id')->whereIn('status', $activeRangeStatuses)],
        ]);

        $this->ensureNoSelfParent($request, null);
        $addedBy = UserLegacy::query()->where('emailAddress', auth()->user()?->email)->value('userUuid');
        BureauLegacy::query()->create([
            'longName' => $validated['name'],
            'shortName' => $validated['short_name'] ?? null,
            'officeCode' => $validated['code'] ?? null,
            'officeEmail' => $validated['email'] ?? null,
            'parentbureauId' => $validated['parentOfficeId'] ?? null,
            'range' => $validated['range_id'] ?? null,
            'status' => 'active',
            'dateAdded' => now(),
            'addedBy' => $addedBy,
        ]);

        return redirect()->route('offices.index')->with('success', 'Office added.');
    }

    public function update(Request $request, $id)
    {
        $office = BureauLegacy::query()->findOrFail($id);
        $existingRangeIds = RangeLegacy::query()
            ->where('id', $office->range)
            ->orWhere('name', $office->range)
            ->pluck('id')
            ->map(fn ($rangeId) => (string) $rangeId)
            ->all();
        $activeOfficeStatuses = ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'Y', 'y'];
        $activeRangeStatuses = ['1', 'active', 'Active', 'ACTIVE', 'enabled', 'Enabled', 'ENABLED', 'yes', 'Yes', 'YES', 'Y', 'y'];
        $validated = $request->validate([
            'operation' => ['required', 'in:update'],
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'code' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'parentOfficeId' => [
                'nullable', 'integer',
                Rule::exists('legacy.bureau', 'bureauId')->where(function ($query) use ($office, $request, $activeOfficeStatuses) {
                    if ((int) $request->input('parentOfficeId') === (int) $office->parentbureauId) {
                        return $query;
                    }

                    return $query->whereIn('status', $activeOfficeStatuses);
                }),
            ],
            'range_id' => [
                'nullable', 'integer',
                Rule::exists('legacy.rangeregion', 'id')->where(function ($query) use ($request, $existingRangeIds, $activeRangeStatuses) {
                    if (in_array((string) $request->input('range_id'), $existingRangeIds, true)) {
                        return $query;
                    }

                    return $query->whereIn('status', $activeRangeStatuses);
                }),
            ],
        ]);

        $this->ensureNoSelfParent($request, $office->id);
        $office->update([
            'longName' => $validated['name'],
            'shortName' => $validated['short_name'] ?? null,
            'officeCode' => $validated['code'] ?? null,
            'officeEmail' => $validated['email'] ?? null,
            'parentbureauId' => $validated['parentOfficeId'] ?? null,
            'range' => $validated['range_id'] ?? null,
        ]);

        return redirect()->route('offices.index')->with('success', 'Office updated.');
    }

    private function ensureNoSelfParent(Request $request, ?int $officeId): void
    {
        abort_if($officeId !== null && (int) $request->input('parentOfficeId') === $officeId, 422, 'An office cannot be its own parent.');
    }
}
