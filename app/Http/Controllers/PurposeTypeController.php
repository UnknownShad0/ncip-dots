<?php

namespace App\Http\Controllers;

use App\Models\PurposeType;
use App\Models\PurposeTypeLegacy;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurposeTypeController extends Controller
{
    public function purposeTypes()
    {
        $legacyPurposeTypes = PurposeTypeLegacy::query()
            ->select([
                'name',
                'description',
                'status',
            ])
            ->orderBy('name')
            ->get()
            ->map(function ($item) {
                $status = strtolower((string) ($item->status ?? 'inactive'));

                return [
                    'id' => $item->purpose_type_id ?? $item->dtId ?? null,
                    'name' => $item->name,
                    'description' => $item->description ?? '',
                    'is_active' => in_array($status, ['1', 'active', 'enabled', 'yes'], true) ? 1 : 0,
                    'source' => 'Old DB',
                ];
            });

        $newPurposeTypes = PurposeType::query()
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

        return Inertia::render('PurposeTypes/Index', [
            'purposeTypes' => [
                ...$legacyPurposeTypes->toArray(),
                ...$newPurposeTypes->toArray(),
            ],
        ]);
    }

    public function storePurposeType(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        PurposeType::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('purpose-types.index')->with('success', 'Purpose type added.');
    }

    public function updatePurposeType(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
        ]);

        $purposeType = PurposeType::findOrFail($id);

        $purposeType->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'],
            'updated_by' => auth()->id(),
        ]);

        return redirect()->route('purpose-types.index')->with('success', 'Purpose type updated.');
    }
}
