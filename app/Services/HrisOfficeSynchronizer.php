<?php

namespace App\Services;

use App\Models\HrisOfficeSync;
use App\Models\OfficeList;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class HrisOfficeSynchronizer
{
    public function sync(?int $startedBy = null): HrisOfficeSync
    {
        $sync = HrisOfficeSync::query()->create([
            'started_by' => $startedBy,
            'status' => 'running',
            'started_at' => now(),
        ]);
        $lock = Cache::lock('hris-office-directory-sync', 300);

        if (! $lock->get()) {
            $sync->update([
                'status' => 'failed',
                'error_summary' => 'Another HRIS office sync is already running.',
                'finished_at' => now(),
            ]);

            throw new RuntimeException('Another HRIS office sync is already running.');
        }

        try {
            $records = $this->flattenRoster($this->fetchRoster());
            if ($records === []) {
                throw new RuntimeException('The HRIS office roster was empty. Existing directory records were kept.');
            }

            $codes = array_column($records, 'division_code');
            if (count($codes) !== count(array_unique($codes))) {
                throw new RuntimeException('The HRIS office roster contains duplicate division codes.');
            }

            $now = now();
            $existing = OfficeList::withTrashed()
                ->whereIn('division_code', $codes)
                ->get()
                ->keyBy('division_code');
            $created = 0;
            $updated = 0;
            $upserts = [];

            foreach ($records as $record) {
                $previous = $existing->get($record['division_code']);
                $previous ? $updated++ : $created++;
                $upserts[] = [
                    ...$record,
                    'status' => $record['status'] ?? $previous?->status,
                    'office_address' => $previous?->office_address,
                    'province_code' => $previous?->province_code,
                    'municipality_code' => $previous?->municipality_code,
                    'short_name' => $previous?->short_name,
                    'email' => $previous?->email,
                    'parent_office_id' => $previous?->parent_office_id,
                    'last_synced_at' => $now,
                    'is_current' => true,
                    'deleted_at' => null,
                    'created_at' => $previous?->created_at ?? $now,
                    'updated_at' => $now,
                ];
            }

            DB::transaction(function () use ($upserts): void {
                DB::table('office_lists')->update(['is_current' => false]);
                foreach (array_chunk($upserts, 250) as $batch) {
                    DB::table('office_lists')->upsert($batch, ['division_code'], [
                        'division_name', 'long_name', 'region_code', 'hris_office_code',
                        'hris_office_name', 'status', 'last_synced_at', 'is_current', 'deleted_at', 'updated_at',
                    ]);
                }
            });

            $sync->update([
                'status' => 'succeeded',
                'records_received' => count($records),
                'records_created' => $created,
                'records_updated' => $updated,
                'error_summary' => null,
                'finished_at' => now(),
            ]);

            return $sync->refresh();
        } catch (Throwable $exception) {
            $message = 'HRIS office sync failed. Existing directory records were kept.';
            if ($exception instanceof RequestException && $exception->response->status() === 429) {
                $retryAfter = filter_var($exception->response->header('Retry-After'), FILTER_VALIDATE_INT);
                $message = is_int($retryAfter) && $retryAfter > 0
                    ? "HRIS is rate limiting sync. Try again in {$retryAfter} seconds. Existing directory records were kept."
                    : 'HRIS is rate limiting sync. Please wait briefly and try again. Existing directory records were kept.';
            }

            $sync->update([
                'status' => 'failed',
                'error_summary' => $message,
                'finished_at' => now(),
            ]);
            Log::warning('HRIS office sync failed.', [
                'sync_id' => $sync->id,
                'exception' => get_class($exception),
            ]);

            throw new RuntimeException($message, 0, $exception);
        } finally {
            $lock->release();
        }
    }

    private function fetchRoster(): array
    {
        if (config('services.hris.use_sample_data')) {
            $path = base_path('tests/Fixtures/hris/get-office.json');
            if (! is_readable($path)) {
                throw new RuntimeException('HRIS sample office file is unavailable.');
            }

            $payload = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);

            [$records, $nextUrl, $currentPage, $lastPage, $hasMore] = $this->pageParts($payload);
            if ($nextUrl !== null || $hasMore || ($currentPage !== null && $lastPage !== null && $currentPage < $lastPage)) {
                throw new RuntimeException('Sample office data unexpectedly uses pagination.');
            }

            return $records;
        }

        $config = config('services.hris');
        if (blank($config['url'] ?? null)) {
            throw new RuntimeException('HRIS API URL is not configured.');
        }

        $base = rtrim($config['url'], '/');
        $endpoint = $base.'/'.ltrim($config['office_path'] ?? '/api/offices', '/');
        $token = $config['token'] ?? null;
        $records = [];
        $url = $endpoint;
        $query = [];
        $page = 1;
        $seen = [];

        for ($requestCount = 0; $requestCount < 100; $requestCount++) {
            if (isset($seen[$url.'?'.http_build_query($query)])) {
                throw new RuntimeException('The HRIS office response repeated a pagination link.');
            }
            $seen[$url.'?'.http_build_query($query)] = true;

            $request = Http::acceptJson()->timeout(60);
            if (filled($token)) {
                $request = $request->withToken($token);
            }

            $response = $request->get($url, $query)->throw();
            $payload = $response->json();
            [$batch, $nextUrl, $currentPage, $lastPage, $hasMore] = $this->pageParts($payload);
            if ($batch === [] && $records === []) {
                return [];
            }
            array_push($records, ...$batch);

            if ($nextUrl !== null) {
                $url = $this->sameOriginNextUrl($nextUrl, $base, $endpoint);
                $query = [];
                continue;
            }
            if ($currentPage !== null && $lastPage !== null && $currentPage < $lastPage) {
                $url = $endpoint;
                $query = ['page' => ++$page];
                continue;
            }
            if ($hasMore) {
                $url = $endpoint;
                $query = ['page' => ++$page];
                continue;
            }

            return $records;
        }

        throw new RuntimeException('The HRIS office response exceeded the supported page limit.');
    }

    private function pageParts(mixed $payload): array
    {
        if (! is_array($payload)) {
            throw new RuntimeException('The HRIS office response is not a valid roster.');
        }

        if (array_is_list($payload)) {
            return [array_values(array_filter($payload, 'is_array')), null, null, null, false];
        }

        $records = null;
        foreach (['data', 'offices', 'items', 'result'] as $key) {
            if (isset($payload[$key]) && is_array($payload[$key])) {
                $records = $payload[$key];
                break;
            }
        }
        if (! is_array($records)) {
            throw new RuntimeException('The HRIS office response does not contain an office roster.');
        }
        if (! array_is_list($records)) {
            foreach (['offices', 'items', 'data', 'result'] as $key) {
                if (isset($records[$key]) && is_array($records[$key])) {
                    $records = $records[$key];
                    break;
                }
            }
        }
        if (! is_array($records) || ! array_is_list($records)) {
            throw new RuntimeException('The HRIS office list has an unsupported response envelope.');
        }

        $meta = is_array($payload['meta'] ?? null) ? $payload['meta'] : [];
        $links = is_array($payload['links'] ?? null) ? $payload['links'] : [];
        $next = $payload['next_page_url'] ?? $links['next'] ?? $meta['next_page_url'] ?? null;
        $current = $meta['current_page'] ?? $payload['current_page'] ?? null;
        $last = $meta['last_page'] ?? $payload['last_page'] ?? null;
        $more = (bool) ($payload['has_more'] ?? $meta['has_more'] ?? false);

        return [
            array_values(array_filter($records, 'is_array')),
            filled($next) ? (string) $next : null,
            is_numeric($current) ? (int) $current : null,
            is_numeric($last) ? (int) $last : null,
            $more,
        ];
    }

    private function sameOriginNextUrl(string $nextUrl, string $base, string $endpoint): string
    {
        $resolved = str_starts_with($nextUrl, 'http')
            ? $nextUrl
            : rtrim($base, '/').'/'.ltrim($nextUrl, '/');
        $baseParts = parse_url($base);
        $nextParts = parse_url($resolved);

        if (! is_array($baseParts) || ! is_array($nextParts)
            || strtolower((string) ($baseParts['host'] ?? '')) !== strtolower((string) ($nextParts['host'] ?? ''))
            || strtolower((string) ($baseParts['scheme'] ?? '')) !== strtolower((string) ($nextParts['scheme'] ?? ''))
            || (int) ($baseParts['port'] ?? 0) !== (int) ($nextParts['port'] ?? 0)) {
            throw new RuntimeException('The HRIS office response included an invalid pagination link.');
        }

        return $resolved;
    }

    private function flattenRoster(array $offices): array
    {
        $flattened = [];
        foreach ($offices as $office) {
            if (! is_array($office)) {
                throw new RuntimeException('The HRIS office roster contains an invalid office.');
            }
            $officeCode = $this->text($office['code'] ?? null, 100);
            $officeName = $this->text($office['name'] ?? null, 255);
            if ($officeCode === null || $officeName === null) {
                throw new RuntimeException('An HRIS office record is missing its code or name.');
            }
            if (! is_array($office['divisions'] ?? null) || ! array_is_list($office['divisions'])) {
                throw new RuntimeException('An HRIS office record is missing its division list.');
            }

            $regionCode = $this->text($office['region']['code'] ?? null, 100);
            foreach ($office['divisions'] as $division) {
                if (! is_array($division)) {
                    throw new RuntimeException('The HRIS office roster contains an invalid division.');
                }
                $divisionCode = $this->text($division['code'] ?? null, 100);
                $divisionName = $this->text($division['name'] ?? null, 255);
                if ($divisionCode === null || $divisionName === null) {
                    throw new RuntimeException('An HRIS division is missing its code or name.');
                }

                $flattened[] = [
                    'division_code' => $divisionCode,
                    'division_name' => $divisionName,
                    'long_name' => $this->text($division['long_name'] ?? null, 255) ?? $divisionName,
                    'region_code' => $regionCode,
                    'hris_office_code' => $officeCode,
                    'hris_office_name' => $officeName,
                    'status' => $this->text($division['status'] ?? $office['status'] ?? null, 50),
                ];
            }
        }

        return $flattened;
    }

    private function text(mixed $value, int $limit): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value === '' ? null : mb_substr($value, 0, $limit);
    }
}
