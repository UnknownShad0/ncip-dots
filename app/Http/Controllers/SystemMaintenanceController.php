<?php

namespace App\Http\Controllers;

use App\Services\AuditTrailWriter;
use App\Services\NavigationAccess;
use App\Services\SystemMaintenance;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class SystemMaintenanceController extends Controller
{
    public function index(SystemMaintenance $maintenance): InertiaResponse
    {
        return Inertia::render('SystemMaintenance/Index', [
            'settings' => $maintenance->forManagement(),
            'timezone' => config('app.timezone'),
        ]);
    }

    public function update(Request $request, SystemMaintenance $maintenance): RedirectResponse
    {
        $validator = Validator::make($request->all(), [
            'mode' => ['required', 'in:off,notice,full'],
            'message' => ['required', 'string', 'max:1000'],
            'starts_at' => ['nullable', 'date_format:Y-m-d\\TH:i'],
            'ends_at' => ['nullable', 'date_format:Y-m-d\\TH:i'],
            'reason' => ['nullable', 'string', 'max:300'],
        ]);

        $validator->after(function ($validator) use ($request, $maintenance): void {
            $start = $request->input('starts_at');
            $end = $request->input('ends_at');

            if (
                $start
                && $end
                && ! $validator->errors()->has('starts_at')
                && ! $validator->errors()->has('ends_at')
                && $maintenance->toStorageTime($end)->lte($maintenance->toStorageTime($start))
            ) {
                $validator->errors()->add('ends_at', 'The end time must be later than the start time.');
            }
        });

        $validated = $validator->validate();
        $reason = trim((string) ($validated['reason'] ?? ''));

        DB::transaction(function () use ($validated, $reason, $maintenance): void {
            $setting = $maintenance->settings();
            $before = $maintenance->snapshot($setting);

            $setting->fill([
                'mode' => $validated['mode'],
                'message' => trim($validated['message']),
                'starts_at' => $maintenance->toStorageTime($validated['starts_at'] ?? null),
                'ends_at' => $maintenance->toStorageTime($validated['ends_at'] ?? null),
                'updated_by' => auth()->id(),
            ]);

            $after = $maintenance->snapshot($setting);
            if ($before === $after) {
                return;
            }

            $setting->save();

            app(AuditTrailWriter::class)->record(
                'system_maintenance.updated',
                subject: $setting,
                details: [
                    'before' => $before,
                    'after' => $maintenance->snapshot($setting),
                    'reason' => $reason !== '' ? $reason : null,
                ],
            );
        });

        return redirect()->route('system-maintenance.index')->with('success', 'System maintenance settings saved.');
    }

    public function show(Request $request, SystemMaintenance $maintenance, NavigationAccess $navigationAccess): SymfonyResponse
    {
        $setting = $maintenance->current();
        $mode = $maintenance->activeMode($setting);
        $user = $request->user();

        if (! $user->isSuperAdmin() && $mode !== 'full') {
            return redirect()->route($navigationAccess->firstVisibleRoute($user));
        }

        $response = Inertia::render('SystemMaintenance/Show', [
            'mode' => $mode,
            'message' => $setting?->message ?: SystemMaintenance::DEFAULT_MESSAGE,
            'endsAt' => $setting?->ends_at?->copy()->timezone(config('app.timezone'))->format('M j, Y g:i A T'),
            'canManageSystemMaintenance' => $user->isSuperAdmin(),
        ])->toResponse($request);

        // Inertia navigation needs a successful page response to render the maintenance screen.
        // A direct browser request still receives the conventional 503 status.
        return $response->setStatusCode($request->headers->has('X-Inertia') ? 200 : 503);
    }
}
