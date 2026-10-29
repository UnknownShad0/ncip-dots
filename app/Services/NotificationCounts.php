<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class NotificationCounts
{
    /** @return array{incoming: int, pending: int, approvals: int, approved: int, drafts: int, total: int} */
    public function forUser(User $user): array
    {
        $approvalOffice = $user->office ?: ($user->office_code ? $user->officeByCode : null);
        $approvalOfficeId = $approvalOffice?->id;
        $officeId = $user->office_id ? (int) $user->office_id : null;
        $canReviewOfficeApprovals = $user->is_active && $user->isAdministrator() && $approvalOfficeId !== null;
        $cacheKey = implode(':', [
            'notification-counts-v5',
            $user->id,
            $officeId ?? 'none',
            $approvalOfficeId ?? 'no-approval-office',
            $user->role_id ?? 'no-role-id',
            md5((string) $user->role),
            $user->is_active ? 'active' : 'inactive',
        ]);

        $counts = Cache::remember($cacheKey, now()->addSeconds(30), function () use ($user, $officeId, $approvalOfficeId, $canReviewOfficeApprovals) {
            $officeDocumentCounts = null;
            if ($officeId !== null) {
                $latestTrails = DB::table('document_trails')->selectRaw('document_id, MAX(id) as id')->groupBy('document_id');
                $officeDocumentCounts = DB::table('documents')
                    ->joinSub($latestTrails, 'latest_trail_ids', fn ($join) => $join->on('latest_trail_ids.document_id', '=', 'documents.id'))
                    ->join('document_trails as latest_trail', 'latest_trail.id', '=', 'latest_trail_ids.id')
                    ->where('documents.is_archived', false)
                    ->where('documents.legacy_needs_review', false)
                    ->where('latest_trail.to_office_id', $officeId)
                    ->whereIn('latest_trail.status', ['available', 'pending'])
                    ->selectRaw("SUM(CASE WHEN latest_trail.status = 'available' THEN 1 ELSE 0 END) as incoming, SUM(CASE WHEN latest_trail.status = 'pending' THEN 1 ELSE 0 END) as pending")
                    ->first();
            }
            $incoming = (int) ($officeDocumentCounts?->incoming ?? 0);
            $pending = (int) ($officeDocumentCounts?->pending ?? 0);

            $approvals = $canReviewOfficeApprovals
                ? Document::query()
                    ->where('documents.approval_status', 'awaiting_approval')
                    ->where('documents.is_archived', false)
                    ->where('documents.legacy_needs_review', false)
                    ->where('documents.created_by', '!=', $user->id)
                    ->whereHas('latestTrail', fn ($trail) => $trail
                        ->where('status', 'pending')
                        ->where('to_office_id', $approvalOfficeId))
                    ->count()
                : 0;

            $documentAccess = app(DocumentAccess::class);
            $trackingDraftsQuery = Document::query()
                ->where('documents.legacy_needs_review', false)
                ->where('documents.is_finalized', false)
                ->where('documents.is_archived', false)
                ->where('documents.status', 'draft');

            if (! $documentAccess->canViewAllDocuments($user)) {
                $trackingDraftsQuery->where('documents.created_by', $user->id);
                if ($officeId === null) {
                    $trackingDraftsQuery->whereRaw('1 = 0');
                } else {
                    $trackingDraftsQuery->where('documents.office_id', $officeId);
                }
            }

            $drafts = $trackingDraftsQuery->count()
                + DocumentCreationDraft::query()
                    ->where('created_by', $user->id)
                    ->where('status', 'draft')
                    ->count();

            return [
                'incoming' => $incoming,
                'pending' => $pending,
                'approvals' => $approvals,
                'drafts' => $drafts,
                // Approvals are already part of the pending office queue. Keep
                // this base unique before adding approved documents below.
                'total' => $incoming + $pending + $drafts,
            ];
        });

        // Match the approved list and refresh on every request, including immediately
        // after archive/restore, without re-running the expensive tracking counts.
        $approvedQuery = Document::query()
            ->where('created_by', $user->id)
            ->where('approval_status', 'approved');
        $counts['approved'] = (clone $approvedQuery)->count();

        // A creator's approved document can also be in the office's incoming or
        // pending queue. Add only approved documents not already represented in
        // those queue counts so the bell total reflects unique documents.
        $approvedAlreadyQueued = 0;
        if ($officeId !== null) {
            $approvedAlreadyQueued = (clone $approvedQuery)
                ->whereHas('latestTrail', fn ($trail) => $trail
                    ->whereIn('status', ['available', 'pending'])
                    ->where('to_office_id', $officeId)
                    ->where('documents.is_archived', false)
                    ->where('documents.legacy_needs_review', false))
                ->count();
        }

        $counts['total'] += max(0, $counts['approved'] - $approvedAlreadyQueued);

        return $counts;
    }
}
