<?php

namespace App\Http\Controllers;

use App\Models\ActionType;
use App\Models\ActionTypeLegacy;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ActionTypeController extends Controller
{
    public function index()
    {
        $legacyActionTypes = ActionTypeLegacy::query()
            ->select(['dtId', 'name', 'description', 'status'])
            ->orderBy('name')
            ->get()
            ->map(function ($actionType) {
                $status = strtolower((string) ($actionType->status ?? 'inactive'));

                return [
                    'id' => $actionType->dtId ?? $actionType->id ?? null,
                    'name' => $actionType->name,
                    'code' => '',
                    'description' => $actionType->description ?? '',
                    'is_active' => in_array($status, ['1', 'active', 'enabled', 'yes'], true) ? 1 : 0,
                    'source' => 'Old DB',
                ];
            });

        $newActionTypes = ActionType::query()
            ->select(['id', 'name', 'code', 'description', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(function ($actionType) {
                return [
                    'id' => $actionType->id,
                    'name' => $actionType->name,
                    'code' => $actionType->code ?? '',
                    'description' => $actionType->description ?? '',
                    'is_active' => (int) ($actionType->is_active ?? 1),
                    'source' => 'New DB',
                ];
            });

        return Inertia::render('ActionTypes/Index', [
            'actionTypes' => [
                ...$legacyActionTypes->toArray(),
                ...$newActionTypes->toArray(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        ActionType::create([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('action-types.index')->with('success', 'Action type added.');
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
        ]);

        $actionType = ActionType::findOrFail($id);

        $actionType->update([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'],
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('action-types.index')->with('success', 'Action type updated.');
    }
}
