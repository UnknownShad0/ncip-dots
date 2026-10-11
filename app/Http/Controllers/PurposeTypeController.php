<?php

namespace App\Http\Controllers;

use App\Models\PurposeType;
use App\Services\AuditTrailWriter;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PurposeTypeController extends Controller
{
    public function purposeTypes()
    {
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
            'purposeTypes' => $newPurposeTypes->toArray(),
        ]);
    }

    public function storePurposeType(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $purposeType = PurposeType::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => auth()->id(),
        ]);
        app(AuditTrailWriter::class)->record('library.purpose_created', $purposeType, $purposeType->only(['name', 'description', 'is_active']));

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
        $before = $purposeType->only(['name', 'description', 'is_active']);

        $purposeType->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'],
            'updated_by' => auth()->id(),
        ]);
        app(AuditTrailWriter::class)->record('library.purpose_updated', $purposeType, [
            'before' => $before,
            'after' => $purposeType->only(array_keys($before)),
        ]);

        return redirect()->route('purpose-types.index')->with('success', 'Purpose type updated.');
    }
}
