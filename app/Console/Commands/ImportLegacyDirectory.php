<?php

namespace App\Console\Commands;

use App\Services\LegacyDirectoryImport;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class ImportLegacyDirectory extends Command
{
    protected $signature = 'legacy:import-directory {--apply : Commit the import; otherwise preview only} {--target= : Required exact target database name when applying} {--unassign-mismatched-divisions : Retain user bureau and leave conflicting division null}';

    protected $description = 'Preview or import legacy ranges, offices, divisions and users without overwriting existing accounts';

    public function handle(LegacyDirectoryImport $import): int
    {
        $target = DB::connection()->getDatabaseName();
        $this->info('Source: '.DB::connection('legacy')->getDatabaseName().' → Target: '.$target);
        try {
            if ($this->option('apply') && $this->option('target') !== $target) {
                throw new RuntimeException('Specify --target with the exact target database name.');
            }
            foreach (['ranges' => 'legacy_range_id', 'offices' => 'legacy_bureau_id', 'divisions' => 'legacy_division_id', 'users' => 'legacy_user_uuid'] as $table => $column) {
                if (! Schema::hasColumn($table, $column)) {
                    throw new RuntimeException('Apply the legacy identity migration first.');
                }
            }
            $plan = $import->plan((bool) $this->option('unassign-mismatched-divisions'));
            $this->table(['Table', 'New', 'Existing to link', 'Already imported'], collect($plan['counts'])->map(fn ($c, $t) => [$t, $c['insert'] ?? 0, $c['linked'] ?? 0, $c['unchanged'] ?? 0])->all());
            foreach ($plan['warnings'] as $warning) {
                $this->warn($warning);
            }
            if ($this->option('apply')) {
                $import->apply($plan);
                $this->info('Import committed. Existing matched account passwords and permissions were preserved.');
            } else {
                $this->info('Preview only. No records written.');
            }

            return self::SUCCESS;
        } catch (RuntimeException $e) {
            // Do not print query bindings: they may contain password hashes or personal data.
            $this->error($e instanceof QueryException ? 'Database operation failed; the import transaction was rolled back. Check schema and conflicts.' : $e->getMessage());

            return self::FAILURE;
        }
    }
}
