<?php

namespace App\Console\Commands;

use App\Services\AuditTrailWriter;
use App\Services\LegacyAuditImport;
use App\Services\LegacyDirectoryImport;
use App\Services\LegacyDocumentImport;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

class ImportLegacyAll extends Command
{
    protected $signature = 'legacy:import-all {--apply : Commit all three imports in one transaction} {--target= : Exact target database name required for apply} {--unassign-mismatched-divisions : Retain user bureau and leave conflicting division null}';

    protected $description = 'Preview or import legacy directory, documents and audit history in dependency order';

    public function handle(LegacyDirectoryImport $directory, LegacyDocumentImport $documents, LegacyAuditImport $audit): int
    {
        $target = DB::connection();
        $apply = (bool) $this->option('apply');
        $stage = 'preflight';
        $auditStarted = false;
        $sourceName = null;
        try {
            if ($apply && $this->option('target') !== $target->getDatabaseName()) {
                throw new RuntimeException('Specify --target with the exact target database name.');
            }
            $sourceName = DB::connection('legacy')->getDatabaseName();
            $this->info('Source: '.$sourceName.' → Target: '.$target->getDatabaseName());
            foreach (['ranges' => ['legacy_range_id', 'record_source'], 'offices' => ['legacy_bureau_id', 'record_source'], 'divisions' => ['legacy_division_id', 'record_source'], 'users' => ['legacy_user_uuid', 'record_source'], 'documents' => ['legacy_doc_id', 'record_source'], 'audit_trails' => ['legacy_trail_uuid']] as $table => $columns) {
                if (! Schema::hasColumns($table, $columns)) {
                    throw new RuntimeException('Import schema is incomplete. Run php artisan migrate first (never migrate:fresh for an existing database).');
                }
            }
            if (! Schema::hasTable('legacy_document_exceptions')) {
                throw new RuntimeException('Run php artisan migrate before importing.');
            }
            if ($apply) {
                app(AuditTrailWriter::class)->record('import.started', details: [
                    'import' => 'legacy:import-all',
                    'source' => $sourceName,
                    'target' => $target->getDatabaseName(),
                ]);
                $auditStarted = true;
            }
            $work = function () use ($directory, $documents, $audit, $apply, &$stage, $sourceName, $target) {
                $stage = 'directory';
                $this->line('1/3 Directory');
                $plan = $directory->plan((bool) $this->option('unassign-mismatched-divisions'));
                $preview = [];
                if ($apply) {
                    $directory->apply($plan);
                } else {
                    // Project planned identities in memory: dependent previews work on an
                    // empty target without inserting and rolling back temporary records.
                    foreach (['users' => 'legacy_user_uuid', 'offices' => 'legacy_bureau_id'] as $table => $identity) {
                        $preview[$table] = DB::table($table)->whereNotNull($identity)->pluck('id', $identity)->all();
                        foreach ($plan['operations'] as $op) {
                            if ($op['table'] === $table && isset($op['values'][$identity])) {
                                $preview[$table][$op['values'][$identity]] = $op['id'];
                            }
                        }
                    }
                }
                $stage = 'documents';
                $this->line('2/3 Documents, history and attachment metadata');
                $documentReport = $documents->run($apply, $apply ? null : $preview);
                $stage = 'audit';
                $this->line('3/3 Audit history');
                $auditReport = $audit->run($apply, $apply ? null : $preview['users']);

                $report = ['mode' => $apply ? 'applied' : 'preview', 'directory' => ['counts' => $plan['counts'], 'warnings' => $plan['warnings']], 'documents' => $documentReport, 'audit' => $auditReport];
                if ($apply) {
                    app(AuditTrailWriter::class)->record('import.completed', details: [
                        'import' => 'legacy:import-all',
                        'source' => $sourceName,
                        'target' => $target->getDatabaseName(),
                        'counts' => [
                            'directory' => $plan['counts'],
                            'documents' => $documentReport['counts'],
                            'audit' => [
                                'total' => $auditReport['total'],
                                'new' => $auditReport['new'],
                                'existing' => $auditReport['existing'],
                                'without_actor' => $auditReport['without_actor'],
                                'unmapped_actor' => $auditReport['unmapped_actor'],
                            ],
                        ],
                        'exceptions' => $documentReport['issues'],
                    ]);
                }

                return $report;
            };
            $report = $apply ? $target->transaction($work) : $work();
        } catch (Throwable $e) {
            $message = $e instanceof QueryException ? 'Database error; query bindings withheld.' : $e->getMessage();
            $this->error("Failed at $stage: $message");
            $this->line($apply ? 'No import changes from this run were committed.' : 'Preview stopped; no database rows changed.');
            if ($auditStarted) {
                app(AuditTrailWriter::class)->record('import.failed', details: [
                    'import' => 'legacy:import-all',
                    'source' => $sourceName,
                    'target' => $target->getDatabaseName(),
                    'stage' => $stage,
                    'reason' => $message,
                ], result: 'failure');
            }

            return self::FAILURE;
        }
        $this->table(['Directory table', 'New', 'Linked', 'Existing'], collect($report['directory']['counts'])->map(fn ($c, $t) => [$t, $c['insert'] ?? 0, $c['linked'] ?? 0, $c['unchanged'] ?? 0])->all());
        foreach ($report['directory']['warnings'] as $warning) {
            $this->warn($warning);
        }
        $this->table(['Document table', 'New', 'Linked', 'Existing', 'Exceptions'], collect($report['documents']['counts'])->map(fn ($c, $t) => [$t, $c['new'] ?? 0, $c['linked'] ?? 0, $c['existing'] ?? 0, $c['quarantined'] ?? 0])->all());
        foreach ($report['documents']['issues'] as $reason => $issue) {
            $this->warn($reason.': '.$issue['count']);
        }
        $this->table(['Audit new', 'Audit existing', 'New without actor'], [[$report['audit']['new'], $report['audit']['existing'], $report['audit']['without_actor']]]);
        $path = 'legacy-import-reports/all-'.now()->format('Ymd-His-u').'.json';
        try {
            if (! Storage::disk('local')->put($path, json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR))) {
                throw new RuntimeException;
            }
            $this->line('Report: '.Storage::disk('local')->path($path));
        } catch (Throwable) {
            $this->warn('Report file could not be saved; the results above are authoritative.');
        }
        $this->info($apply ? 'All imports committed. Attachments remain metadata-only.' : 'Full preview complete. No database rows changed.');

        return self::SUCCESS;
    }
}
