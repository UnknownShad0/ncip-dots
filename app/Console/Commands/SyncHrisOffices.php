<?php

namespace App\Console\Commands;

use App\Services\HrisOfficeSynchronizer;
use Illuminate\Console\Command;
use Throwable;

class SyncHrisOffices extends Command
{
    protected $signature = 'hris:sync-offices';

    protected $description = 'Copy the current HRIS office directory into the local office list';

    public function handle(HrisOfficeSynchronizer $synchronizer): int
    {
        try {
            $sync = $synchronizer->sync();
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Received {$sync->records_received} divisions; added {$sync->records_created}, updated {$sync->records_updated}.");

        return self::SUCCESS;
    }
}
