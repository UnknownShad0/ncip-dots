<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
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

        $canViewAllDocuments = $access->canViewAllDocuments($user);

        $incomingDocumentsCount = ($officeId || $canViewAllDocuments)
            ? Document::query()->where('is_archived', false)->where('legacy_needs_review', false)->whereHas('latestTrail', function ($trail) use ($officeId, $canViewAllDocuments) {
                $trail->whereRaw('LOWER(status) = ?', ['available']);
                if (!$canViewAllDocuments) $trail->where('to_office_id', $officeId);
            })->count()
            : 0;
        $stats = [
            'awaiting_my_approval' => DocumentCreationDraft::query()->where('approver_id', $user->id)->where('status', 'pending_approval')->count(),
            'my_submissions_awaiting_approval' => DocumentCreationDraft::query()->where('created_by', $user->id)->where('status', 'pending_approval')->count(),
            'returned_for_revision' => DocumentCreationDraft::query()->where('created_by', $user->id)->where('status', 'revision_requested')->count(),
            'awaiting_verification' => DocumentCreationDraft::query()->where('created_by', $user->id)->where('status', 'awaiting_verification')->count(),
            'incoming_documents' => $incomingDocumentsCount,
            'pending_documents' => ($officeId || $canViewAllDocuments) ? Document::query()
                ->where('is_archived', false)->where('legacy_needs_review', false)
                ->whereHas('latestTrail', function ($trail) use ($officeId, $canViewAllDocuments) {
                    $trail->whereRaw('LOWER(status) = ?', ['pending']);
                    if (!$canViewAllDocuments) $trail->where('to_office_id', $officeId);
                })
                ->count() : 0,
            'released_documents' => ($officeId || $canViewAllDocuments) ? Document::query()
                ->whereHas('trails', function ($trail) use ($officeId, $canViewAllDocuments) {
                    $trail->whereRaw('LOWER(status) = ?', ['available']);
                    if (!$canViewAllDocuments) $trail->where('from_office_id', $officeId);
                })
                ->count() : 0,
            'archived_documents' => (clone $documents)->where('is_archived', true)->count(),
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
                ->where('is_archived', false)->where('legacy_needs_review', false)
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
