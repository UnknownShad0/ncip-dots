<?php

namespace App\Http\Controllers;

use App\Models\Range;
use App\Models\RangeLegacy;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RangeController extends Controller
{
    public function index()
    {
        $legacyRanges = RangeLegacy::query()
            ->select(['id', 'name', 'status'])
            ->orderBy('name')
            ->get()
            ->map(function ($item) {
                $status = strtolower((string) ($item->status ?? 'inactive'));

                return [
                    'id' => $item->id ?? $item->range_id ?? null,
                    'name' => $item->name,
                    'description' => '',
                    'is_active' => in_array($status, ['1', 'active', 'enabled', 'yes'], true) ? 1 : 0,
                    'source' => 'Old DB',
                ];
            });

        $newRanges = Range::query()
            ->select(['id', 'name', 'description', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(function ($item) {
                return [
                    'id' => $item->id,
                    'name' => $item->name,
                    'description' => $item->description ?? '',
                    'is_active' => (int) $item->is_active,
                    'source' => 'New DB',
                ];
            });

        return Inertia::render('Ranges/Index', [
            'ranges' => [
                ...$legacyRanges->toArray(),
                ...$newRanges->toArray(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        Range::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('ranges.index')->with('success', 'Range added.');
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
        ]);

        $range = Range::findOrFail($id);

        $range->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'],
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('ranges.index')->with('success', 'Range updated.');
    }
}
