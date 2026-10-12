<?php

namespace App\Services;

use App\Models\DocumentCreationDraft;
use App\Models\DocumentTrail;
use App\Models\Office;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

class ProcessingPerformance
{
    public function forOffice(?int $officeId, bool $allOffices = false): array
    {
        $offices = Office::query()->when(! $allOffices, fn ($q) => $q->where('id', $officeId ?? 0))
            ->orderBy('name')->get(['id', 'name', 'short_name']);
        if ($offices->isEmpty()) {
            return [];
        }
        $samples = [];
        foreach ($offices as $office) {
            $samples[$office->id] = ['tracking' => [], 'approval' => []];
        }

        // Preserve chronology and pair each receipt with the next release only.
        // Only documents with a measurable receipt can contribute a tracking sample.
        $receivedDocuments = DocumentTrail::query()->select('document_id')
            ->where('action', 'Received')->where('status', 'pending')
            ->whereIn('to_office_id', $offices->modelKeys());
        $officeIds = $offices->modelKeys();
        $trailQuery = DocumentTrail::query()->whereIn('document_id', $receivedDocuments)->whereHas('document', fn ($q) => $q->where('legacy_needs_review', false))
            // The state machine only reads receipt, release, and terminal events.
            // Filter them in SQL instead of paging every trail for matching documents.
            ->where(fn ($q) => $q
                ->where(fn ($receipt) => $receipt->whereIn('to_office_id', $officeIds)
                    ->where('status', 'pending')->where('action', 'Received'))
                ->orWhere(fn ($close) => $close->whereIn('from_office_id', $officeIds)
                    ->whereIn('status', ['available', 'terminal'])))
            // PDO buffers cursor results; bounded pages avoid loading the full history.
            ->select(['id', 'document_id', 'from_office_id', 'to_office_id', 'status', 'action', 'created_at'])
            ->orderBy('document_id')->orderBy('id');
        $trails = $this->trailPages($trailQuery);
        $receipts = [];
        $documentId = null;
        foreach ($trails as $trail) {
            if ($documentId !== $trail->document_id) {
                $receipts = [];
                $documentId = $trail->document_id;
            }
            if (strtolower($trail->status) === 'pending' && $trail->action === 'Received') {
                $receipts[$trail->to_office_id] ??= $trail->created_at;
            } elseif (strtolower($trail->status) === 'available') {
                $id = $trail->from_office_id;
                if (isset($samples[$id], $receipts[$id])) {
                    $days = $this->weekdays($receipts[$id], $trail->created_at);
                    if ($days !== null) {
                        $samples[$id]['tracking'][] = $days;
                    }
                }
                unset($receipts[$id]);
            } elseif (strtolower($trail->status) === 'terminal') {
                unset($receipts[$trail->from_office_id]);
            }
        }

        // Office snapshots keep old approval rounds attributed correctly after resubmission.
        $drafts = DocumentCreationDraft::query()->where(function ($q) use ($offices) {
            $q->whereIn('approver_office_id', $offices->modelKeys());
            $q->orWhereHas('events', fn ($event) => $event->whereIn('metadata->approver_office_id', $offices->modelKeys()));
        })->select(['id', 'approver_office_id', 'version_number', 'submitted_at', 'decision_at'])->lazyById(100);
        foreach ($drafts as $draft) {
            $submissions = [];
            $decided = [];
            foreach ($draft->events()->reorder()->select(['id', 'draft_id', 'event', 'metadata', 'created_at'])->lazyById(500) as $event) {
                $version = $event->metadata['version'] ?? null;
                if ($version === null) {
                    continue;
                }
                if ($event->event === 'Submitted for approval') {
                    $submissions[$version] = $event;
                } elseif (in_array($event->event, ['Approved', 'Rejected', 'Revision requested'], true) && ! isset($decided[$version])) {
                    $start = $submissions[$version] ?? null;
                    $id = $start?->metadata['approver_office_id'] ?? null;
                    // Old events have no office snapshot: only the current round is unambiguous.
                    if ($id === null && (int) $version === (int) $draft->version_number) {
                        $id = $draft->approver_office_id;
                    }
                    if ($start && isset($samples[$id])) {
                        $days = $this->weekdays($start->created_at, $event->created_at);
                        if ($days !== null) {
                            $samples[$id]['approval'][] = $days;
                        }
                    }
                    $decided[$version] = true;
                }
            }
            if (! isset($decided[$draft->version_number]) && isset($samples[$draft->approver_office_id]) && $draft->submitted_at && $draft->decision_at) {
                $days = $this->weekdays($draft->submitted_at, $draft->decision_at);
                if ($days !== null) {
                    $samples[$draft->approver_office_id]['approval'][] = $days;
                }
            }
        }

        return $offices->map(function ($office) use ($samples) {
            $row = ['office_id' => $office->id, 'name' => $office->name, 'label' => $office->short_name ?: $office->name];
            foreach (['tracking', 'approval'] as $metric) {
                $values = $samples[$office->id][$metric];
                // Retain enough precision for the chart to show short completed cycles.
                $row[$metric] = count($values) ? round(collect($values)->median(), 6) : null;
                $row[$metric.'_count'] = count($values);
            }

            return $row;
        })->all();
    }

    /** Page by document/id so receipts survive page boundaries without growing OFFSET scans. */
    private function trailPages(Builder $query): \Generator
    {
        $lastDocument = null;
        $lastId = null;
        do {
            $page = (clone $query)->when($lastId !== null, fn ($q) => $q->where(function ($after) use ($lastDocument, $lastId) {
                $after->where('document_id', '>', $lastDocument)
                    ->orWhere(fn ($same) => $same->where('document_id', $lastDocument)->where('id', '>', $lastId));
            }))->limit(500)->get();
            foreach ($page as $trail) {
                $lastDocument = $trail->document_id;
                $lastId = $trail->id;
                yield $trail;
            }
        } while ($page->count() === 500);
    }

    // Fractional elapsed weekdays, not employee working hours. Holidays are included.
    private function weekdays($start, $end): ?float
    {
        if (! $start || ! $end) {
            return null;
        }
        $cursor = CarbonImmutable::parse($start)->setTimezone('Asia/Manila');
        $finish = CarbonImmutable::parse($end)->setTimezone('Asia/Manila');
        if ($finish->lessThan($cursor)) {
            return null;
        }
        $seconds = 0;
        while ($cursor->lessThan($finish)) {
            $next = $cursor->startOfDay()->addDay()->min($finish);
            if ($cursor->isWeekday()) {
                $seconds += $next->getTimestamp() - $cursor->getTimestamp();
            }
            $cursor = $next;
        }

        return $seconds / 86400;
    }
}
