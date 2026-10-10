<?php

namespace App\Console\Commands;

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
    protected $signature = 'legacy:import-all {--apply : Commit directory and document imports; otherwise preview only} {--target= : Exact target database name required for apply} {--unassign-mismatched-divisions : Retain the bureau and leave conflicting divisions unassigned}';

    protected $description = 'Preview or import the legacy directory and document data together';

    public function handle(LegacyDirectoryImport $directory, LegacyDocumentImport $documents): int
    {
        $connection = DB::connection();
        $target = $connection->getDatabaseName();
        $source = DB::connection('legacy')->getDatabaseName();
        $apply = (bool) $this->option('apply');
        $this->info("Source: $source → Target: $target");

        if ($connection->getDriverName() === 'mysql' && $source === $target) {
            $this->error('Source and target database names must differ.');

            return self::FAILURE;
        }
        if ($apply && $this->option('target') !== $target) {
            $this->error('Specify --target with the exact target database name.');

            return self::FAILURE;
        }
        if (! Schema::hasTable('legacy_document_exceptions')) {
            $this->error('Run the migrations first, including the document import preparation migration.');

            return self::FAILURE;
        }

        foreach (['ranges' => 'legacy_range_id', 'offices' => 'legacy_bureau_id', 'divisions' => 'legacy_division_id', 'users' => 'legacy_user_uuid'] as $table => $column) {
            if (! Schema::hasColumn($table, $column)) {
                $this->error('Run the legacy identity migration first.');

                return self::FAILURE;
            }
        }

        try {
            if ($apply) {
                $report = $connection->transaction(function () use ($directory, $documents) {
                    $plan = $directory->plan((bool) $this->option('unassign-mismatched-divisions'));
                    $directory->apply($plan);

                    return [
                        'directory' => ['counts' => $plan['counts'], 'warnings' => $plan['warnings']],
                        'documents' => $documents->run(true),
                    ];
                });
            } else {
                $connection->beginTransaction();
                try {
                    $plan = $directory->plan((bool) $this->option('unassign-mismatched-divisions'));
                    $directory->apply($plan);
                    $documentReport = $documents->run(false);
                    $report = [
                        'directory' => ['counts' => $plan['counts'], 'warnings' => $plan['warnings']],
                        'documents' => $documentReport,
                    ];
                } finally {
                    if ($connection->transactionLevel() > 0) {
                        $connection->rollBack();
                    }
                }
            }
        } catch (Throwable $e) {
            $this->error($e instanceof QueryException
                ? 'Database failure; the import transaction was rolled back. Query bindings omitted to protect source data.'
                : $e->getMessage());

            return self::FAILURE;
        }

        $this->newLine();
        $this->info('Directory import');
        $this->table(
            ['Table', 'New', 'Existing to link', 'Already imported'],
            collect($report['directory']['counts'])->map(fn ($counts, $table) => [
                $table, $counts['insert'] ?? 0, $counts['linked'] ?? 0, $counts['unchanged'] ?? 0,
            ])->all()
        );
        foreach ($report['directory']['warnings'] as $warning) {
            $this->warn($warning);
        }

        $this->newLine();
        $this->info('Document import');
        $documentReport = $report['documents'];
        $this->table(
            ['Table', 'New', 'Linked', 'Existing', 'Exceptions retained'],
            collect($documentReport['counts'])->map(fn ($counts, $table) => [
                $table, $counts['new'] ?? 0, $counts['linked'] ?? 0, $counts['existing'] ?? 0, $counts['quarantined'] ?? 0,
            ])->all()
        );
        foreach ($documentReport['issues'] as $reason => $issue) {
            $this->warn($reason.': '.$issue['count']);
        }

        try {
            $path = 'legacy-import-reports/all-'.now()->format('Ymd-His-u').'.json';
            if (! Storage::disk('local')->put($path, json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR))) {
                throw new RuntimeException('Report could not be saved.');
            }
            $this->line('Report: '.Storage::disk('local')->path($path));
        } catch (Throwable) {
            $this->warn('Report file could not be saved; the results above are authoritative.');
        }

        $this->info($apply
            ? 'Directory and document imports committed. Attachment metadata is imported; physical files are not copied.'
            : 'Preview only: all temporary directory writes were rolled back; no database records changed.');

        return self::SUCCESS;
    }
}
