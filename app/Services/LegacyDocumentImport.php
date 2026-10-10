<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/** One-time, transactional import. Raw source payloads remain available for reconciliation. */
class LegacyDocumentImport
{
    private array $counts = [];

    private array $issues = [];

    private bool $apply;

    private array $users;

    private array $offices;

    public function run(bool $apply = false): array
    {
        $this->apply = $apply;
        $this->counts = $this->issues = [];
        $source = DB::connection('legacy');
        $target = DB::connection();
        if ($target->getDriverName() === 'mysql' && $source->getDatabaseName() === $target->getDatabaseName()) {
            throw new RuntimeException('Source and target database must differ.');
        }
        $this->users = DB::table('users')->whereNotNull('legacy_user_uuid')->pluck('id', 'legacy_user_uuid')->all();
        $this->offices = DB::table('offices')->whereNotNull('legacy_bureau_id')->pluck('id', 'legacy_bureau_id')->all();
        if (! $this->users || ! $this->offices) {
            throw new RuntimeException('Import the legacy directory first.');
        }
        $work = function () use ($source) {
            // Snapshot source reads; no source writes. Run during a maintenance window.
            return $source->transaction(function () {
                $types = $this->lookups('document_type', 'document_types');
                $this->lookups('action_type', 'action_types');
                $purposes = $this->lookups('purpose_type', 'purpose_types');
                [$documents, $tracking] = $this->documents($types, $purposes);
                $trails = $this->trails($tracking);
                $this->files($documents, $trails);

                return ['mode' => $this->apply ? 'applied' : 'preview', 'counts' => $this->counts, 'issues' => $this->issues];
            });
        };

        return $apply ? $target->transaction($work) : $work();
    }

    private function count(string $table, string $kind, int $amount = 1): void
    {
        $this->counts[$table][$kind] = ($this->counts[$table][$kind] ?? 0) + $amount;
    }

    private function issue(string $reason, string $table, int $id): void
    {
        $this->issues[$reason]['count'] = ($this->issues[$reason]['count'] ?? 0) + 1;
        if (count($this->issues[$reason]['examples'] ?? []) < 10) {
            $this->issues[$reason]['examples'][] = "$table:$id";
        }
    }

    private function payload(object $row): string
    {
        return json_encode($row, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    }

    private function date(?string $value): ?string
    {
        return ! $value || str_starts_with($value, '0000-') ? null : $value;
    }

    private function yes(?string $value): bool
    {
        return in_array(strtolower((string) $value), ['yes', 'y', '1', 'true'], true);
    }

    private function office($id): ?int
    {
        if (! $id) {
            return null;
        }

        return $this->offices[$id] ?? throw new RuntimeException("Missing directory office mapping for legacy bureau $id.");
    }

    private function user($id): ?int
    {
        if (! $id) {
            return null;
        }

        return $this->users[$id] ?? throw new RuntimeException('Missing directory user mapping. Run directory import first.');
    }

    private function lookups(string $source, string $target): array
    {
        $existing = DB::table($target)->get();
        $map = [];
        foreach (DB::connection('legacy')->table($source)->orderBy('dtId')->get() as $row) {
            $match = $existing->firstWhere('legacy_type_id', $row->dtId);
            if ($match) {
                $map[$row->dtId] = $match->id;
                $this->count($target, 'existing');

                continue;
            }
            $matches = $existing->filter(fn ($v) => mb_strtolower(trim($v->name)) === mb_strtolower(trim((string) $row->name)));
            if ($matches->count() > 1 || ($matches->first()?->legacy_type_id !== null)) {
                throw new RuntimeException("Ambiguous lookup mapping: $source:$row->dtId.");
            }
            if (! filled($row->name)) {
                throw new RuntimeException("Missing lookup name: $source:$row->dtId.");
            }
            $values = ['legacy_type_id' => $row->dtId, 'legacy_payload' => $this->payload($row)];
            if ($match = $matches->first()) {
                $values['record_source'] = 'legacy_linked';
                if ($this->apply) {
                    DB::table($target)->where('id', $match->id)->update($values);
                }
                $match->legacy_type_id = $row->dtId;
                $match->record_source = 'legacy_linked';
                $map[$row->dtId] = $match->id;
                $this->count($target, 'linked');
            } else {
                $values += ['record_source' => 'legacy_import', 'name' => $row->name, 'description' => $row->description,
                    'is_active' => strtolower((string) $row->status) === 'active', 'created_by' => $this->user($row->createdBy),
                    'created_at' => $this->date($row->dateCreated), 'updated_at' => $this->date($row->dateUpdated)];
                $id = $this->apply ? DB::table($target)->insertGetId($values) : -((int) $row->dtId);
                $map[$row->dtId] = $id;
                $existing->push((object) ($values + ['id' => $id]));
                $this->count($target, 'new');
            }
        }

        // Textual purposes must be matched by name, never cast to an ID.
        return ['ids' => $map, 'names' => $existing->mapWithKeys(fn ($r) => [mb_strtolower(trim($r->name)) => $r->id])->all()];
    }

    private function insertBatch(string $table, string $identity, array $batch, array &$map): void
    {
        if (! $batch) {
            return;
        }
        if ($this->apply) {
            DB::table($table)->insert($batch);
            foreach (DB::table($table)->whereIn($identity, array_column($batch, $identity))->pluck('id', $identity) as $key => $id) {
                $map[$key] = $id;
            }
        } else {
            foreach ($batch as $row) {
                $map[$row[$identity]] = -((int) $row[$identity]);
            }
        }
    }

    private function documents(array $types, array $purposes): array
    {
        $source = DB::connection('legacy');
        $map = DB::table('documents')->whereNotNull('legacy_doc_id')->pluck('id', 'legacy_doc_id')->all();
        $existingTracking = DB::table('documents')->whereNotNull('tracking_number')->pluck('legacy_doc_id', 'tracking_number')->all();
        $normalize = fn ($v) => mb_strtolower(trim((string) $v));
        $occupied = [];
        foreach ($existingTracking as $number => $legacyId) {
            $occupied[$normalize($number)] = $legacyId;
        }
        $edges = $source->table('document_trail')->selectRaw('trackingNo, MIN(docTrailId) AS first_id, MAX(docTrailId) AS last_id')->whereNotNull('trackingNo')->groupBy('trackingNo')->get();
        $firstIds = $edges->pluck('first_id')->all();
        $lastIds = $edges->pluck('last_id')->all();
        $first = $last = [];
        foreach (array_chunk($firstIds, 1000) as $ids) {
            foreach ($source->table('document_trail')->whereIn('docTrailId', $ids)->get() as $t) {
                $first[$t->trackingNo] = $t;
            }
        }
        foreach (array_chunk($lastIds, 1000) as $ids) {
            foreach ($source->table('document_trail')->whereIn('docTrailId', $ids)->get() as $t) {
                $last[$t->trackingNo] = $t;
            }
        }
        unset($edges, $firstIds, $lastIds);
        $tracking = [];
        foreach ($source->table('document')->orderBy('docId')->lazyById(500, 'docId')->chunk(500) as $chunk) {
            $batch = [];
            foreach ($chunk as $d) {
                $d->docId = (int) $d->docId;
                if (isset($map[$d->docId])) {
                    $this->count('documents', 'existing');
                    if (filled($d->trackingNo)) {
                        $tracking[$d->trackingNo] = $map[$d->docId];
                    }

                    continue;
                }
                $number = filled($d->trackingNo) ? $d->trackingNo : null;
                if ($number !== null && array_key_exists($normalize($number), $occupied)) {
                    throw new RuntimeException("Tracking-number conflict for legacy document $d->docId. Existing document was not overwritten.");
                }
                if ($number !== null) {
                    $occupied[$normalize($number)] = $d->docId;
                }
                $latest = $last[$number ?? ''] ?? null;
                $earliest = $first[$number ?? ''] ?? null;
                $status = strtolower((string) ($latest?->status ?? ''));
                $archived = $this->yes($d->Archived) || $status === 'terminal';
                if ($archived) {
                    $status = 'terminal';
                }
                $needsReview = $number === null || ! filled($d->title) || (! $archived && ! in_array($status, ['pending', 'available'], true));
                if (! $archived && (($status === 'pending' && ! $latest?->holder) || ($status === 'available' && ! $latest?->receiving))) {
                    $needsReview = true;
                }
                if ($needsReview) {
                    $this->issue('document_needs_review', 'document', (int) $d->docId);
                }
                $type = $types['ids'][$d->dtId] ?? null;
                if ($d->dtId && ! $type) {
                    $this->issue('unknown_document_type', 'document', (int) $d->docId);
                }
                $purpose = $purposes['names'][$normalize($d->purpose)] ?? null;
                $batch[] = [
                    'legacy_doc_id' => $d->docId, 'legacy_payload' => $this->payload($d), 'record_source' => 'legacy_import', 'legacy_needs_review' => $needsReview,
                    'title' => $d->title, 'tracking_number' => $number, 'document_type_id' => $type,
                    'other_document_type' => $d->otherDtype, 'purpose_type_id' => $purpose,
                    'other_purpose' => $d->purpose, 'origin_type' => $d->originType,
                    'office_id' => $this->office($earliest?->originating), 'created_by' => $this->user($d->createdBy),
                    'status' => $status ?: 'needs_review', 'is_archived' => $archived,
                    'is_finalized' => $this->yes($d->isFinalized), 'urgent' => $this->yes($d->urgent),
                    'notify_by_email' => $this->yes($d->forNotification), 'remarks' => $d->remarks,
                    'created_at' => $this->date($d->dateCreated), 'updated_at' => $this->date($d->dateLastUpdated),
                ];
                $this->count('documents', 'new');
            }
            $this->insertBatch('documents', 'legacy_doc_id', $batch, $map);
            foreach ($chunk as $d) {
                if (filled($d->trackingNo)) {
                    $tracking[$d->trackingNo] = $map[$d->docId];
                }
            }
        }

        return [$map, $tracking];
    }

    private function quarantine(string $table, object $row, int $id, string $reason, array &$batch): void
    {
        $this->count($table, 'quarantined');
        $this->issue($reason, $table, $id);
        $batch[] = ['source_table' => $table, 'source_id' => $id, 'reason' => $reason, 'payload' => $this->payload($row), 'created_at' => now(), 'updated_at' => now()];
    }

    private function saveExceptions(array $batch): void
    {
        if ($this->apply && $batch) {
            DB::table('legacy_document_exceptions')->upsert($batch, ['source_table', 'source_id'], ['reason', 'payload', 'updated_at']);
        }
    }

    private function trails(array $documents): array
    {
        $map = DB::table('document_trails')->whereNotNull('legacy_doc_trail_id')->pluck('id', 'legacy_doc_trail_id')->all();
        $nativeDocs = DB::table('document_trails')->whereNull('legacy_doc_trail_id')->distinct()->pluck('document_id')->flip()->all();
        $maxLegacy = DB::table('document_trails')->whereNotNull('legacy_doc_trail_id')->selectRaw('document_id, MAX(legacy_doc_trail_id) AS last_id')->groupBy('document_id')->pluck('last_id', 'document_id')->all();
        $docMap = DB::table('document_trails')->whereNotNull('legacy_doc_trail_id')->pluck('document_id', 'legacy_doc_trail_id')->all();
        foreach (DB::connection('legacy')->table('document_trail')->orderBy('docTrailId')->lazyById(500, 'docTrailId')->chunk(500) as $chunk) {
            $batch = $exceptions = [];
            foreach ($chunk as $t) {
                if (isset($map[$t->docTrailId])) {
                    $this->count('document_trails', 'existing');

                    continue;
                }
                $doc = $documents[$t->trackingNo ?? ''] ?? null;
                if (! $doc) {
                    $this->quarantine('document_trail', $t, $t->docTrailId, 'missing_document', $exceptions);

                    continue;
                }
                if (isset($nativeDocs[$doc]) || (isset($maxLegacy[$doc]) && (int) $t->docTrailId < (int) $maxLegacy[$doc])) {
                    throw new RuntimeException("Cannot append legacy history to document $doc after newer history exists. Reconcile it first.");
                }
                $status = strtolower((string) $t->status);
                if (! in_array($status, ['pending', 'available', 'terminal'], true)) {
                    throw new RuntimeException("Unknown status on trail $t->docTrailId.");
                }
                $holder = $this->office($t->holder);
                $receiver = $this->office($t->receiving);
                $batch[] = [
                    'legacy_doc_trail_id' => $t->docTrailId, 'legacy_payload' => $this->payload($t), 'record_source' => 'legacy_import',
                    'document_id' => $doc, 'from_office_id' => $this->office($t->originating),
                    'to_office_id' => $status === 'available' ? $receiver : $holder,
                    'holder_office_id' => $holder, 'legacy_receiving_office_id' => $receiver,
                    'status' => $status, 'action' => $t->action, 'remarks' => $t->remarks,
                    'created_by' => $this->user($t->createdBy), 'created_at' => $this->date($t->dateCreated), 'updated_at' => $this->date($t->dateCreated),
                ];
                $docMap[$t->docTrailId] = $doc;
                $this->count('document_trails', 'new');
            }
            $this->insertBatch('document_trails', 'legacy_doc_trail_id', $batch, $map);
            $this->saveExceptions($exceptions);
            if ($this->apply && $batch) {
                DB::table('legacy_document_exceptions')->where('source_table', 'document_trail')->whereIn('source_id', array_column($batch, 'legacy_doc_trail_id'))->delete();
            }
        }

        return ['ids' => $map, 'documents' => $docMap];
    }

    private function files(array $documents, array $trails): void
    {
        $map = DB::table('document_files')->whereNotNull('legacy_file_id')->pluck('id', 'legacy_file_id')->all();
        foreach (DB::connection('legacy')->table('file')->orderBy('fileId')->lazyById(500, 'fileId')->chunk(500) as $chunk) {
            $batch = $exceptions = [];
            foreach ($chunk as $f) {
                if (isset($map[$f->fileId])) {
                    $this->count('document_files', 'existing');

                    continue;
                }
                $doc = $documents[(int) $f->docId] ?? null;
                if (! $doc) {
                    $this->quarantine('file', $f, $f->fileId, 'missing_document', $exceptions);

                    continue;
                }
                $trail = $trails['ids'][$f->docTrailId] ?? null;
                if ($f->docTrailId && (! $trail || ($trails['documents'][$f->docTrailId] ?? null) !== $doc)) {
                    $trail = null;
                    $this->issue('missing_or_conflicting_file_trail', 'file', $f->fileId);
                }
                $batch[] = [
                    'legacy_file_id' => $f->fileId, 'legacy_payload' => $this->payload($f), 'record_source' => 'legacy_import',
                    'document_id' => $doc, 'document_trail_id' => $trail, 'type' => $f->type ?? 'original',
                    'file_name' => $f->fileName, 'original_name' => $f->origName,
                    // Metadata only: never treat an old server path as a public download URL.
                    'file_path' => $f->filePath ?? '', 'is_available' => false,
                    'uploaded_by' => $this->user($f->uploadedBy),
                    'created_at' => $this->date($f->dateUploaded), 'updated_at' => $this->date($f->dateUploaded),
                ];
                $this->count('document_files', 'new');
            }
            $this->insertBatch('document_files', 'legacy_file_id', $batch, $map);
            $this->saveExceptions($exceptions);
            if ($this->apply && $batch) {
                DB::table('legacy_document_exceptions')->where('source_table', 'file')->whereIn('source_id', array_column($batch, 'legacy_file_id'))->delete();
            }
        }
    }
}
