<?php

namespace App\Http\Controllers;

use App\Services\AuditTrailWriter;
use App\Services\NavigationAccess;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class NavigationAccessController extends Controller
{
    public function index(NavigationAccess $navigationAccess): InertiaResponse
    {
        return Inertia::render('NavigationAccess/Index', [
            'groups' => $navigationAccess->groups(),
            'roles' => $navigationAccess->managedRoles(),
        ]);
    }

    public function update(Request $request, NavigationAccess $navigationAccess): RedirectResponse
    {
        $keys = $navigationAccess->navigationKeys();
        $allowedKeys = implode(',', $keys);
        $rules = [
            'visibility' => ['required', 'array:2,3'],
        ];

        foreach ([2, 3] as $roleId) {
            $rules["visibility.{$roleId}"] = ['required', 'array:'.$allowedKeys];
            foreach ($keys as $key) {
                $rules["visibility.{$roleId}.{$key}"] = ['required', 'boolean'];
            }
        }

        $validated = $request->validate($rules);
        $changes = [];
        $timestamp = now();

        DB::transaction(function () use ($validated, $keys, $timestamp, $navigationAccess, &$changes): void {
            foreach ([2 => 'Executive', 3 => 'Admin Staff'] as $roleId => $roleName) {
                $before = $navigationAccess->visibilityForRole($roleId);
                $after = [];
                $records = [];

                foreach ($keys as $key) {
                    $isVisible = (bool) $validated['visibility'][$roleId][$key];
                    $after[$key] = $isVisible;
                    $records[] = [
                        'role_id' => $roleId,
                        'navigation_key' => $key,
                        'is_visible' => $isVisible,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ];
                }

                DB::table('role_navigation_visibility')->upsert(
                    $records,
                    ['role_id', 'navigation_key'],
                    ['is_visible', 'updated_at'],
                );

                $roleChanges = [];
                foreach ($after as $key => $isVisible) {
                    if ($before[$key] !== $isVisible) {
                        $roleChanges[$key] = [
                            'before' => $before[$key],
                            'after' => $isVisible,
                        ];
                    }
                }

                if ($roleChanges) {
                    $changes[$roleName] = $roleChanges;
                }
            }
        });

        if ($changes) {
            app(AuditTrailWriter::class)->record('navigation_access.updated', details: [
                'roles' => $changes,
            ]);
        }

        return redirect()->route('navigation-access.index')->with('success', 'Navigation access settings saved.');
    }
}
