<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Division;
use App\Models\Office;
use App\Models\User;
use App\Models\UserLegacy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;
use Inertia\Inertia;

class UserAccountController extends Controller
{
    public function lookupEmployee(Request $request)
    {
        $validated = $request->validate([
            'agency_employee_no' => ['required', 'string', 'max:100'],
        ]);
        $api = config('services.employee_directory');

        if (blank($api['token'] ?? null)) {
            return response()->json(['message' => 'Employee directory API token is not configured.'], 503);
        }

        $baseUrl = rtrim($api['url'] ?? '', '/');

        try {
            $employeeResponse = Http::acceptJson()
                ->withToken($api['token'])
                ->timeout(15)
                ->get($baseUrl.'/api/employees', [
                    'agency_employee_no' => $validated['agency_employee_no'],
                ]);

            if ($employeeResponse->status() === 404) {
                return response()->json(['message' => 'No employee was found for that Agency Employee Number.'], 404);
            }

            if (! $employeeResponse->successful()) {
                return response()->json(['message' => 'The employee directory could not complete the lookup.'], 502);
            }

            $employee = $this->firstApiRecord($employeeResponse->json(), $validated['agency_employee_no']);

            if (! $employee) {
                return response()->json(['message' => 'No employee was found for that Agency Employee Number.'], 404);
            }

            $divisionCode = $employee['division_code'] ?? null;
            $officeRecords = [];

            if (filled($divisionCode)) {
                $officeResponse = Http::acceptJson()
                    ->withToken($api['token'])
                    ->timeout(15)
                    ->get($baseUrl.'/api/offices', ['division_code' => $divisionCode]);

                if (! $officeResponse->successful()) {
                    return response()->json(['message' => 'Employee details were found, but office details could not be loaded.'], 502);
                }

                $officeRecords = $this->apiRecords($officeResponse->json());
            }

            $officeRecords = collect($officeRecords)
                ->filter(function (array $office) use ($divisionCode) {
                    $divisions = $office['divisions'] ?? null;
                    if (! is_array($divisions)) return true;

                    return collect($divisions)->contains(fn ($division) => is_array($division)
                        && strcasecmp((string) ($division['code'] ?? $division['division_code'] ?? ''), (string) $divisionCode) === 0);
                })
                ->values()
                ->all();

            $localOffices = Office::query()->get(['id', 'code', 'name']);
            $offices = collect($officeRecords)->map(function (array $office) use ($localOffices) {
                $region = is_array($office['region'] ?? null) ? $office['region'] : [];
                $officeCode = (string) $this->apiValue($office, ['office_code', 'officeCode', 'code']);
                $officeName = $this->apiValue($office, ['office_name', 'officeName', 'name']);
                $localOffice = $localOffices->first(function (Office $candidate) use ($officeCode, $officeName) {
                    $matchesCode = filled($officeCode) && strcasecmp(trim((string) $candidate->code), trim($officeCode)) === 0;
                    $matchesName = filled($officeName) && strcasecmp(trim((string) $candidate->name), trim($officeName)) === 0;

                    return $matchesCode || $matchesName;
                });

                return [
                    'region_code' => $this->apiValue($office, ['region_code', 'regionCode']) ?: $this->apiValue($region, ['code', 'region_code']),
                    'region_name' => $this->apiValue($office, ['region_name', 'regionName']) ?: $this->apiValue($region, ['name', 'region_name']),
                    'office_code' => $officeCode,
                    'office_name' => $officeName,
                    'office_id' => $localOffice?->id,
                ];
            })->values();

            return response()->json([
                'employee' => [
                    'employee_id' => $employee['employee_id'] ?? '',
                    'employee_code' => $employee['employee_code'] ?? '',
                    'username' => $employee['username'] ?? '',
                    'email_address' => $employee['email_address'] ?? '',
                    'first_name' => $employee['first_name'] ?? '',
                    'middle_name' => $employee['middle_name'] ?? '',
                    'last_name' => $employee['last_name'] ?? '',
                    'ext_name' => $employee['ext_name'] ?? '',
                    'agency_employee_no' => $employee['agency_employee_no'] ?? $validated['agency_employee_no'],
                    'division_code' => $divisionCode ?? '',
                    'division' => $employee['division'] ?? '',
                ],
                'offices' => $offices,
            ]);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'Could not connect to the employee directory. Please try again.'], 502);
        }
    }

    private function firstApiRecord(mixed $payload, string $employeeNumber): ?array
    {
        $records = $this->apiRecords($payload);
        $matched = collect($records)->first(fn (array $record) =>
            strcasecmp(trim((string) ($record['agency_employee_no'] ?? '')), trim($employeeNumber)) === 0
        );

        return $matched ?? (count($records) === 1 ? $records[0] : null);
    }

    private function apiRecords(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        for ($depth = 0; $depth < 4; $depth++) {
            $nested = false;

            foreach (['data', 'employees', 'offices', 'employee', 'result', 'items', 'value'] as $key) {
                if (array_key_exists($key, $payload) && is_array($payload[$key])) {
                    $payload = $payload[$key];
                    $nested = true;
                    break;
                }
            }

            if (! $nested) break;

            if (array_is_list($payload)) break;
        }

        if (! is_array($payload)) {
            return [];
        }

        if (array_is_list($payload)) {
            return array_values(array_filter($payload, 'is_array'));
        }

        return [$payload];
    }

    private function apiValue(array $record, array $keys): string
    {
        foreach ($keys as $key) {
            if (isset($record[$key]) && is_scalar($record[$key])) {
                return (string) $record[$key];
            }
        }

        return '';
    }

    public function index()
    {
        $officeNames = BureauLegacy::query()->pluck('longName', 'bureauId');

        $roleOptions = DB::connection('legacy')->table('role')
            ->orderBy('rolename')
            ->get(['roleId', 'rolename'])
            ->map(fn ($role) => ['id' => (int) $role->roleId, 'name' => $role->rolename ?: 'Role '.$role->roleId]);

        $legacyUsers = UserLegacy::query()
            ->select([
                'userUuid', 'username', 'firstname', 'lastname', 'middlename', 'extensionname',
                'role', 'emailAddress', 'status', 'isLocked', 'loggedInStatus', 'lastLoggedInTime', 'bureauId',
            ])
            ->orderBy('lastname')
            ->orderBy('firstname')
            ->get()
            ->map(function (UserLegacy $user) use ($officeNames, $roleOptions) {
                $name = collect([$user->firstname, $user->middlename, $user->lastname, $user->extensionname])
                    ->filter(fn ($part) => filled($part))
                    ->implode(' ');
                $roleId = (string) ($user->role ?? '');
                $roleName = $roleOptions->firstWhere('id', (int) $roleId)['name'] ?? ('Role '.$roleId);

                return [
                    'id' => $user->userUuid,
                    'name' => $name ?: ($user->username ?? ''),
                    'firstname' => $user->firstname ?? '',
                    'middlename' => $user->middlename ?? '',
                    'lastname' => $user->lastname ?? '',
                    'extensionname' => $user->extensionname ?? '',
                    'agency_employee_no' => '',
                    'email' => $user->emailAddress ?? '',
                    'username' => $user->username ?? '',
                    'role_id' => $roleId,
                    'role' => $roleName,
                    'office_id' => $user->bureauId,
                    'office_name' => $officeNames->get($user->bureauId) ?? '',
                    'is_active' => in_array(strtolower((string) $user->status), ['1', 'active', 'y'], true),
                    'is_locked' => in_array(strtoupper((string) $user->isLocked), ['1', 'Y', 'LOCKED'], true),
                    'logged_in_status' => $user->loggedInStatus ?? 'N',
                    'last_login_at' => $user->lastLoggedInTime?->toDateTimeString(),
                    'source' => 'Legacy DB',
                ];
            });

        $localUsers = User::query()
            ->with('office:id,name,code')
            ->orderBy('name')
            ->get()
            ->map(function (User $user) use ($officeNames, $roleOptions) {
                $roleId = (int) ($user->role_id ?? 0);
                $roleName = $roleOptions->firstWhere('id', $roleId)['name'] ?? ($user->role ?: 'User');

                return [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'firstname' => $user->firstname ?? '',
                    'middlename' => $user->middlename ?? '',
                    'lastname' => $user->lastname ?? '',
                    'extensionname' => $user->extensionname ?? '',
                    'agency_employee_no' => $user->agency_employee_no ?? '',
                    'email' => $user->email,
                    'username' => $user->username ?? '',
                    'role_id' => $user->role_id === null ? '' : (string) $user->role_id,
                    'role' => $roleName,
                    'office_id' => $user->office_id,
                    'office_name' => $user->office?->name ?? $user->office_code ?? '',
                    'is_active' => (bool) $user->is_active,
                    'is_locked' => (bool) $user->is_locked,
                    'logged_in_status' => 'N',
                    'last_login_at' => $user->last_login_at?->toDateTimeString(),
                    'source' => 'Local DB',
                ];
            });

        return Inertia::render('UserAccounts/Index', [
            'users' => $legacyUsers->concat($localUsers)->values(),
            'roles' => $roleOptions,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'operation' => ['required', 'in:create'],
            'username' => ['required', 'string', 'max:50', 'unique:users,username'],
            'agency_employee_no' => ['required', 'string', 'max:100', 'unique:users,agency_employee_no'],
            'division_code' => ['required', 'string', 'max:100'],
            'region_code' => ['nullable', 'string', 'max:100'],
            'office_code' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'firstname' => ['required', 'string', 'max:100'],
            'middlename' => ['nullable', 'string', 'max:100'],
            'lastname' => ['required', 'string', 'max:100'],
            'extensionname' => ['nullable', 'string', 'max:100'],
            'role_id' => ['required', 'integer', Rule::in($this->roleIds())],
            'officeId' => ['required', 'integer', Rule::exists('offices', 'id')],
        ]);

        $role = DB::connection('legacy')->table('role')->where('roleId', $validated['role_id'])->value('rolename');
        $divisionId = Division::query()->where('code', $validated['division_code'])->value('id');
        if ($divisionId === null) {
            return back()->withErrors(['division_code' => 'This employee division is not present in the local office directory.']);
        }
        User::query()->create([
            'name' => trim(implode(' ', array_filter([$validated['firstname'], $validated['middlename'] ?? null, $validated['lastname'], $validated['extensionname'] ?? null]))),
            'username' => $validated['username'],
            'firstname' => $validated['firstname'],
            'middlename' => $validated['middlename'] ?? null,
            'lastname' => $validated['lastname'],
            'extensionname' => $validated['extensionname'] ?? null,
            'agency_employee_no' => $validated['agency_employee_no'],
            'division_code' => $validated['division_code'] ?? null,
            'region_code' => $validated['region_code'] ?? null,
            'office_code' => $validated['office_code'] ?? null,
            'email' => $validated['email'],
            'role' => $role ?: 'user',
            'role_id' => (int) $validated['role_id'],
            'office_id' => (int) $validated['officeId'],
            'division_id' => (int) $divisionId,
            'password' => Hash::make(Str::random(64)),
            'is_active' => true,
            'is_locked' => false,
        ]);

        return redirect()->route('user-accounts.index')->with('success', 'User account added.');
    }

    public function update(Request $request, int $id)
    {
        $user = User::query()->findOrFail($id);
        $validated = $request->validate([
            'operation' => ['required', 'in:update'],
            'username' => ['required', 'string', 'max:50', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'firstname' => ['required', 'string', 'max:100'],
            'middlename' => ['nullable', 'string', 'max:100'],
            'lastname' => ['required', 'string', 'max:100'],
            'extensionname' => ['nullable', 'string', 'max:100'],
            'role_id' => ['required', 'integer', Rule::in($this->roleIds())],
            'officeId' => ['nullable', 'integer', Rule::exists('offices', 'id')],
            'division_code' => ['nullable', 'string', 'max:100'],
            'region_code' => ['nullable', 'string', 'max:100'],
            'office_code' => ['nullable', 'string', 'max:100'],
            'status' => ['required', Rule::in(['1', '0'])],
            'isLocked' => ['required', Rule::in(['Y', 'N'])],
        ]);

        $role = DB::connection('legacy')->table('role')->where('roleId', $validated['role_id'])->value('rolename');
        $divisionId = filled($validated['division_code'] ?? null)
            ? Division::query()->where('code', $validated['division_code'])->value('id')
            : $user->division_id;
        if (filled($validated['division_code'] ?? null) && $divisionId === null) {
            return back()->withErrors(['division_code' => 'This employee division is not present in the local office directory.']);
        }
        $user->fill([
            'name' => trim(implode(' ', array_filter([$validated['firstname'], $validated['middlename'] ?? null, $validated['lastname'], $validated['extensionname'] ?? null]))),
            'firstname' => $validated['firstname'],
            'middlename' => $validated['middlename'] ?? null,
            'lastname' => $validated['lastname'],
            'extensionname' => $validated['extensionname'] ?? null,
            'role' => $role ?: 'user',
            'role_id' => (int) $validated['role_id'],
            'office_id' => isset($validated['officeId']) ? (int) $validated['officeId'] : $user->office_id,
            'division_id' => $divisionId,
            'division_code' => $validated['division_code'] ?? $user->division_code,
            'region_code' => $validated['region_code'] ?? $user->region_code,
            'office_code' => $validated['office_code'] ?? $user->office_code,
            'is_active' => $validated['status'] === '1',
            'is_locked' => $validated['isLocked'] === 'Y',
        ]);

        $user->save();

        return redirect()->route('user-accounts.index')->with('success', 'User account updated.');
    }

    private function roleIds(): array
    {
        return DB::connection('legacy')->table('role')->pluck('roleId')
            ->map(fn ($role) => (int) $role)
            ->all();
    }
}
