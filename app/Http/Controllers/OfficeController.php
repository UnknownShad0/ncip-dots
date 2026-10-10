<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\OfficeList;
use App\Models\Range;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class OfficeController extends Controller
{
    public function index()
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

        return Inertia::render('Offices/Index', [
            'offices' => $newOffices,
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
            'short_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('offices', 'email')],
        ], [
            'division_code.unique' => 'Office already exists.',
        ]);

        [$rangeId, $legacyRangeId] = $this->resolveRangeSelection($validated['range_id'] ?? null);

        $officeList = OfficeList::query()->where('division_code', $validated['division_code'])->firstOrFail();
        Office::query()->create([
            'name' => $officeList->long_name ?: $officeList->division_name,
            'short_name' => $validated['short_name'] ?? null,
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
            'short_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('offices', 'email')->ignore($office->id)],
        ], [
            'division_code.unique' => 'Office already exists.',
        ]);

        [$rangeId, $legacyRangeId] = $this->resolveRangeSelection($validated['range_id'] ?? null);

        $officeList = OfficeList::query()->where('division_code', $validated['division_code'])->firstOrFail();
        $office->update([
            'name' => $officeList->long_name ?: $officeList->division_name,
            'short_name' => $validated['short_name'] ?? null,
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

        if (! ctype_digit($selection) || ! Range::query()->whereKey((int) $selection)->exists()) {
            throw ValidationException::withMessages(['range_id' => 'Please select a valid range.']);
        }

        return [(int) $selection, null];
    }

}
