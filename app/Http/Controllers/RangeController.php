<?php

namespace App\Http\Controllers;

use App\Models\Range;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RangeController extends Controller
{
    public function index()
    {
        $ranges = Range::query()
            ->select(['id', 'name', 'description', 'is_active'])
            ->orderBy('name')
            ->get();

        return Inertia::render('Ranges/Index', [
            'ranges' => $ranges,
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
