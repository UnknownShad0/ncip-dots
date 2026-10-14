<?php

namespace App\Console\Commands;

use App\Services\DocumentTemplates;
use Illuminate\Console\Command;

class ImportDocumentAsset extends Command
{
    protected $signature = 'documents:import-asset {file : Local PNG/JPEG path} {--name= : Display name} {--kind=logo : logo, full_header, or footer}';

    protected $description = 'Import an immutable document logo/header and print its database ID';

    public function handle(DocumentTemplates $templates): int
    {
        $asset = $templates->import($this->argument('file'), $this->option('name') ?: basename($this->argument('file')), $this->option('kind'));
        $this->table(['ID', 'Name', 'Kind', 'Path'], [[$asset->id, $asset->name, $asset->kind, $asset->path]]);

        return self::SUCCESS;
    }
}
