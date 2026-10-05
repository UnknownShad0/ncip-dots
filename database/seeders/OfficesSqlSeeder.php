<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OfficesSqlSeeder extends Seeder
{
    public function run(): void
    {
        $rows = $this->readOfficeRows(base_path('offices.sql'));
        $offices = collect($rows)->filter(fn (array $row) => str_starts_with((string) $row[1], 'BSO-'))->values();
        $divisions = collect($rows)->filter(fn (array $row) => str_starts_with((string) $row[1], 'DIV-'))->values();

        if ($offices->count() !== 90 || $divisions->count() !== 179) {
            throw new RuntimeException('The offices.sql file did not contain the expected 90 offices and 179 divisions.');
        }

        DB::transaction(function () use ($offices, $divisions): void {
            $officeIds = $this->targetIds('offices', $offices);
            $divisionIds = $this->targetIds('divisions', $divisions);
            $knownOfficeRows = DB::table('offices')->whereNotNull('directory_source_id')->pluck('id', 'directory_source_id');
            $knownDivisionRows = DB::table('divisions')->whereNotNull('directory_source_id')->pluck('id', 'directory_source_id');
            $newOfficeSourceIds = [];

            foreach ($offices as $row) {
                $sourceId = (int) $row[0];
                if ($knownOfficeRows->has($sourceId)) continue;

                DB::table('offices')->updateOrInsert(
                    ['id' => $officeIds[$sourceId]],
                    [
                        'directory_source_id' => $sourceId,
                        'parent_id' => null,
                        'range_id' => null,
                        'name' => $row[2] ?: $row[3],
                        'division_name' => $row[2],
                        'long_name' => $row[3],
                        'short_name' => $row[8],
                        'code' => $row[1],
                        'division_code' => $row[1],
                        'email' => $row[9],
                        'location' => $row[4],
                        'office_address' => $row[4],
                        'region_code' => $row[5],
                        'province_code' => $row[6],
                        'municipality_code' => $row[7],
                        'status' => $row[10],
                        'is_active' => strtolower((string) $row[10]) === 'active' && $row[14] === null,
                        'deleted_at' => $row[14],
                        'created_at' => $row[12],
                        'updated_at' => $row[13],
                    ],
                );
                $newOfficeSourceIds[] = $sourceId;
            }

            foreach ($offices as $row) {
                if (! in_array((int) $row[0], $newOfficeSourceIds, true)) continue;
                DB::table('offices')->where('id', $officeIds[(int) $row[0]])->update([
                    'parent_id' => $row[11] === null ? null : ($officeIds[(int) $row[11]] ?? null),
                ]);
            }

            foreach ($divisions as $row) {
                $sourceId = (int) $row[0];
                if ($knownDivisionRows->has($sourceId)) continue;

                DB::table('divisions')->updateOrInsert(
                    ['id' => $divisionIds[$sourceId]],
                    [
                        'directory_source_id' => $sourceId,
                        'office_id' => $row[11] === null ? null : ($officeIds[(int) $row[11]] ?? null),
                        'name' => $row[2] ?: $row[3],
                        'division_name' => $row[2],
                        'long_name' => $row[3],
                        'code' => $row[1],
                        'office_address' => $row[4],
                        'region_code' => $row[5],
                        'province_code' => $row[6],
                        'municipality_code' => $row[7],
                        'short_name' => $row[8],
                        'email' => $row[9],
                        'status' => $row[10],
                        'deleted_at' => $row[14],
                        'created_at' => $row[12],
                        'updated_at' => $row[13],
                    ],
                );
            }
        });

        $this->command?->info("Office directory source loaded from offices.sql ({$offices->count()} offices, {$divisions->count()} divisions).");
    }

    /** @return array<int, array<int, int|string|null>> */
    private function readOfficeRows(string $path): array
    {
        $sql = file_get_contents($path);
        if ($sql === false) {
            throw new RuntimeException('Could not read offices.sql.');
        }

        preg_match_all('/INSERT INTO `offices`.*?\) VALUES\s*(.*?);/s', $sql, $statements);
        $rows = [];

        foreach ($statements[1] ?? [] as $statement) {
            foreach (preg_split('/\R/', $statement) ?: [] as $line) {
                $line = trim($line);
                if (! preg_match('/^\((.*)\)[,;]?$/', $line, $match)) continue;

                $row = $this->parseTuple($match[1]);
                if (count($row) !== 15) {
                    throw new RuntimeException('An offices.sql row does not have the expected 15 fields.');
                }
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /** @return array<int, int|string|null> */
    private function parseTuple(string $tuple): array
    {
        $values = [];
        $value = '';
        $quoted = false;
        $wasQuoted = false;
        $length = strlen($tuple);

        for ($index = 0; $index < $length; $index++) {
            $character = $tuple[$index];

            if ($quoted && $character === '\\' && $index + 1 < $length) {
                $escaped = $tuple[++$index];
                $value .= match ($escaped) {
                    '0' => "\0", 'b' => "\x08", 'n' => "\n", 'r' => "\r", 't' => "\t", 'Z' => "\x1a", default => $escaped,
                };
                continue;
            }

            if ($character === "'") {
                if ($quoted && ($tuple[$index + 1] ?? null) === "'") {
                    $value .= "'";
                    $index++;
                    continue;
                }
                $quoted = ! $quoted;
                $wasQuoted = true;
                continue;
            }

            if ($character === ',' && ! $quoted) {
                $values[] = $this->castValue($value, $wasQuoted);
                $value = '';
                $wasQuoted = false;
                continue;
            }

            $value .= $character;
        }

        $values[] = $this->castValue($value, $wasQuoted);

        return $values;
    }

    private function castValue(string $value, bool $wasQuoted): int|string|null
    {
        $value = trim($value);
        if (! $wasQuoted && strtoupper($value) === 'NULL') return null;
        if (! $wasQuoted && is_numeric($value)) return (int) $value;

        return $value;
    }

    /** @param \Illuminate\Support\Collection<int, array<int, int|string|null>> $rows
     *  @return array<int, int>
     */
    private function targetIds(string $table, $rows): array
    {
        $existingSourceIds = DB::table($table)->whereNotNull('directory_source_id')->pluck('id', 'directory_source_id');
        $existingCodes = DB::table($table)->whereNotNull('code')->pluck('id', 'code');
        $nextId = ((int) DB::table($table)->max('id')) + 1;
        $ids = [];

        foreach ($rows as $row) {
            $sourceId = (int) $row[0];
            $code = (string) $row[1];
            $ids[$sourceId] = (int) ($existingSourceIds->get($sourceId) ?? $existingCodes->get($code) ?? $nextId++);
        }

        return $ids;
    }
}
