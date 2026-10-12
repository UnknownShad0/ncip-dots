<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class DashboardCharts
{
    // A null office means all offices only when explicitly authorized by the caller.
    public function forOffice(?int $officeId, bool $allOffices = false): array
    {
        return [
            'stats' => $this->statsForOffice($officeId, $allOffices),
            'documentTypes' => $this->documentTypesForOffice($officeId, $allOffices),
        ];
    }

    public function documentTypesForOffice(?int $officeId, bool $allOffices = false): array
    {
        if (! $allOffices && $officeId === null) {
            return [];
        }

        return $this->documentTypes($allOffices ? Document::query() : $this->documentsVisibleToOffice($officeId));
    }

    /** Summary counts use the same scope and definitions as the dashboard charts. */
    public function statsForOffice(?int $officeId, bool $allOffices = false): array
    {
        $documents = $allOffices
            ? Document::query()
            : ($officeId === null ? Document::query()->whereRaw('1 = 0') : $this->documentsVisibleToOffice($officeId));
        $latestTrails = DB::table('document_trails')->selectRaw('document_id, MAX(id) as id')->groupBy('document_id');
        $incomingCondition = 'latest_trail.status = ?'.($allOffices ? '' : ' AND latest_trail.to_office_id = ?');
        $pendingCondition = 'latest_trail.status = ?'.($allOffices ? '' : ' AND latest_trail.to_office_id = ?');
        $bindings = ['available'];
        if (! $allOffices) {
            $bindings[] = $officeId ?? 0;
        }
        $bindings[] = 'pending';
        if (! $allOffices) {
            $bindings[] = $officeId ?? 0;
        }
        $latestStatusCounts = (clone $documents)
            ->joinSub($latestTrails, 'latest_trail_ids', fn ($join) => $join->on('latest_trail_ids.document_id', '=', 'documents.id'))
            ->join('document_trails as latest_trail', 'latest_trail.id', '=', 'latest_trail_ids.id')
            ->where('documents.is_archived', false)
            ->where('documents.legacy_needs_review', false)
            ->selectRaw(
                "SUM(CASE WHEN {$incomingCondition} THEN 1 ELSE 0 END) as incoming_documents, SUM(CASE WHEN {$pendingCondition} THEN 1 ELSE 0 END) as pending_documents",
                $bindings,
            )->first();
        $releasedDocumentIds = DB::table('document_trails')->select('document_id')
            ->where('status', 'available')
            ->when(! $allOffices, fn ($query) => $query->where('from_office_id', $officeId))
            ->groupBy('document_id');
        $releasedCount = ! $allOffices && $officeId === null
            ? 0
            : Document::query()->joinSub($releasedDocumentIds, 'released_document_ids', 'released_document_ids.document_id', '=', 'documents.id')->count();

        return [
            'incoming_documents' => (int) ($latestStatusCounts?->incoming_documents ?? 0),
            'pending_documents' => (int) ($latestStatusCounts?->pending_documents ?? 0),
            'released_documents' => $releasedCount,
            'archived_documents' => (clone $documents)->where('is_archived', true)->count(),
        ];
    }

    public function documentTypes(Builder $documents): array
    {
        $types = DocumentType::query()->pluck('name', 'id');
        $counts = [];

        foreach ((clone $documents)->selectRaw('document_type_id, COUNT(*) as total')->groupBy('document_type_id')->get() as $row) {
            $name = $types->get($row->document_type_id, 'Unspecified');
            $counts[$name] = ($counts[$name] ?? 0) + (int) $row->total;
        }
        arsort($counts);

        return collect($counts)->map(fn ($count, $name) => ['name' => $name, 'count' => $count])->values()->all();
    }

    /** Return each document visible to one office once through indexed branches. */
    private function documentsVisibleToOffice(int $officeId): Builder
    {
        $officeIds = [$officeId];
        $visibleDocumentIds = DB::table('documents')->select('id')->whereIn('office_id', $officeIds)
            ->union(DB::table('document_trails')->select('document_id')->whereIn('from_office_id', $officeIds))
            ->union(DB::table('document_trails')->select('document_id')->whereIn('to_office_id', $officeIds))
            ->union(DB::table('document_trails')->select('document_id')->whereIn('holder_office_id', $officeIds))
            ->union(DB::table('document_trails')->select('document_id')->whereIn('legacy_receiving_office_id', $officeIds));

        return Document::query()->joinSub($visibleDocumentIds, 'visible_document_ids', 'visible_document_ids.id', '=', 'documents.id');
    }
}
