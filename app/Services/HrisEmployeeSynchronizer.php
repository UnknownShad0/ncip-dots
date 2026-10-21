<?php

namespace App\Services;

use App\Models\HrisEmployee;
use App\Models\HrisEmployeeSync;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\RequestException;
use RuntimeException;
use Throwable;

class HrisEmployeeSynchronizer
{
    public function sync(?int $startedBy = null): HrisEmployeeSync
    {
        $sync = HrisEmployeeSync::query()->create([
            'started_by' => $startedBy,
            'status' => 'running',
            'started_at' => now(),
        ]);
        $lock = Cache::lock('hris-employee-directory-sync', 300);

        if (! $lock->get()) {
            $sync->update([
                'status' => 'failed',
                'error_summary' => 'Another HRIS employee sync is already running.',
                'finished_at' => now(),
            ]);

            throw new RuntimeException('Another HRIS employee sync is already running.');
        }

        try {
            $records = $this->records($this->fetchRoster());
            if ($records === []) {
                throw new RuntimeException('The HRIS roster was empty. Existing employee records were kept.');
            }
            $employees = array_map(fn (array $record) => $this->normalize($record), $records);
            $codes = array_column($employees, 'employee_code');

            if (count($codes) !== count(array_unique($codes))) {
                throw new RuntimeException('The HRIS roster contains duplicate employee codes.');
            }

            $now = now();
            foreach ($employees as &$employee) {
                $employee['last_synced_at'] = $now;
                $employee['created_at'] = $now;
                $employee['updated_at'] = $now;
            }
            unset($employee);

            $created = 0;
            $updated = 0;
            DB::transaction(function () use ($employees, &$created, &$updated): void {
                foreach (array_chunk($employees, 250) as $batch) {
                    $existingCodes = HrisEmployee::query()
                        ->whereIn('employee_code', array_column($batch, 'employee_code'))
                        ->pluck('employee_code')
                        ->all();
                    $updated += count($existingCodes);
                    $created += count($batch) - count($existingCodes);

                    HrisEmployee::query()->upsert($batch, ['employee_code'], [
                        'hris_employee_id', 'username', 'email_address',
                        'first_name', 'middle_name', 'last_name', 'ext_name',
                        'division_code', 'division', 'position', 'designation',
                        'employment_status', 'start_date', 'end_date',
                        'signatory_name', 'signatory_designation',
                        'last_synced_at', 'updated_at',
                    ]);
                }
            });

            $sync->update([
                'status' => 'succeeded',
                'records_received' => count($employees),
                'records_created' => $created,
                'records_updated' => $updated,
                'error_summary' => null,
                'finished_at' => now(),
            ]);

            return $sync->refresh();
        } catch (Throwable $exception) {
            $errorMessage = 'HRIS sync failed. Existing employee records were kept.';
            if ($exception instanceof RequestException && $exception->response->status() === 429) {
                $retryAfter = filter_var($exception->response->header('Retry-After'), FILTER_VALIDATE_INT);
                $errorMessage = is_int($retryAfter) && $retryAfter > 0
                    ? "HRIS is rate limiting sync. Try again in {$retryAfter} seconds. Existing employee records were kept."
                    : 'HRIS is rate limiting sync. Please wait briefly and try again. Existing employee records were kept.';
            }

            $sync->update([
                'status' => 'failed',
                'error_summary' => $errorMessage,
                'finished_at' => now(),
            ]);
            Log::warning('HRIS employee sync failed.', [
                'sync_id' => $sync->id,
                'exception' => get_class($exception),
            ]);

            throw new RuntimeException($errorMessage, 0, $exception);
        } finally {
            $lock->release();
        }
    }

    private function fetchRoster(): mixed
    {
        if (config('services.hris.use_sample_data')) {
            $path = base_path('tests/Fixtures/hris/get-employee.json');
            if (! is_readable($path)) {
                throw new RuntimeException('HRIS sample roster is unavailable.');
            }

            return json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        }

        $config = config('services.hris');
        if (blank($config['url'] ?? null)) {
            throw new RuntimeException('HRIS API URL is not configured.');
        }

        $request = Http::acceptJson()->timeout(60);
        if (filled($config['token'] ?? null)) {
            $request = $request->withToken($config['token']);
        }

        $endpoint = rtrim($config['url'], '/').'/'.ltrim($config['roster_path'] ?? '/api/employees', '/');

        return $request->get($endpoint)->throw()->json();
    }

    private function records(mixed $payload): array
    {
        for ($depth = 0; $depth < 5 && is_array($payload) && ! array_is_list($payload); $depth++) {
            foreach (['data', 'employees', 'items', 'result'] as $key) {
                if (isset($payload[$key]) && is_array($payload[$key])) {
                    $payload = $payload[$key];
                    continue 2;
                }
            }

            if (filled($payload['employee_code'] ?? null)) {
                return [$payload];
            }

            throw new RuntimeException('The HRIS response does not contain an employee roster.');
        }

        if (! is_array($payload)) {
            throw new RuntimeException('The HRIS response is not a valid employee roster.');
        }

        if (count(array_filter($payload, 'is_array')) !== count($payload)) {
            throw new RuntimeException('The HRIS roster contains an invalid record.');
        }

        return array_values($payload);
    }

    private function normalize(array $record): array
    {
        $employeeCode = trim((string) ($record['employee_code'] ?? ''));
        if ($employeeCode === '') {
            throw new RuntimeException('An HRIS roster record is missing its employee code.');
        }

        return [
            'hris_employee_id' => is_numeric($record['employee_id'] ?? null) ? (int) $record['employee_id'] : null,
            'employee_code' => $this->text($employeeCode, 100),
            'username' => $this->text($record['username'] ?? null, 100),
            'email_address' => $this->text($record['email_address'] ?? null, 255),
            'first_name' => $this->text($record['first_name'] ?? null, 100),
            'middle_name' => $this->text($record['middle_name'] ?? null, 100),
            'last_name' => $this->text($record['last_name'] ?? null, 100),
            'ext_name' => $this->text($record['ext_name'] ?? null, 50),
            'division_code' => $this->text($record['division_code'] ?? null, 100),
            'division' => $this->text($record['division'] ?? null, 255),
            'position' => $this->text($record['position'] ?? null, 255),
            'designation' => $this->text($record['designation'] ?? null, 255),
            'employment_status' => $this->text($record['employment_status'] ?? null, 100),
            'start_date' => $this->date($record['start_date'] ?? null),
            'end_date' => $this->date($record['end_date'] ?? null),
            'signatory_name' => $this->text($record['signatory_name'] ?? null, 255),
            'signatory_designation' => $this->text($record['signatory_designation'] ?? null, 255),
        ];
    }

    private function text(mixed $value, int $limit): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value === '' ? null : mb_substr($value, 0, $limit);
    }

    private function date(mixed $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        return Carbon::parse((string) $value)->toDateString();
    }
}
