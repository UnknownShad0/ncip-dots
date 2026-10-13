<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Office;
use App\Models\DocumentCreationDraft;
use App\Services\DocumentAccess;
use App\Services\DashboardCharts;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        $access = app(DocumentAccess::class);
        $officeId = $access->currentOfficeId($user);
        $canViewAllDocuments = $access->canViewAllDocuments($user);
        $approvalOffice = $user->office ?: ($user->office_code ? $user->officeByCode : null);
        $canReviewOfficeApprovals = $user->is_active && $user->isAdministrator() && $approvalOffice !== null;

        $recentDocuments = $access->scope(Document::query(), $user)
            ->with(['documentType', 'office', 'creator'])
            ->latest()
            ->take(5)
            ->get();

        $canReceiveDocuments = $user->canReceiveDocuments() && $officeId !== null;
        $incomingDocuments = $officeId !== null
            ? Document::query()
                ->with(['latestTrail.fromOffice', 'creator', 'office'])
                ->where('is_archived', false)->where('legacy_needs_review', false)
                ->whereHas('latestTrail', function ($trail) use ($officeId) {
                    $trail->where('status', 'available');
                    $trail->where('to_office_id', $officeId);
                })
                ->latest('updated_at')
                ->get(['id', 'tracking_number', 'title', 'created_by'])
                ->map(fn (Document $document) => [
                    'id' => $document->id,
                    'tracking_number' => $document->tracking_number,
                    'title' => $document->title,
                    'from_office' => $document->latestTrail?->fromOffice?->name ?? $document->office?->name,
                    'creator_name' => $document->creator?->name,
                ])
                ->values()
            : collect();

        $role = str($user->role)->lower()->replace(['_', '-'], ' ')->squish()->toString();
        $canFilterCharts = $user->role_id !== null
            ? in_array((int) $user->role_id, [1, 2], true)
            : in_array($role, ['system admin', 'super admin', 'executive', 'executives'], true);
        $selectedChartOfficeId = null;
        if (request()->filled('chart_office_id')) {
            abort_unless($canFilterCharts, 403);
            $validated = request()->validate(['chart_office_id' => ['integer', 'exists:offices,id']]);
            $selectedChartOfficeId = (int) $validated['chart_office_id'];
        }
        $dashboardCharts = app(DashboardCharts::class);
        // Keep the summary cards in the first response. The full-history chart
        // calculations run as deferred props so they do not hold up the page.
        if ($canViewAllDocuments) {
            $summaryStats = $dashboardCharts->statsForOffice(null, allOffices: true);
        } elseif ($officeId !== null) {
            $summaryStats = $dashboardCharts->statsForOffice($officeId);
        } else {
            $summaryStats = [
                'incoming_documents' => 0,
                'pending_documents' => 0,
                'released_documents' => 0,
                'archived_documents' => $access->scope(Document::query(), $user)->where('is_archived', true)->count(),
            ];
        }
        $approvalCountQuery = DocumentCreationDraft::query()->where('status', 'pending_approval')
            ->where(function ($query) use ($user, $approvalOffice, $canReviewOfficeApprovals) {
                $query->where('approver_id', $user->id);
                if ($canReviewOfficeApprovals) {
                    $query->orWhere('approver_office_id', $approvalOffice->id);
                }
            });

        $stats = array_merge([
            'awaiting_my_approval' => $approvalCountQuery->count(),
            'my_submissions_awaiting_approval' => DocumentCreationDraft::query()->where('created_by', $user->id)->where('status', 'pending_approval')->count(),
            'returned_for_revision' => DocumentCreationDraft::query()->where('created_by', $user->id)->where('status', 'revision_requested')->count(),
            'awaiting_verification' => DocumentCreationDraft::query()->where('created_by', $user->id)->where('status', 'awaiting_verification')->count(),
        ], $summaryStats);

        $analyticsOfficeId = $canFilterCharts ? $selectedChartOfficeId : $officeId;
        $analyticsAllOffices = $canFilterCharts && $selectedChartOfficeId === null;
        $chartStatsMatchSummary = $canViewAllDocuments
            ? ($canFilterCharts && $selectedChartOfficeId === null)
            : (! $canFilterCharts && $officeId !== null);

        return Inertia::render('Dashboard', [
            'analytics' => Inertia::defer(function () use ($dashboardCharts, $analyticsOfficeId, $analyticsAllOffices, $chartStatsMatchSummary, $summaryStats) {
                return [
                    'documentTypeCounts' => $dashboardCharts->documentTypesForOffice($analyticsOfficeId, allOffices: $analyticsAllOffices),
                    'chartStats' => $chartStatsMatchSummary
                        ? $summaryStats
                        : $dashboardCharts->statsForOffice($analyticsOfficeId, allOffices: $analyticsAllOffices),
                    'processingPerformance' => app(\App\Services\ProcessingPerformance::class)->forOffice(
                        $analyticsOfficeId,
                        allOffices: $analyticsAllOffices,
                    ),
                ];
            }),
            'stats' => $stats,
            'canFilterCharts' => $canFilterCharts,
            'selectedChartOfficeId' => $selectedChartOfficeId,
            'chartOffices' => $canFilterCharts ? Office::query()->with('range:id,name')->orderBy('name')->get(['id', 'name', 'range_id'])->map(fn (Office $office) => [
                'id' => $office->id, 'name' => $office->name, 'range_name' => $office->range?->name,
            ]) : [],
            'recentDocuments' => $recentDocuments,
            'incomingDocuments' => $incomingDocuments,
            'canReceiveDocuments' => $canReceiveDocuments,
        ]);
    }
}
