<?php

namespace App\Http\Controllers;

use App\Models\Bureau;
use App\Models\BureauLegacy;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OfficeController extends Controller
{
    public function index()
    {
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
            ->map(function ($office) {
                return [
                    'id' => $office->bureauId,
                    'name' => $office->longName ?? '',
                    'short_name' => $office->shortName ?? '',
                    'code' => $office->officeCode ?? '',
                    'email' => $office->officeEmail ?? '',
                    'location' => $office->range ?? '',
                    'parent_id' => $office->parentbureauId ?? null,
                    'source' => 'Old DB',
                ];
            });

        $newOffices = Bureau::query()
            ->select(['id', 'name', 'short_name', 'code', 'email', 'location', 'parent_id'])
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
                    'parent_id' => $office->parent_id,
                    'source' => 'New DB',
                ];
            });

        return Inertia::render('Offices/Index', [
            'offices' => [
                ...$legacyOffices->toArray(),
                ...$newOffices->toArray(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'code' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
        ]);

        Bureau::create($validated);

        return redirect()->route('offices.index')->with('success', 'Office added.');
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'short_name' => ['nullable', 'string', 'max:50'],
            'code' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
        ]);

        $office = Bureau::findOrFail($id);
        $office->update($validated);

        return redirect()->route('offices.index')->with('success', 'Office updated.');
    }
}
