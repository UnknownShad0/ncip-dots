<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Models\Office;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AuditTrailController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $role = Str::of((string) $user->role)->lower()->replace(['_', '-'], ' ')->squish()->toString();
        $canFilterBureaus = $user->role_id !== null
            ? in_array((int) $user->role_id, [1, 2], true)
            : in_array($role, ['system admin', 'super admin', 'executive', 'executives'], true);
        $isAdminStaff = $user->role_id !== null
            ? (int) $user->role_id === 3
            : $role === 'admin staff';
        if ($request->filled('office_id')) {
            abort_unless($canFilterBureaus, 403);
        }
        $validated = $request->validate(['office_id' => ['nullable', 'integer', 'exists:offices,id']]);
        $officeId = isset($validated['office_id']) ? (int) $validated['office_id'] : null;

        if ($isAdminStaff) {
            $officeId = $user->office_id ? (int) $user->office_id : null;
        }

        $trail = AuditTrail::with(['user:id,name,firstname,lastname'])
            ->when($isAdminStaff && $officeId === null, fn ($query) => $query->whereRaw('1 = 0'))
            ->when($officeId !== null, fn ($query) => $query->where(function ($bureauQuery) use ($officeId) {
                $bureauQuery->where('actor_office_id', $officeId)
                    ->orWhere(fn ($legacyQuery) => $legacyQuery
                        ->where('record_source', 'legacy_import')
                        ->whereNull('actor_office_id')
                        ->whereHas('user', fn ($actorQuery) => $actorQuery->where('office_id', $officeId)));
            }))
            ->select(['id', 'user_id', 'actor_name', 'actor_office_id', 'actor_office_name', 'action', 'details', 'result', 'created_at', 'legacy_module', 'record_source'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50)
            ->withQueryString()
            ->through(function (AuditTrail $entry) {
                $entry->setAttribute(
                    'bureau_filter_uses_current_assignment',
                    $entry->record_source === 'legacy_import' && $entry->actor_office_id === null && $entry->user !== null,
                );
                if ($entry->user) {
                    $entry->user->setAttribute('short_name', trim(
                        (filled($entry->user->firstname) ? mb_substr(trim($entry->user->firstname), 0, 1).'. ' : '').
                        ($entry->user->lastname ?? '')
                    ) ?: $entry->user->name);
                }

                return $entry;
            });

        return Inertia::render('AuditTrail/Index', [
            'trail' => $trail->items(),
            'canFilterBureaus' => $canFilterBureaus,
            'bureaus' => $canFilterBureaus ? Office::orderBy('name')->orderBy('id')->get(['id', 'name']) : [],
            'filters' => ['office_id' => $officeId],
            'scopeNotice' => $isAdminStaff
                ? ($officeId ? 'Showing activity recorded under your bureau at the time of each action.' : 'Your account has no assigned bureau. Contact an administrator to assign one before viewing audit activity.')
                : null,
            'pagination' => [
                'current_page' => $trail->currentPage(), 'last_page' => $trail->lastPage(),
                'total' => $trail->total(), 'from' => $trail->firstItem(), 'to' => $trail->lastItem(),
                'prev_page_url' => $trail->previousPageUrl(), 'next_page_url' => $trail->nextPageUrl(),
            ],
        ]);
    }
}
