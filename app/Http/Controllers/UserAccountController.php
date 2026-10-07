<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Office;
use App\Models\User;
use App\Models\UserLegacy;
use App\Services\HrisDirectory;
use App\Notifications\UserAccountCreated;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserAccountController extends Controller
{
    private const ACTIVE_OFFICE_STATUSES = ['1', 'active', 'Active', 'enabled', 'Enabled', 'Y', 'y'];

    public function lookupEmployee(Request $request, HrisDirectory $directory)
    {
        $validated = $request->validate(['agency_employee_no' => ['required', 'string', 'max:100']]);
        $request->session()->forget('hris_employee_lookup');
        try {
            $result = $directory->lookup($validated['agency_employee_no']);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['message' => 'Employee directory is unavailable. Please check the HRIS configuration or try again.'], 502);
        }
        if (! $result) {
            return response()->json(['message' => 'No employee found for that Agency Employee Number.'], 404);
        }
        $request->session()->put('hris_employee_lookup', $result);
        return response()->json($result);
    }

    public function index()
    {
        $offices = BureauLegacy::query()
            ->whereIn('status', self::ACTIVE_OFFICE_STATUSES)
            ->orderBy('longName')
            ->get(['bureauId', 'longName', 'officeEmail'])
            ->map(fn (BureauLegacy $office) => ['id' => (int) $office->bureauId, 'name' => $office->longName, 'email' => trim((string) $office->officeEmail)]);
        $officeTableOptions = Office::query()
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'email'])
            ->map(fn (Office $office) => ['id' => 'new-'.$office->id, 'code' => $office->code, 'name' => $office->name, 'email' => $office->email, 'source' => 'New DB'])
            ->values();
        $legacyOfficeTableOptions = BureauLegacy::query()
            ->whereIn('status', self::ACTIVE_OFFICE_STATUSES)
            ->orderBy('longName')
            ->get(['bureauId', 'officeCode', 'longName', 'officeEmail'])
            ->map(fn (BureauLegacy $office) => [
                'id' => 'legacy-'.$office->bureauId,
                'code' => $office->officeCode,
                'name' => $office->longName,
                'email' => trim((string) $office->officeEmail),
                'source' => 'Legacy DB',
            ]);
        $officeTableOptions = $legacyOfficeTableOptions->concat($officeTableOptions)
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values();
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
                    'lastname' => $user->lastname ?? '',
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

        $localUsers = User::query()->with(['office', 'officeByCode'])
            ->orderBy('name')
            ->get()
            ->map(function (User $user) use ($officeNames, $roleOptions) {
                $roleId = (int) ($user->role_id ?? 0);
                $roleName = $roleOptions->firstWhere('id', $roleId)['name'] ?? ($user->role ?: 'User');

                return [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'firstname' => $user->firstname ?? '',
                    'lastname' => $user->lastname ?? '',
                    'email' => $user->email,
                    'username' => $user->username ?? '',
                    'role_id' => $user->role_id === null ? '' : (string) $user->role_id,
                    'role' => $roleName,
                    'agency_employee_no' => $user->agency_employee_no,
                    'office_id' => $user->legacy_office_id,
                    'office_name' => $user->officeByCode?->name ?? $user->office?->name ?? $officeNames->get($user->legacy_office_id) ?? '',
                    'is_active' => (bool) $user->is_active,
                    'is_locked' => (bool) $user->is_locked,
                    'logged_in_status' => 'N',
                    'last_login_at' => $user->last_login_at?->toDateTimeString(),
                    'source' => 'Local DB',
                ];
            });

        return Inertia::render('UserAccounts/Index', [
            'users' => $legacyUsers->concat($localUsers)->values(),
            'offices' => $offices,
            'officeTableOptions' => $officeTableOptions,
            'roles' => $roleOptions,
        ]);
    }

    public function store(Request $request)
    {
        $type = $request->validate(['account_type' => ['required', 'in:dots,employee']])['account_type'];
        if ($type === 'employee') {
            $validated = $request->validate([
                'operation' => ['required', 'in:create'],
                'agency_employee_no' => ['required', 'string', 'max:100', 'unique:users,agency_employee_no'],
                'email' => ['required', 'email', 'max:255', 'unique:users,email'],
                'office_code' => ['required', 'string', 'max:100'],
                'office_table_id' => ['required', 'string'],
                'employee_role' => ['required', Rule::in(['super admin', 'executive', 'admin staff'])],
            ]);
            $lookup = $request->session()->get('hris_employee_lookup');
            if (! $lookup || ($lookup['employee']['agency_employee_no'] ?? null) !== $validated['agency_employee_no']) {
                throw ValidationException::withMessages(['user' => 'Search for the employee successfully before saving.']);
            }
            $employee = $lookup['employee'];
            $directoryOffice = collect($lookup['offices'])->firstWhere('office_code', $validated['office_code']);
            if (! $directoryOffice) {
                throw ValidationException::withMessages(['office_code' => 'Select an office returned by the employee directory.']);
            }
            validator($employee, [
                'username' => ['required', 'string', 'max:50', 'unique:users,username'],
                'first_name' => ['required', 'string', 'max:100'],
                'last_name' => ['required', 'string', 'max:100'],
            ])->validate();
            [$office, $bureauId] = $this->resolveSelectedOffice($validated['office_table_id']);
            if (! $office) {
                throw ValidationException::withMessages([
                    'office_table_id' => 'Select a valid office from the Office module.',
                ]);
            }
            $bureauId ??= BureauLegacy::query()->where('officeCode', $office->code)->value('bureauId');
            $attributes = [
                'firstname' => $employee['first_name'], 'lastname' => $employee['last_name'],
                'middlename' => $employee['middle_name'] ?? null, 'extensionname' => $employee['ext_name'] ?? null,
                'agency_employee_no' => $employee['agency_employee_no'],
                'username' => $employee['username'], 'email' => $validated['email'],
                'division_code' => $employee['division_code'] ?? null,
                'region_code' => $directoryOffice['region_code'], 'office_code' => $office->code,
                'office_id' => $office->id, 'legacy_office_id' => $bureauId,
                'role' => $validated['employee_role'],
                'role_id' => $this->employeeRoleId($validated['employee_role']),
            ];
        } else {
            $validated = $request->validate([
                'operation' => ['required', 'in:create'],
                'username' => ['required', 'string', 'max:50', 'unique:users,username'],
                'firstname' => ['required', 'string', 'max:100'],
                'lastname' => ['required', 'string', 'max:100'],
                'role_id' => ['required', 'integer', Rule::in($this->roleIds())],
                'officeId' => ['required', 'integer', Rule::exists('legacy.bureau', 'bureauId')->whereIn('status', self::ACTIVE_OFFICE_STATUSES)],
            ]);
            $role = DB::connection('legacy')->table('role')->where('roleId', $validated['role_id'])->value('rolename');
            $bureau = BureauLegacy::query()->findOrFail($validated['officeId']);
            $email = trim((string) $bureau->officeEmail);
            $validator = validator(['office_email' => $email], ['office_email' => ['required', 'email', 'max:255', 'unique:users,email']]);
            if ($validator->fails()) {
                throw ValidationException::withMessages(['officeId' => 'The selected office needs a valid email that is not already assigned to another account.']);
            }
            $office = Office::query()->firstOrCreate(
                ['name' => $bureau->longName],
                ['short_name' => $bureau->shortName, 'code' => $bureau->officeCode, 'email' => $bureau->officeEmail],
            );
            $attributes = [
                'firstname' => $validated['firstname'], 'lastname' => $validated['lastname'],
                'username' => $validated['username'], 'email' => $email,
                'role' => $role ?: 'user', 'role_id' => (int) $validated['role_id'],
                'office_id' => $office->id, 'office_code' => $office->code,
                'legacy_office_id' => (int) $validated['officeId'],
            ];
        }
        $user = User::query()->create(array_merge($attributes, [
            'name' => trim(implode(' ', array_filter([
                $attributes['firstname'], $attributes['middlename'] ?? null,
                $attributes['lastname'], $attributes['extensionname'] ?? null,
            ]))),
            'password' => null,
            'is_active' => true, 'is_locked' => false,
        ]));
        if ($type === 'employee') {
            $request->session()->forget('hris_employee_lookup');
        }

        try {
            $token = Password::broker()->createToken($user);
            $setupUrl = route('password.reset', ['token' => $token, 'username' => $user->username]);
            $user->notify(new UserAccountCreated($setupUrl));
        } catch (\Throwable $exception) {
            report($exception);
            return redirect()->route('user-accounts.index')->with('warning', 'Account created, but the password setup email could not be sent. Ask the user to use Forgot password to set a password.');
        }

        return redirect()->route('user-accounts.index')->with('success', 'User account added.');
    }

    public function update(Request $request, int $id)
    {
        $user = User::query()->findOrFail($id);
        $validated = $request->validate([
            'operation' => ['required', 'in:update'],
            'username' => ['required', 'string', 'max:50', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['nullable', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'firstname' => ['required', 'string', 'max:100'],
            'lastname' => ['required', 'string', 'max:100'],
            'role_id' => [Rule::requiredIf(! $user->agency_employee_no), 'nullable', 'integer', Rule::in($this->roleIds())],
            'employee_role' => [Rule::requiredIf((bool) $user->agency_employee_no), 'nullable', Rule::in(['super admin', 'executive', 'admin staff'])],
            'officeId' => [Rule::requiredIf(! $user->agency_employee_no || $user->legacy_office_id !== null), 'nullable', 'integer', Rule::exists('legacy.bureau', 'bureauId')->whereIn('status', self::ACTIVE_OFFICE_STATUSES)],
            'status' => ['required', Rule::in(['1', '0'])],
            'isLocked' => ['required', Rule::in(['Y', 'N'])],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $roleId = $user->agency_employee_no ? $this->employeeRoleId($validated['employee_role']) : (int) $validated['role_id'];
        $role = $user->agency_employee_no ? $validated['employee_role'] : DB::connection('legacy')->table('role')->where('roleId', $roleId)->value('rolename');
        $bureau = filled($validated['officeId'] ?? null) ? BureauLegacy::query()->findOrFail($validated['officeId']) : null;
        $office = $bureau ? Office::query()->firstOrCreate(
            ['name' => $bureau->longName],
            ['short_name' => $bureau->shortName, 'code' => $bureau->officeCode, 'email' => $bureau->officeEmail],
        ) : $user->office;
        $user->fill([
            'name' => trim($validated['firstname'].' '.$validated['lastname']),
            'firstname' => $validated['firstname'],
            'lastname' => $validated['lastname'],
            'role' => $role ?: 'user',
            'role_id' => $roleId,
            'office_id' => $office?->id,
            'office_code' => $office?->code ?? $user->office_code,
            'legacy_office_id' => $bureau?->bureauId ?? $user->legacy_office_id,
            'is_active' => $validated['status'] === '1',
            'is_locked' => $validated['isLocked'] === 'Y',
        ]);

        if (filled($validated['password'] ?? null)) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return redirect()->route('user-accounts.index')->with('success', 'User account updated.');
    }

    private function employeeRoleId(string $role): ?int
    {
        $id = DB::connection('legacy')->table('role')->whereRaw('LOWER(TRIM(rolename)) = ?', [$role])->value('roleId');

        return $id === null ? null : (int) $id;
    }

    private function resolveSelectedOffice(string $selection): array
    {
        if (preg_match('/^new-(\d+)$/', $selection, $matches)) {
            return [Office::query()->find((int) $matches[1]), null];
        }

        if (! preg_match('/^legacy-(\d+)$/', $selection, $matches)) {
            return [null, null];
        }

        $bureau = BureauLegacy::query()
            ->where('bureauId', (int) $matches[1])
            ->whereIn('status', self::ACTIVE_OFFICE_STATUSES)
            ->first();

        if (! $bureau) {
            return [null, null];
        }

        $attributes = [
            'short_name' => $bureau->shortName,
            'code' => $bureau->officeCode,
            'email' => $bureau->officeEmail,
        ];
        $office = filled($bureau->officeCode)
            ? Office::query()->firstOrCreate(['code' => $bureau->officeCode], ['name' => $bureau->longName, ...$attributes])
            : Office::query()->firstOrCreate(['name' => $bureau->longName], $attributes);

        return [$office, (int) $bureau->bureauId];
    }

    private function roleIds(): array
    {
        return DB::connection('legacy')->table('role')->pluck('roleId')
            ->map(fn ($role) => (int) $role)
            ->all();
    }
}
