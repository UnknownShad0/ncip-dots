<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentLegacy;
use App\Models\DocumentTrailLegacy;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $latestLegacyTrails = DocumentTrailLegacy::query()
            ->selectRaw('MAX(docTrailId)')
            ->groupBy('trackingNo');

        $stats = [
            'total_documents' => Document::count() + DocumentLegacy::count(),
            'pending_documents' => Document::where('status', 'pending')->count()
                + DocumentTrailLegacy::query()
                    ->whereIn('docTrailId', $latestLegacyTrails)
                    ->where('status', 'PENDING')
                    ->distinct('trackingNo')
                    ->count('trackingNo'),
            'released_today' => Document::where('status', 'processed')
                ->whereDate('updated_at', today())
                ->count()
                + DocumentTrailLegacy::query()
                    ->whereDate('dateCreated', today())
                    ->where('status', 'AVAILABLE')
                    ->distinct('trackingNo')
                    ->count('trackingNo'),
            'archived_documents' => Document::where('is_archived', true)->count()
                + DocumentLegacy::where('Archived', 'Y')->count(),
        ];

        $recentDocuments = Document::with(['documentType', 'office', 'creator'])
            ->latest()
            ->take(5)
            ->get();

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'recentDocuments' => $recentDocuments,
        ]);
    }
}
