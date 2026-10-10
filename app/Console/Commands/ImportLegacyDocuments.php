<?php

namespace App\Console\Commands;

use App\Services\LegacyDocumentImport;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ImportLegacyDocuments extends Command
{
    protected $signature = 'legacy:import-documents {--apply : Commit the import} {--target= : Exact target database name required for apply}';

    protected $description = 'Preview/import legacy document records, preserve exceptions, and import attachment metadata without download links';

    public function handle(LegacyDocumentImport $import): int
    {
        $target = DB::connection()->getDatabaseName();
        $this->info('Source: '.DB::connection('legacy')->getDatabaseName().' → Target: '.$target);
        if ($this->option('apply') && $this->option('target') !== $target) {
            $this->error('Specify --target with the exact target database name.');

            return self::FAILURE;
        }
        if (! Schema::hasTable('legacy_document_exceptions')) {
            $this->error('Apply the document import preparation migration first.');

            return self::FAILURE;
        }
        try {
            $report = $import->run((bool) $this->option('apply'));
        } catch (Throwable $e) {
            $this->error($e instanceof QueryException ? 'Database failure; import transaction rolled back. Query bindings omitted to protect source data.' : $e->getMessage());

            return self::FAILURE;
        }
        $this->table(['Table', 'New', 'Linked', 'Existing', 'Exceptions retained'], collect($report['counts'])->map(fn ($v, $t) => [$t, $v['new'] ?? 0, $v['linked'] ?? 0, $v['existing'] ?? 0, $v['quarantined'] ?? 0])->all());
        foreach ($report['issues'] as $reason => $issue) {
            $this->warn($reason.': '.$issue['count']);
        }
        $path = 'legacy-import-reports/documents-'.now()->format('Ymd-His-u').'.json';
        try {
            if (! Storage::disk('local')->put($path, json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR))) {
                throw new \RuntimeException('Report could not be saved.');
            }
            $this->line('Report: '.Storage::disk('local')->path($path));
        } catch (Throwable) {
            $this->warn('Report file could not be saved; the result above is authoritative.');
        }
        $this->info($this->option('apply') ? 'Committed. Attachment metadata imported; physical files are not yet available.' : 'Preview only: no database records changed.');

        return self::SUCCESS;
    }
}
