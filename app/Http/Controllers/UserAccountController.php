<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\User;
use App\Services\HrisDirectory;
use App\Notifications\UserAccountCreated;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserAccountController extends Controller
{
    public function lookupEmployee(Request $request, HrisDirectory $directory)
    {
        $validated = $request->validate(['employee_code' => ['required', 'string', 'max:100']]);
        $request->session()->forget('hris_employee_lookup');
        try {
            $result = $directory->lookup($validated['employee_code'], includeOffices: false);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['message' => 'Employee directory is unavailable. Please check the HRIS configuration or try again.'], 502);
        }
        if (! $result) {
            return response()->json(['message' => 'No employee found for that employee code.'], 404);
        }
        $request->session()->put('hris_employee_lookup', $result);
        return response()->json($result);
    }

    public function index()
    {
        $offices = Office::query()
            ->whereHas('users', fn ($query) => $query->where('is_active', true))
            ->orderBy('name')
            ->get(['id', 'name', 'email'])
            ->map(fn (Office $office) => ['id' => $office->id, 'name' => $office->name, 'email' => trim((string) $office->email)]);
        $officeTableOptions = Office::query()
            ->with('range:id,name')
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'email', 'range_id'])
            ->map(function (Office $office) {
                return [
                    'id' => 'new-'.$office->id,
                    'code' => $office->code,
                    'name' => $office->name,
                    'email' => $office->email,
                    'range_name' => $office->range?->name,
                    'source' => 'New DB',
                ];
            })
            ->values();
        $roleOptions = User::query()
            ->whereNotNull('role_id')
            ->select(['role_id', 'role'])
            ->distinct()
            ->orderBy('role')
            ->get()
            ->map(fn (User $user) => ['id' => (int) $user->role_id, 'name' => $user->role ?: 'Role '.$user->role_id])
            ->unique('id')
            ->values();

        $localUsers = User::query()->with(['office', 'officeByCode'])
            ->orderBy('name')
            ->get()
            ->map(function (User $user) use ($roleOptions) {
                $roleId = (int) ($user->role_id ?? 0);
                $roleName = $roleOptions->firstWhere('id', $roleId)['name'] ?? ($user->role ?: 'User');
                $isActive = (bool) $user->is_active;

                return [
                    'id' => (string) $user->id,
                    'name' => $user->name,
                    'firstname' => $user->firstname ?? '',
                    'lastname' => $user->lastname ?? '',
                    'email' => $user->email,
                    'username' => $user->username ?? '',
                    'role_id' => $user->role_id === null ? '' : (string) $user->role_id,
                    'role' => $roleName,
                    'employee_code' => $user->employee_code,
                    'office_id' => $user->office_id,
                    'office_name' => $user->office?->name ?? $user->officeByCode?->name ?? '',
                    'is_active' => $isActive,
                    'account_status' => ! $isActive ? 'Inactive' : ($user->password === null ? 'Pending' : 'Active'),
                    'is_locked' => (bool) $user->is_locked,
                    'logged_in_status' => 'N',
                    'last_login_at' => $user->last_login_at?->toDateTimeString(),
                    'source' => 'New DB',
                ];
            });

        return Inertia::render('UserAccounts/Index', [
            'users' => $localUsers->values(),
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
                'employee_code' => ['required', 'string', 'max:100', 'unique:users,employee_code'],
                'email' => ['required', 'email', 'max:255', 'unique:users,email'],
                'office_table_id' => ['required', 'string'],
                'employee_role' => ['required', Rule::in(['Super Admin', 'Executive', 'Admin Staff'])],
            ]);
            $lookup = $request->session()->get('hris_employee_lookup');
            if (! $lookup || ($lookup['employee']['employee_code'] ?? null) !== $validated['employee_code']) {
                throw ValidationException::withMessages(['user' => 'Search for the employee successfully before saving.']);
            }
            $employee = $lookup['employee'];
            validator($employee, [
                'username' => ['required', 'string', 'max:50', 'unique:users,username'],
                'first_name' => ['required', 'string', 'max:100'],
                'last_name' => ['required', 'string', 'max:100'],
            ])->validate();
            $officeId = preg_match('/^new-(\d+)$/', $validated['office_table_id'], $matches)
                ? (int) $matches[1]
                : null;
            $office = $officeId ? Office::query()->find($officeId) : null;
            if (! $office) {
                throw ValidationException::withMessages([
                    'office_table_id' => 'Select an existing office.',
                ]);
            }
            if (! $office->range) {
                throw ValidationException::withMessages([
                    'office_table_id' => 'Assign a range to this office in the Offices module first.',
                ]);
            }
            $attributes = [
                'firstname' => $employee['first_name'], 'lastname' => $employee['last_name'],
                'middlename' => $employee['middle_name'] ?? null, 'extensionname' => $employee['ext_name'] ?? null,
                'employee_code' => $employee['employee_code'],
                'username' => $employee['username'], 'email' => $validated['email'],
                'division_code' => $employee['division_code'] ?? null,
                'division' => $employee['division'] ?? null,
                'office_code' => $office->code,
                'office_name' => $office->name,
                'office_id' => $office->id,
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
                'officeId' => ['required', 'integer', Rule::exists('offices', 'id')],
            ]);
            $role = User::query()->where('role_id', $validated['role_id'])->value('role');
            $office = Office::query()->findOrFail($validated['officeId']);
            $email = trim((string) $office->email);
            $validator = validator(['office_email' => $email], ['office_email' => ['required', 'email', 'max:255', 'unique:users,email']]);
            if ($validator->fails()) {
                throw ValidationException::withMessages(['officeId' => 'The selected office needs a valid email that is not already assigned to another account.']);
            }
            $attributes = [
                'firstname' => $validated['firstname'], 'lastname' => $validated['lastname'],
                'username' => $validated['username'], 'email' => $email,
                'role' => $role ?: 'user', 'role_id' => (int) $validated['role_id'],
                'office_id' => $office->id, 'office_code' => $office->code,
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
            'role_id' => [Rule::requiredIf(! $user->employee_code), 'nullable', 'integer', Rule::in($this->roleIds())],
            'employee_role' => [Rule::requiredIf((bool) $user->employee_code), 'nullable', Rule::in(['Super Admin', 'Executive', 'Admin Staff'])],
            'officeId' => [Rule::requiredIf(! $user->employee_code), 'nullable', 'integer', 'exists:offices,id'],
            'status' => ['required', Rule::in(['1', '0'])],
            'isLocked' => ['required', Rule::in(['Y', 'N'])],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $roleId = $user->employee_code ? $this->employeeRoleId($validated['employee_role']) : (int) $validated['role_id'];
        $role = $user->employee_code ? $validated['employee_role'] : User::query()->where('role_id', $roleId)->value('role');
        $office = filled($validated['officeId'] ?? null) ? Office::query()->findOrFail($validated['officeId']) : $user->office;
        $user->fill([
            'name' => trim($validated['firstname'].' '.$validated['lastname']),
            'firstname' => $validated['firstname'],
            'lastname' => $validated['lastname'],
            'role' => $role ?: 'user',
            'role_id' => $roleId,
            'office_id' => $office?->id,
            'office_code' => $office?->code ?? $user->office_code,
            'is_active' => $validated['status'] === '1',
            'is_locked' => $validated['isLocked'] === 'Y',
        ]);

        if (filled($validated['password'] ?? null)) {
            $user->password = Hash::make($validated['password']);
        }

        $user->save();

        return redirect()->route('user-accounts.index')->with('success', 'User account updated.');
    }

    private function employeeRoleId(string $role): int
    {
        return match (mb_strtolower(trim($role))) {
            'super admin', 'system admin' => 1,
            'executive' => 2,
            'admin staff' => 3,
        };
    }

    private function roleIds(): array
    {
        return User::query()->whereNotNull('role_id')->distinct()->pluck('role_id')
            ->map(fn ($roleId) => (int) $roleId)
            ->all();
    }
}
