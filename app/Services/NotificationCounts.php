<?php

namespace App\Services;

use App\Models\DocumentCreationDraft;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class NotificationCounts
{
    /** @return array{incoming: int, pending: int, approvals: int, approved: int, total: int} */
    public function forUser(User $user): array
    {
        $approvalOffice = $user->office ?: ($user->office_code ? $user->officeByCode : null);
        $approvalOfficeId = $approvalOffice?->id;
        $officeId = $user->office_id ? (int) $user->office_id : null;
        $canReviewOfficeApprovals = $user->is_active && $user->isAdministrator() && $approvalOfficeId !== null;
        $cacheKey = implode(':', [
            'notification-counts-v2',
            $user->id,
            $officeId ?? 'none',
            $approvalOfficeId ?? 'no-approval-office',
            $user->role_id ?? 'no-role-id',
            md5((string) $user->role),
            $user->is_active ? 'active' : 'inactive',
        ]);

        return Cache::remember($cacheKey, now()->addSeconds(30), function () use ($user, $officeId, $approvalOfficeId, $canReviewOfficeApprovals) {
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

            $approvals = DocumentCreationDraft::query()
                ->where('status', 'pending_approval')
                ->where(function ($query) use ($user, $approvalOfficeId, $canReviewOfficeApprovals) {
                    $query->where('approver_id', $user->id);
                    if ($canReviewOfficeApprovals) {
                        $query->orWhere('approver_office_id', $approvalOfficeId);
                    }
                })
                ->count();

            $approved = DocumentCreationDraft::query()
                ->where('created_by', $user->id)
                ->whereIn('status', ['approved', 'awaiting_verification', 'verified'])
                ->whereNull('official_document_id')
                ->count();

            return [
                'incoming' => $incoming,
                'pending' => $pending,
                'approvals' => $approvals,
                'approved' => $approved,
                'total' => $incoming + $pending + $approvals + $approved,
            ];
        });
    }
}
