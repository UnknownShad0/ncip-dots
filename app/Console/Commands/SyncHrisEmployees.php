<?php

namespace App\Console\Commands;

use App\Services\HrisEmployeeSynchronizer;
use Illuminate\Console\Command;
use Throwable;

class SyncHrisEmployees extends Command
{
    protected $signature = 'hris:sync-employees';

    protected $description = 'Copy the current HRIS employee roster into the local directory';

    public function handle(HrisEmployeeSynchronizer $synchronizer): int
    {
        try {
            $sync = $synchronizer->sync();
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->info("Received {$sync->records_received} employees; added {$sync->records_created}, updated {$sync->records_updated}.");

        return self::SUCCESS;
    }
}
