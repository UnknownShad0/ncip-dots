<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Builds a read-only plan; writes only to the default connection when applied. */
class LegacyDirectoryImport
{
    public function plan(bool $unassignMismatchedDivisions = false): array
    {
        $target = DB::connection();
        $source = DB::connection('legacy');
        if ($target->getDriverName() === 'mysql' && $target->getDatabaseName() === $source->getDatabaseName()) {
            throw new RuntimeException('Source and target database names must differ.');
        }
        $rows = [];
        foreach (['ranges', 'offices', 'divisions', 'users'] as $table) {
            $rows[$table] = $target->table($table)->get()->map(fn ($row) => (array) $row)->all();
        }
        $legacy = $source->transaction(function () use ($source) {
            $data = [];
            foreach (['rangeregion', 'bureau', 'division', 'user', 'role'] as $table) {
                $data[$table] = $source->table($table)->get();
            }

            return $data;
        });
        $operations = [];
        $counts = [];
        $warnings = [];
        $zeroDates = 0;
        $date = function ($value) use (&$zeroDates) {
            if ($value !== null && str_starts_with($value, '0000-')) {
                $zeroDates++;

                return null;
            }

            return $value;
        };
        $nextId = -1;
        $normal = fn ($v) => mb_strtolower(trim((string) $v));
        $register = function ($table, $column, $identity, $attrs, $matches, $links = []) use (&$rows, &$operations, &$counts, &$nextId) {
            $linked = array_values(array_filter($rows[$table], fn ($r) => isset($r[$column]) && (string) $r[$column] === (string) $identity));
            $candidates = $linked ?: array_values(array_filter($rows[$table], $matches));
            if (count($candidates) > 1) {
                throw new RuntimeException("Ambiguous match: $table legacy ID $identity.");
            }
            if ($candidates) {
                $record = $candidates[0];
                if (isset($record[$column]) && (string) $record[$column] !== (string) $identity) {
                    throw new RuntimeException("Identity conflict: $table legacy ID $identity.");
                }
                if ($linked) {
                    $counts[$table]['unchanged'] = ($counts[$table]['unchanged'] ?? 0) + 1;

                    return $record['id'];
                }
                $changes = [$column => $identity];
                foreach ($links as $key => $value) {
                    if (($record[$key] ?? null) !== null && (string) $record[$key] !== (string) $value) {
                        throw new RuntimeException("Assignment conflict: $table legacy ID $identity ($key).");
                    }
                    $changes[$key] = $value;
                }
                $operations[] = ['table' => $table, 'id' => $record['id'], 'values' => $changes, 'insert' => false];
                foreach ($rows[$table] as &$r) {
                    if ($r['id'] === $record['id']) {
                        $r = array_replace($r, $changes);
                    }
                }
                unset($r);
                $counts[$table]['linked'] = ($counts[$table]['linked'] ?? 0) + 1;

                return $record['id'];
            }
            $id = $nextId--;
            $values = array_replace($attrs, [$column => $identity]);
            $rows[$table][] = array_replace($values, ['id' => $id]);
            $operations[] = ['table' => $table, 'id' => $id, 'values' => $values, 'insert' => true];
            $counts[$table]['insert'] = ($counts[$table]['insert'] ?? 0) + 1;

            return $id;
        };
        $rangeMap = $rangeNames = [];
        foreach ($legacy['rangeregion'] as $r) {
            $name = $normal($r->name);
            if (isset($rangeNames[$name])) {
                throw new RuntimeException('Duplicate legacy range name.');
            }
            $rangeNames[$name] = $r->id;
            $rangeMap[$r->id] = $register('ranges', 'legacy_range_id', $r->id, [
                'name' => $r->name, 'is_active' => in_array($normal($r->status), ['active', '1'], true),
            ], fn ($row) => $normal($row['name']) === $name);
        }
        $officeMap = [];
        foreach ($legacy['bureau'] as $b) {
            $range = $rangeNames[$normal($b->range)] ?? null;
            if (! $range) {
                if (! in_array($normal($b->range), ['', 'select range office'], true)) {
                    throw new RuntimeException("Unknown range for bureau $b->bureauId.");
                }
                $warnings[] = "Bureau $b->bureauId has no assigned range.";
            }
            $links = ['range_id' => $range ? $rangeMap[$range] : null, 'legacy_range_id' => $range];
            $officeMap[$b->bureauId] = $register('offices', 'legacy_bureau_id', $b->bureauId, array_merge([
                'name' => $b->longName, 'short_name' => $b->shortName, 'code' => $b->officeCode,
                'email' => $b->officeEmail, 'created_at' => $date($b->dateAdded),
            ], $links), fn ($row) => $normal($row['name']) === $normal($b->longName), $links);
        }
        foreach ($legacy['bureau'] as $b) {
            $parent = $b->parentbureauId ? ($officeMap[$b->parentbureauId] ?? throw new RuntimeException("Missing parent for bureau $b->bureauId.")) : null;
            // Detect cycles in the original hierarchy before writing anything.
            $seen = [$b->bureauId => true];
            $cursor = $b->parentbureauId;
            $bureaus = $legacy['bureau']->keyBy('bureauId');
            while ($cursor) {
                if (isset($seen[$cursor])) {
                    throw new RuntimeException("Bureau hierarchy cycle at $b->bureauId.");
                }
                $seen[$cursor] = true;
                $cursor = $bureaus->get($cursor)?->parentbureauId;
            }
            $id = $officeMap[$b->bureauId];
            $existing = collect($rows['offices'])->firstWhere('id', $id);
            if ($id < 0 || collect($operations)->contains(fn ($op) => $op['table'] === 'offices' && $op['id'] === $id)) {
                if (($existing['parent_id'] ?? null) !== null && $existing['parent_id'] !== $parent) {
                    throw new RuntimeException("Parent conflict for bureau $b->bureauId.");
                }
                if ($parent !== null) {
                    $operations[] = ['table' => 'offices', 'id' => $id, 'values' => ['parent_id' => $parent], 'insert' => false];
                }
            }
        }
        $divisionMap = [];
        foreach ($legacy['division'] as $d) {
            $office = $officeMap[$d->bureauId] ?? throw new RuntimeException("Missing bureau for division $d->divisionId.");
            $divisionMap[$d->divisionId] = $register('divisions', 'legacy_division_id', $d->divisionId, [
                'name' => $d->longName, 'office_id' => $office, 'created_at' => $date($d->dateAdded),
            ], fn ($row) => $normal($row['name']) === $normal($d->longName) && $row['office_id'] === $office, ['office_id' => $office]);
        }
        $roles = $legacy['role']->keyBy('roleId');
        foreach ($legacy['user'] as $u) {
            $office = $officeMap[$u->bureauId] ?? throw new RuntimeException("Missing bureau for user $u->userUuid.");
            $division = $u->divisionId ? ($divisionMap[$u->divisionId] ?? throw new RuntimeException("Missing division for user $u->userUuid.")) : null;
            if ($u->divisionId && (int) $legacy['division']->firstWhere('divisionId', $u->divisionId)->bureauId !== (int) $u->bureauId) {
                if (! $unassignMismatchedDivisions) {
                    throw new RuntimeException("Division/bureau mismatch for user $u->userUuid. Resolve it or explicitly use --unassign-mismatched-divisions.");
                }
                $division = null;
                $warnings[] = "User $u->userUuid: retained bureau; mismatched division left unassigned.";
            }
            $role = $roles->get($u->role) ?? throw new RuntimeException("Unknown role for user $u->userUuid.");
            if (! filled($u->username) || ! filled($u->emailAddress)) {
                throw new RuntimeException("Missing username/email for user $u->userUuid.");
            }
            if (! filter_var($u->emailAddress, FILTER_VALIDATE_EMAIL)) {
                $warnings[] = "User $u->userUuid: legacy email retained but needs correction before email delivery.";
            }
            if (password_get_info($u->password ?? '')['algoName'] !== 'bcrypt') {
                throw new RuntimeException("Unsupported password hash for user $u->userUuid.");
            }
            if (! in_array((string) $u->status, ['1', '2'], true) || ! in_array($u->isLocked, ['Y', 'N'], true)) {
                throw new RuntimeException("Unknown account status for user $u->userUuid.");
            }
            $matches = function ($row) use ($u, $normal) {
                $username = $normal($row['username'] ?? '') === $normal($u->username);
                $email = $normal($row['email']) === $normal($u->emailAddress);
                if ($username xor $email) {
                    throw new RuntimeException("Username/email conflict for legacy user $u->userUuid.");
                }

                return $username && $email;
            };
            $links = ['office_id' => $office, 'legacy_office_id' => $u->bureauId, 'division_id' => $division];
            $register('users', 'legacy_user_uuid', $u->userUuid, array_merge($links, [
                'name' => trim($u->firstname.' '.$u->lastname) ?: $u->username,
                'username' => $u->username, 'email' => $u->emailAddress,
                'firstname' => $u->firstname, 'lastname' => $u->lastname,
                'middlename' => $u->middlename, 'extensionname' => $u->extensionname,
                'role' => $role->rolename, 'role_id' => $u->role,
                'password' => $u->password, // Query builder preserves the existing bcrypt hash verbatim.
                'is_active' => (string) $u->status === '1', 'is_locked' => $u->isLocked === 'Y',
                'created_at' => $date($u->dateCreated), 'last_login_at' => $date($u->lastLoggedInTime),
            ]), $matches, $links);
        }

        if ($zeroDates) {
            $warnings[] = "$zeroDates legacy zero dates mapped to null (unknown date).";
        }

        return compact('operations', 'counts', 'warnings');
    }

    public function apply(array $plan): void
    {
        DB::transaction(function () use ($plan) {
            $ids = [];
            foreach ($plan['operations'] as $op) {
                $values = $op['values'];
                foreach (['parent_id', 'range_id', 'office_id', 'division_id'] as $key) {
                    if (isset($values[$key]) && $values[$key] < 0) {
                        $values[$key] = $ids[$values[$key]] ?? throw new RuntimeException('Unresolved import reference.');
                    }
                }
                $values['updated_at'] = now();
                if ($op['insert']) {
                    if (! array_key_exists('created_at', $values)) {
                        $values['created_at'] = now();
                    }
                    $ids[$op['id']] = DB::table($op['table'])->insertGetId($values);
                } else {
                    DB::table($op['table'])->where('id', $ids[$op['id']] ?? $op['id'])->update($values);
                }
            }
        });
    }
}
