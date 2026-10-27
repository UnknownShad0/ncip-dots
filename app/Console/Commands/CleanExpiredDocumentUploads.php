<?php

namespace App\Console\Commands;

use App\Services\StagedDocumentUploadService;
use Illuminate\Console\Command;

class CleanExpiredDocumentUploads extends Command
{
    protected $signature = 'document-uploads:clean-expired';

    protected $description = 'Delete expired temporary document uploads';

    public function handle(StagedDocumentUploadService $uploads): int
    {
        $deleted = $uploads->purgeExpired();
        $this->info("Deleted {$deleted} expired temporary upload(s).");

        return self::SUCCESS;
    }
}
