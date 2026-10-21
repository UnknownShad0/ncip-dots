<?php

namespace App\Services;

use App\Models\HrisEmployee;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class HrisDirectory
{
    public function verifyCredentials(string $username, string $password): bool
    {
        if (config('services.hris.use_sample_data')) {
            return true;
        }

        $config = config('services.hris');
        if (blank($config['url'] ?? null)) {
            throw new RuntimeException('HRIS API URL is not configured.');
        }

        $request = Http::acceptJson()->asJson()->timeout(15);
        if (filled($config['token'] ?? null)) {
            $request = $request->withToken($config['token']);
        }

        $endpoint = rtrim($config['url'], '/').'/'.ltrim($config['credentials_path'], '/');
        $response = $request->post($endpoint, [
            'username' => $username,
            'password' => $password,
        ]);
        $payload = $response->json();
        $result = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;

        Log::debug('HRIS credential verification completed', [
            'endpoint' => parse_url($endpoint, PHP_URL_PATH),
            'status' => $response->status(),
            'valid' => $response->successful() && ($result['valid'] ?? false) === true,
            'response_fields' => is_array($result) ? array_keys($result) : [],
        ]);

        if ($response->serverError()) {
            $response->throw();
        }

        return $response->successful() && ($result['valid'] ?? false) === true;
    }

    public function lookup(string $employeeCode, bool $includeOffices = true): ?array
    {
        $employeeRecords = [];
        $employee = $this->localEmployee($employeeCode);
        if (! $employee) {
            $employeeRecords = $this->records($this->fetchEmployeeByCode($employeeCode));
            $employee = collect($employeeRecords)
                ->first(fn (array $record) => strcasecmp(trim((string) ($record['employee_code'] ?? '')), trim($employeeCode)) === 0);
        }

        Log::debug('HRIS employee lookup evaluated', [
            'records_received' => count($employeeRecords),
            'match_found' => $employee !== null,
            'response_fields' => $employee ? array_keys($employee) : [],
        ]);

        if (! $employee) {
            return null;
        }

        $divisionCode = $employee['division_code'] ?? '';
        $offices = $includeOffices && filled($divisionCode)
            ? collect($this->records($this->fetch('office_path', ['division_code' => $divisionCode])))
                ->filter(fn (array $office) => collect($office['divisions'] ?? [])
                    ->contains(fn ($division) => is_array($division) && ($division['code'] ?? '') === $divisionCode))
                ->map(fn (array $office) => [
                    'office_code' => $office['code'] ?? '',
                    'office_name' => $office['name'] ?? '',
                    'region_code' => $office['region']['code'] ?? '',
                    'region_name' => $office['region']['name'] ?? '',
                ])->values()->all()
            : [];

        return [
            'employee' => $this->employeeFields($employee),
            'offices' => $offices,
        ];
    }

    public function search(string $search, int $limit = 20): array
    {
        $search = trim($search);
        if ($search === '') {
            return [];
        }

        $limit = max(1, min($limit, 50));
        if (Schema::hasTable('hris_employees')) {
            $query = HrisEmployee::query();
            foreach (preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $term) {
                $pattern = '%'.$term.'%';
                $query->where(fn ($matches) => $matches
                    ->where('employee_code', 'like', $pattern)
                    ->orWhere('first_name', 'like', $pattern)
                    ->orWhere('middle_name', 'like', $pattern)
                    ->orWhere('last_name', 'like', $pattern)
                    ->orWhere('ext_name', 'like', $pattern)
                    ->orWhere('username', 'like', $pattern)
                    ->orWhere('signatory_name', 'like', $pattern));
            }

            $matches = $query->orderBy('last_name')->orderBy('first_name')->limit($limit)->get()
                ->map(fn (HrisEmployee $employee) => $this->employeeFields($employee->attributesToArray()))
                ->all();
            if ($matches !== []) {
                return $matches;
            }
        }

        if (! config('services.hris.use_sample_data')) {
            return [];
        }

        $terms = preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return collect($this->records($this->sampleRecords('get-employee.json')))
            ->filter(function (array $employee) use ($terms) {
                $haystack = mb_strtolower(implode(' ', array_filter([
                    $employee['employee_code'] ?? null,
                    $employee['first_name'] ?? null,
                    $employee['middle_name'] ?? null,
                    $employee['last_name'] ?? null,
                    $employee['ext_name'] ?? null,
                    $employee['username'] ?? null,
                    $employee['signatory_name'] ?? null,
                ])));

                return collect($terms)->every(fn (string $term) => str_contains($haystack, mb_strtolower($term)));
            })
            ->take($limit)
            ->map(fn (array $employee) => $this->employeeFields($employee))
            ->values()
            ->all();
    }

    private function localEmployee(string $employeeCode): ?array
    {
        if (! Schema::hasTable('hris_employees')) {
            return null;
        }

        $employee = HrisEmployee::query()
            ->whereRaw('LOWER(employee_code) = ?', [mb_strtolower(trim($employeeCode))])
            ->first();

        return $employee ? $this->employeeFields($employee->attributesToArray()) : null;
    }

    private function employeeFields(array $employee): array
    {
        return array_intersect_key($employee, array_flip([
            'employee_code', 'first_name', 'middle_name', 'last_name', 'ext_name',
            'username', 'email_address', 'division_code', 'division', 'position',
            'designation', 'employment_status', 'start_date', 'end_date',
            'signatory_name', 'signatory_designation',
        ]));
    }

    private function fetchEmployeeByCode(string $employeeCode): mixed
    {
        if (config('services.hris.use_sample_data')) {
            return $this->sampleRecords('get-employee.json');
        }

        $config = config('services.hris');
        if (blank($config['url'] ?? null)) {
            throw new RuntimeException('HRIS API URL is not configured.');
        }

        $request = Http::acceptJson()->timeout(15);
        if (filled($config['token'] ?? null)) {
            $request = $request->withToken($config['token']);
        }

        $path = rtrim($config['employee_path'], '/').'/'.rawurlencode($employeeCode);
        $endpoint = rtrim($config['url'], '/').'/'.ltrim($path, '/');
        $response = $request->get($endpoint);
        $payload = $response->json();

        Log::debug('HRIS employee lookup request completed', [
            'endpoint' => parse_url($endpoint, PHP_URL_PATH),
            'status' => $response->status(),
            'response_type' => get_debug_type($payload),
            'response_fields' => is_array($payload) && ! array_is_list($payload) ? array_slice(array_keys($payload), 0, 12) : [],
        ]);

        if ($response->status() === 404) {
            return [];
        }

        return $response->throw()->json();
    }

    private function fetch(string $path, array $query): mixed
    {
        if (config('services.hris.use_sample_data') && $path === 'office_path') {
            return $this->sampleRecords('get-office.json');
        }

        $config = config('services.hris');
        if (blank($config['url'] ?? null)) {
            throw new RuntimeException('HRIS API URL is not configured.');
        }

        $request = Http::acceptJson()->timeout(15);
        if (filled($config['token'] ?? null)) {
            $request = $request->withToken($config['token']);
        }

        $endpoint = rtrim($config['url'], '/').'/'.ltrim($config[$path], '/');
        $response = $request->get($endpoint, $query);
        $payload = $response->json();

        Log::debug('HRIS API request completed', [
            'endpoint' => parse_url($endpoint, PHP_URL_PATH),
            'status' => $response->status(),
            'response_type' => get_debug_type($payload),
            'response_fields' => is_array($payload) && ! array_is_list($payload) ? array_slice(array_keys($payload), 0, 12) : [],
            'record_count' => is_array($payload) && array_is_list($payload) ? count($payload) : null,
        ]);

        if ($response->status() === 404) {
            return [];
        }

        return $response->throw()->json();
    }

    private function sampleRecords(string $filename): array
    {
        $path = base_path('tests/Fixtures/hris/'.$filename);
        if (! is_readable($path)) {
            throw new RuntimeException('HRIS sample file is missing or unreadable: '.$filename);
        }

        $payload = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (! is_array($payload)) {
            throw new RuntimeException('HRIS sample file must contain JSON records: '.$filename);
        }

        return $payload;
    }

    private function records(mixed $payload): array
    {
        for ($depth = 0; $depth < 4 && is_array($payload) && ! array_is_list($payload); $depth++) {
            foreach (['data', 'employees', 'employee', 'offices', 'items', 'result'] as $key) {
                if (isset($payload[$key]) && is_array($payload[$key])) {
                    $payload = $payload[$key];
                    continue 2;
                }
            }
            return [$payload];
        }

        return is_array($payload) ? array_values(array_filter($payload, 'is_array')) : [];
    }
}
