<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class HrisDirectory
{
    public function lookup(string $employeeNumber): ?array
    {
        $employee = collect($this->records($this->fetch('employee_path', ['agency_employee_no' => $employeeNumber])))
            ->first(fn (array $record) => strcasecmp(trim((string) ($record['agency_employee_no'] ?? '')), trim($employeeNumber)) === 0);

        if (! $employee) {
            return null;
        }

        $divisionCode = $employee['division_code'] ?? '';
        $offices = filled($divisionCode)
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
            'employee' => array_intersect_key($employee, array_flip([
                'agency_employee_no', 'first_name', 'middle_name', 'last_name', 'ext_name',
                'username', 'email_address', 'division_code', 'division',
            ])),
            'offices' => $offices,
        ];
    }

    private function fetch(string $path, array $query): mixed
    {
        $config = config('services.hris');
        if (blank($config['url'] ?? null)) {
            throw new RuntimeException('HRIS API URL is not configured.');
        }

        $request = Http::acceptJson()->timeout(15);
        if (filled($config['token'] ?? null)) {
            $request = $request->withToken($config['token']);
        }

        $response = $request->get(rtrim($config['url'], '/').'/'.ltrim($config[$path], '/'), $query);
        if ($response->status() === 404) {
            return [];
        }

        return $response->throw()->json();
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
