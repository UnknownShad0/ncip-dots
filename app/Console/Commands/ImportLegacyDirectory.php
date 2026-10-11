<?php

namespace App\Console\Commands;

use App\Services\AuditTrailWriter;
use App\Services\LegacyDirectoryImport;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Throwable;

class ImportLegacyDirectory extends Command
{
    protected $signature = 'legacy:import-directory {--apply : Commit the import; otherwise preview only} {--target= : Required exact target database name when applying} {--unassign-mismatched-divisions : Retain user bureau and leave conflicting division null}';

    protected $description = 'Preview or import legacy ranges, offices, divisions and users without overwriting existing accounts';

    public function handle(LegacyDirectoryImport $import): int
    {
        $target = DB::connection()->getDatabaseName();
        $source = DB::connection('legacy')->getDatabaseName();
        $auditStarted = false;
        $this->info('Source: '.$source.' → Target: '.$target);
        try {
            if ($this->option('apply') && $this->option('target') !== $target) {
                throw new RuntimeException('Specify --target with the exact target database name.');
            }
            foreach (['ranges' => 'legacy_range_id', 'offices' => 'legacy_bureau_id', 'divisions' => 'legacy_division_id', 'users' => 'legacy_user_uuid'] as $table => $column) {
                if (! Schema::hasColumn($table, $column)) {
                    throw new RuntimeException('Apply the legacy identity migration first.');
                }
            }
            if ($this->option('apply')) {
                app(AuditTrailWriter::class)->record('import.started', details: [
                    'import' => 'legacy:import-directory',
                    'source' => $source,
                    'target' => $target,
                ]);
                $auditStarted = true;
            }
            $plan = $import->plan((bool) $this->option('unassign-mismatched-divisions'));
            $this->table(['Table', 'New', 'Existing to link', 'Already imported'], collect($plan['counts'])->map(fn ($c, $t) => [$t, $c['insert'] ?? 0, $c['linked'] ?? 0, $c['unchanged'] ?? 0])->all());
            foreach ($plan['warnings'] as $warning) {
                $this->warn($warning);
            }
            if ($this->option('apply')) {
                $import->apply($plan);
                app(AuditTrailWriter::class)->record('import.completed', details: [
                    'import' => 'legacy:import-directory',
                    'source' => $source,
                    'target' => $target,
                    'counts' => $plan['counts'],
                    'warnings' => $plan['warnings'],
                ]);
                $this->info('Import committed. Existing matched account passwords and permissions were preserved.');
            } else {
                $this->info('Preview only. No records written.');
            }

            return self::SUCCESS;
        } catch (Throwable $e) {
            // Do not print query bindings: they may contain password hashes or personal data.
            $message = $e instanceof QueryException ? 'Database operation failed; the import transaction was rolled back. Check schema and conflicts.' : $e->getMessage();
            $this->error($message);
            if ($auditStarted) {
                app(AuditTrailWriter::class)->record('import.failed', details: [
                    'import' => 'legacy:import-directory',
                    'source' => $source,
                    'target' => $target,
                    'reason' => $message,
                ], result: 'failure');
            }

            return self::FAILURE;
        }
    }
}
