<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

class LegacyAuditImport
{
    public function run(bool $apply = false, ?array $userPreview = null): array
    {
        $source = DB::connection('legacy');
        $target = DB::connection();
        if ($source === $target || ($target->getDriverName() === 'mysql' && $source->getDatabaseName() === $target->getDatabaseName())) {
            throw new RuntimeException('Source and target database must differ.');
        }
        $users = ! $apply && $userPreview !== null ? $userPreview : $target->table('users')->whereNotNull('legacy_user_uuid')->pluck('id', 'legacy_user_uuid')->all();
        if (! $users) {
            throw new RuntimeException('Run the directory import first.');
        }
        $report = ['source' => $source->getDatabaseName(), 'target' => $target->getDatabaseName(), 'mode' => $apply ? 'applied' : 'preview',
            'total' => 0, 'new' => 0, 'existing' => 0, 'without_actor' => 0, 'unmapped_actor' => 0, 'missing_action' => 0, 'missing_date' => 0];
        // TIMESTAMP is session-timezone dependent. Read and write UTC consistently,
        // restoring both sessions even on failure. Exported mysqldump dates are UTC too.
        $timezones = [];
        try {
            foreach ([$source, $target] as $connection) {
                if (in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)) {
                    $timezones[] = [$connection, $connection->selectOne('SELECT @@session.time_zone AS tz')->tz];
                    $connection->statement("SET SESSION time_zone = '+00:00'");
                }
            }
            $work = function () use ($source, $target, $users, $apply, &$report) {
                return $source->transaction(function () use ($source, $target, $users, $apply, &$report) {
                    foreach ($source->table('audit_trail')->lazyById(500, 'trailUuid')->chunk(500) as $chunk) {
                        $existing = $target->table('audit_trails')->whereIn('legacy_trail_uuid', $chunk->pluck('trailUuid')->all())->pluck('legacy_trail_uuid')->flip()->all();
                        $batch = [];
                        foreach ($chunk as $row) {
                            $report['total']++;
                            if (! filled($row->trailUuid)) {
                                throw new RuntimeException('Source audit record has no identity; import stopped.');
                            }
                            if (isset($existing[$row->trailUuid])) {
                                $report['existing']++;

                                continue;
                            }
                            $hasActor = filled($row->userUuid);
                            $actor = $hasActor ? ($users[$row->userUuid] ?? null) : null;
                            if (! $hasActor) {
                                $report['without_actor']++;
                            } elseif ($actor === null) {
                                $report['unmapped_actor']++;
                            }
                            if (! filled($row->event)) {
                                $report['missing_action']++;
                            }
                            $date = $this->date($row->logDate);
                            if ($date === null) {
                                $report['missing_date']++;
                            }
                            $batch[] = [
                                'legacy_trail_uuid' => $row->trailUuid,
                                'legacy_user_uuid' => $row->userUuid,
                                'legacy_module' => $row->module,
                                // Query is historical text only. Do not execute it or send it to browsers.
                                'legacy_payload' => json_encode($row, JSON_THROW_ON_ERROR),
                                'record_source' => 'legacy_import',
                                'user_id' => $actor, 'action' => $row->event,
                                'created_at' => $date, 'updated_at' => $date,
                            ];
                            $report['new']++;
                        }
                        if ($apply && $batch) {
                            $target->table('audit_trails')->insert($batch);
                        }
                    }
                    // Unknown nonblank identities likely mean an incomplete directory migration.
                    // Stop the whole import rather than silently detach identified users.
                    if ($report['unmapped_actor']) {
                        throw new RuntimeException($report['unmapped_actor'].' audit rows have unmapped users. Complete the directory mappings before importing.');
                    }

                    return $report;
                });
            };

            return $apply ? $target->transaction($work) : $work();
        } finally {
            foreach ($timezones as [$connection, $timezone]) {
                $connection->statement('SET SESSION time_zone = ?', [$timezone]);
            }
        }
    }

    private function date(?string $value): ?string
    {
        if (! $value || str_starts_with($value, '0000-')) {
            return null;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new \DateTimeZone('UTC'));
        if (! $date || $date->format('Y-m-d H:i:s') !== $value) {
            throw new RuntimeException('Invalid legacy audit timestamp; original data left unchanged.');
        }

        return $value;
    }
}
