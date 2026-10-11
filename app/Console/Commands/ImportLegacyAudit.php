<?php

namespace App\Console\Commands;

use App\Services\LegacyAuditImport;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ImportLegacyAudit extends Command
{
    protected $signature = 'legacy:import-audit {--apply : Commit the audit import} {--target= : Exact target database name required for apply}';

    protected $description = 'Preview or import legacy audit history without executing recorded SQL queries';

    public function handle(LegacyAuditImport $import): int
    {
        $target = DB::connection()->getDatabaseName();
        if ($this->option('apply') && $this->option('target') !== $target) {
            $this->error('Specify --target with the exact target database name.');

            return self::FAILURE;
        }
        if (! Schema::hasColumn('audit_trails', 'legacy_trail_uuid')) {
            $this->error('Apply the legacy audit preparation migration first.');

            return self::FAILURE;
        }
        try {
            $report = $import->run((bool) $this->option('apply'));
        } catch (Throwable $e) {
            $this->error($e instanceof QueryException ? 'Database operation failed; any audit import writes were rolled back. SQL and bindings withheld.' : $e->getMessage());

            return self::FAILURE;
        }
        $this->info($report['source'].' → '.$report['target']);
        $this->table(['Total source', 'New', 'Existing', 'New without actor', 'New without date'], [[$report['total'], $report['new'], $report['existing'], $report['without_actor'], $report['missing_date']]]);
        $path = 'legacy-import-reports/audit-'.now()->format('Ymd-His-u').'.json';
        try {
            if (! Storage::disk('local')->put($path, json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR))) {
                throw new \RuntimeException;
            }
            $this->line('Report: '.Storage::disk('local')->path($path));
        } catch (Throwable) {
            $this->warn('Report file could not be saved. The result above is authoritative.');
        }
        $this->info($this->option('apply') ? 'Audit import committed. Existing audit entries were preserved.' : 'Preview only; no database rows changed.');

        return self::SUCCESS;
    }
}
