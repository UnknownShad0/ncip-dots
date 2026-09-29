<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentLegacy;
use App\Models\DocumentTrailLegacy;
use App\Models\UserLegacy;
use App\Services\DocumentAccess;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        $access = app(DocumentAccess::class);
        $documents = $access->scope(Document::query(), $user);
        $officeId = $access->currentOfficeId($user);
        $bureauId = $access->legacyBureauId($user);
        $legacyDocuments = DocumentLegacy::query();

        $canViewAllDocuments = $access->canViewAllDocuments($user);
        if (!$canViewAllDocuments) {
            if ($bureauId) {
                $creatorIds = UserLegacy::query()->where('bureauId', $bureauId)->pluck('userUuid');
                $trackingNumbers = DocumentTrailLegacy::query()
                    ->where('originating', $bureauId)
                    ->orWhere('receiving', $bureauId)
                    ->orWhere('holder', $bureauId)
                    ->pluck('trackingNo')
                    ->merge(DocumentLegacy::query()->whereIn('createdBy', $creatorIds)->pluck('trackingNo'))
                    ->unique()
                    ->values();
                $legacyDocuments->whereIn('trackingNo', $trackingNumbers);
            } else {
                $legacyDocuments->whereRaw('1 = 0');
            }
        }

        $legacyTrackingNumbers = (clone $legacyDocuments)->pluck('trackingNo');
        $latestLegacyTrails = DocumentTrailLegacy::query()
            ->whereIn('trackingNo', $legacyTrackingNumbers)
            ->selectRaw('MAX(docTrailId)')
            ->groupBy('trackingNo');

        $incomingDocumentsCount = ($officeId || $canViewAllDocuments)
            ? Document::query()->whereHas('latestTrail', function ($trail) use ($officeId, $canViewAllDocuments) {
                $trail->whereRaw('LOWER(status) = ?', ['available']);
                if (!$canViewAllDocuments) $trail->where('to_office_id', $officeId);
            })->count()
            : 0;
        $incomingLegacyCount = ($bureauId || $canViewAllDocuments)
            ? DocumentTrailLegacy::query()
                ->whereIn('docTrailId', $latestLegacyTrails)
                ->where('status', 'AVAILABLE')
                ->when(!$canViewAllDocuments, fn ($query) => $query->where('receiving', $bureauId))
                ->distinct('trackingNo')
                ->count('trackingNo')
            : 0;

        $stats = [
            'incoming_documents' => $incomingDocumentsCount + $incomingLegacyCount,
            'pending_documents' => (($officeId || $canViewAllDocuments) ? Document::query()
                ->whereHas('latestTrail', function ($trail) use ($officeId, $canViewAllDocuments) {
                    $trail->whereRaw('LOWER(status) = ?', ['pending']);
                    if (!$canViewAllDocuments) $trail->where('to_office_id', $officeId);
                })
                ->count() : 0)
                + (($bureauId || $canViewAllDocuments) ? DocumentTrailLegacy::query()
                    ->whereIn('docTrailId', $latestLegacyTrails)
                    ->where('status', 'PENDING')
                    ->when(!$canViewAllDocuments, fn ($query) => $query->where('holder', $bureauId))
                    ->distinct('trackingNo')
                    ->count('trackingNo') : 0),
            'released_documents' => (($officeId || $canViewAllDocuments) ? Document::query()
                ->whereHas('latestTrail', function ($trail) use ($officeId, $canViewAllDocuments) {
                    $trail->whereRaw('LOWER(status) = ?', ['available']);
                    if (!$canViewAllDocuments) $trail->where('from_office_id', $officeId);
                })
                ->count() : 0)
                + (($bureauId || $canViewAllDocuments) ? DocumentTrailLegacy::query()
                    ->whereIn('docTrailId', $latestLegacyTrails)
                    ->where('status', 'AVAILABLE')
                    ->when(!$canViewAllDocuments, fn ($query) => $query->where('originating', $bureauId))
                    ->distinct('trackingNo')
                    ->count('trackingNo') : 0),
            'archived_documents' => (clone $documents)->where('is_archived', true)->count()
                + (clone $legacyDocuments)->where('Archived', 'Y')->count(),
        ];

        $recentDocuments = $access->scope(Document::query(), $user)
            ->with(['documentType', 'office', 'creator'])
            ->latest()
            ->take(5)
            ->get();

        $canReceiveDocuments = $user->canReceiveDocuments() && $officeId !== null;
        $incomingDocuments = $canReceiveDocuments
            ? Document::query()
                ->with(['latestTrail.fromOffice', 'creator', 'office'])
                ->whereHas('latestTrail', function ($trail) use ($officeId, $canViewAllDocuments) {
                    $trail->whereRaw('LOWER(status) = ?', ['available']);
                    if (!$canViewAllDocuments) $trail->where('to_office_id', $officeId);
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

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'recentDocuments' => $recentDocuments,
            'incomingDocuments' => $incomingDocuments,
            'canReceiveDocuments' => $canReceiveDocuments,
        ]);
    }
}
