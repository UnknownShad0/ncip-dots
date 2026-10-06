<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\BureauLegacy;
use App\Models\Division;
use App\Models\Range;
use App\Models\RangeLegacy;
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
                    'is_active' => in_array(strtolower((string) $office->status), ['1', 'active', 'enabled', 'yes', 'y'], true),
                    'location' => $range?->name ?? $rangeValue,
                    'parentOfficeId' => $office->parentbureauId ?? null,
                    'division_code' => null,
                    'parent_name' => $legacyOfficeNames->get($office->parentbureauId) ?? '',
                    'range_id' => $range?->id,
                    'range_name' => $range?->name ?? $rangeValue,
                    'source' => 'Old DB',
                ];
            });

        $newOffices = Office::query()
            ->with(['parent:id,name', 'range:id,name,is_active'])
            ->select(['id', 'name', 'short_name', 'code', 'email', 'location', 'parent_id', 'range_id', 'division_code', 'division_name', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(function ($office) {
                return [
                    'id' => $office->id,
                    'name' => $office->name,
                    'short_name' => $office->short_name ?? '',
                    'code' => $office->code ?? '',
                    'email' => $office->email ?? '',
                    'is_active' => (bool) $office->is_active,
                    'location' => $office->location ?? '',
                    'parentOfficeId' => $office->parent_id,
                    'division_code' => $office->division_code,
                    'division_name' => $office->division_name,
                    'parent_name' => $office->parent?->name,
                    'range_id' => $office->range_id,
                    'range_name' => $office->range?->name,
                    'range_is_active' => $office->range?->is_active,
                    'source' => 'New DB',
                ];
            });

        $sqliteRanges = Range::query()
            ->orderBy('name')
            ->get(['id', 'name', 'is_active'])
            ->map(fn (Range $range) => ['value' => 'sqlite:'.$range->id, 'name' => $range->name, 'source' => 'SQLite', 'is_active' => (bool) $range->is_active]);
        $legacyRanges = $legacyRangeRows
            ->map(fn (RangeLegacy $range) => ['value' => 'legacy:'.$range->id, 'name' => $range->name, 'source' => 'Legacy', 'is_active' => in_array(strtolower((string) $range->status), ['1', 'active', 'enabled', 'yes', 'y'], true)]);
        $ranges = $sqliteRanges
            ->concat($legacyRanges)
            ->sortBy('name')
            ->values();
        $directoryDivisions = $this->officeDivisionOptions();

        return Inertia::render('Offices/Index', [
            'offices' => [
                ...$legacyOffices->toArray(),
                ...$newOffices->toArray(),
            ],
            'directoryDivisions' => $directoryDivisions,
            'ranges' => $ranges,
        ]);
    }

    private function officeDivisionOptions(): array
    {
        return Division::query()
            ->whereNotNull('code')
            ->whereNotNull('division_name')
            ->get(['code', 'division_name'])
            ->filter(fn (Division $division) => filled($division->code) && filled($division->division_name))
            ->map(fn (Division $division) => ['code' => (string) $division->code, 'name' => (string) $division->division_name])
            ->unique('code')
            ->sortBy('name')
            ->values()
            ->all();
    }

    private function directoryDivisionCodes(): array
    {
        return collect($this->officeDivisionOptions())
            ->pluck('code')
            ->filter()
            ->values()
            ->all();
    }

    private function directoryDivisionByCode(string $code): ?array
    {
        return collect($this->officeDivisionOptions())
            ->first(fn (array $office) => strcasecmp($office['code'], $code) === 0);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'operation' => ['required', 'in:create'],
            'division_code' => ['required', 'string', 'max:50', Rule::in($this->directoryDivisionCodes())],
            'email' => ['required', 'email', 'max:255'],
            'is_active' => ['required', 'boolean'],
            'range' => ['nullable', 'string', 'regex:/^(sqlite|legacy):\d+$/'],
        ]);

        $division = $this->directoryDivisionByCode($validated['division_code']);
        abort_if($division === null, 422, 'Select a valid division from the directory.');
        [$rangeId, $rangeName] = $this->resolveRange($validated['range'] ?? null);
        Office::query()->create([
            'name' => $division['name'],
            'division_name' => $division['name'],
            'short_name' => null,
            'code' => $division['code'],
            'division_code' => $division['code'],
            'email' => $validated['email'],
            'is_active' => $validated['is_active'],
            'range_id' => $rangeId,
            'location' => $rangeName,
        ]);

        return redirect()->route('offices.index')->with('success', 'Office added.');
    }

    public function update(Request $request, $id)
    {
        $office = Office::query()->findOrFail($id);
        $validated = $request->validate([
            'operation' => ['required', 'in:update'],
            'division_code' => ['required', 'string', 'max:50', Rule::in([...$this->directoryDivisionCodes(), $office->division_code ?? $office->code])],
            'email' => ['required', 'email', 'max:255'],
            'is_active' => ['required', 'boolean'],
            'range' => ['nullable', 'string', 'regex:/^(sqlite|legacy):\d+$/'],
        ]);

        $division = $this->directoryDivisionByCode($validated['division_code']);
        [$rangeId, $rangeName] = $this->resolveRange($validated['range'] ?? null);
        $office->update([
            'name' => $division['name'] ?? $office->name,
            'division_name' => $division['name'] ?? $office->division_name,
            'code' => $division['code'] ?? $office->code,
            'division_code' => $division['code'] ?? $office->division_code,
            'email' => $validated['email'],
            'is_active' => $validated['is_active'],
            'range_id' => $rangeId,
            'location' => $rangeName,
        ]);

        return redirect()->route('offices.index')->with('success', 'Office updated.');
    }

    private function resolveRange(?string $selection): array
    {
        if (! $selection) return [null, null];

        [$source, $id] = explode(':', $selection, 2);
        if ($source === 'sqlite') {
            $range = Range::query()->findOrFail((int) $id);
            return [$range->id, $range->name];
        }

        $range = RangeLegacy::query()->findOrFail((int) $id);
        return [null, $range->name];
    }
}
