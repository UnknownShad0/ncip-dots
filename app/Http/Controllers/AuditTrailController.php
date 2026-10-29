<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Models\Office;
use App\Models\User;
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

        $trailQuery = AuditTrail::with(['user:id,name,firstname,lastname'])
            ->when($isAdminStaff && $officeId === null, fn ($query) => $query->whereRaw('1 = 0'));
        if ($officeId !== null) {
            // Keep each branch independently indexable. An OR between the
            // saved-office and legacy-assignment paths made the large history
            // query scan/sort far more rows than the 15 rows being displayed.
            $officeHistoryIds = AuditTrail::query()
                ->select('id')
                ->where('actor_office_id', $officeId);
            $legacyHistoryIds = AuditTrail::query()
                ->select('id')
                ->where('record_source', 'legacy_import')
                ->whereNull('actor_office_id')
                ->whereIn('user_id', User::query()->select('id')->where('office_id', $officeId));
            $officeHistoryIds->unionAll($legacyHistoryIds);
            // Joining the union materializes the two office-history branches.
            // A WHERE IN subquery made MySQL reevaluate the union while walking
            // the full audit chronology index on large imported histories.
            $trailQuery->joinSub($officeHistoryIds, 'office_history_ids', 'office_history_ids.id', '=', 'audit_trails.id');
        }

        $trailQuery
            ->select(['audit_trails.id', 'audit_trails.user_id', 'audit_trails.actor_name', 'audit_trails.actor_office_id', 'audit_trails.actor_office_name', 'audit_trails.action', 'audit_trails.details', 'audit_trails.result', 'audit_trails.created_at', 'audit_trails.legacy_module', 'audit_trails.record_source'])
            ->orderByDesc('audit_trails.created_at')
            ->orderByDesc('audit_trails.id');
        // Office history can span hundreds of thousands of imported entries.
        // simplePaginate avoids a full filtered COUNT(*) just to show 15 rows.
        $trail = ($isAdminStaff ? $trailQuery->simplePaginate(15) : $trailQuery->paginate(15))
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
                'current_page' => $trail->currentPage(),
                'last_page' => method_exists($trail, 'lastPage') ? $trail->lastPage() : null,
                'total' => method_exists($trail, 'total') ? $trail->total() : null,
                'from' => $trail->firstItem(), 'to' => $trail->lastItem(),
                'prev_page_url' => $trail->previousPageUrl(), 'next_page_url' => $trail->nextPageUrl(),
            ],
        ]);
    }
}
