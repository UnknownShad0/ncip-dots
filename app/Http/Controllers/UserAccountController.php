<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Office;
use App\Models\User;
use App\Models\UserLegacy;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserAccountController extends Controller
{
    private const ACTIVE_OFFICE_STATUSES = ['1', 'active', 'Active', 'enabled', 'Enabled', 'Y', 'y'];

    public function index()
    {
        $offices = BureauLegacy::query()
            ->whereIn('status', self::ACTIVE_OFFICE_STATUSES)
            ->orderBy('longName')
            ->get(['bureauId', 'longName'])
            ->map(fn (BureauLegacy $office) => ['id' => (int) $office->bureauId, 'name' => $office->longName]);
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

        $localUsers = User::query()
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
                    'office_id' => $user->legacy_bureau_id,
                    'office_name' => $officeNames->get($user->legacy_bureau_id) ?? '',
                    'is_active' => (bool) $user->is_active,
                    'is_locked' => (bool) $user->is_locked,
                    'logged_in_status' => 'N',
                    'last_login_at' => $user->last_login_at?->toDateTimeString(),
                    'source' => 'Local DB',
                ];
            });

        return Inertia::render('UserAccounts/Index', [
            'users' => $legacyUsers->concat($localUsers)->values(),
            // 'offices' => $offices,
            'roles' => $roleOptions,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'operation' => ['required', 'in:create'],
            'username' => ['required', 'string', 'max:50', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'firstname' => ['required', 'string', 'max:100'],
            'lastname' => ['required', 'string', 'max:100'],
            'role_id' => ['required', 'integer', Rule::in($this->roleIds())],
            'officeId' => ['required', 'integer', Rule::exists('legacy.bureau', 'bureauId')->whereIn('status', self::ACTIVE_OFFICE_STATUSES)],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $role = DB::connection('legacy')->table('role')->where('roleId', $validated['role_id'])->value('rolename');
        $bureau = BureauLegacy::query()->findOrFail($validated['officeId']);
        $office = Office::query()->firstOrCreate(
            ['name' => $bureau->longName],
            ['short_name' => $bureau->shortName, 'code' => $bureau->officeCode, 'email' => $bureau->officeEmail],
        );
        User::query()->create([
            'name' => trim($validated['firstname'].' '.$validated['lastname']),
            'username' => $validated['username'],
            'firstname' => $validated['firstname'],
            'lastname' => $validated['lastname'],
            'email' => $validated['email'],
            'role' => $role ?: 'user',
            'role_id' => (int) $validated['role_id'],
            'office_id' => $office->id,
            'legacy_bureau_id' => (int) $validated['officeId'],
            'password' => Hash::make($validated['password']),
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
            'lastname' => ['required', 'string', 'max:100'],
            'role_id' => ['required', 'integer', Rule::in($this->roleIds())],
            'officeId' => ['required', 'integer', Rule::exists('legacy.bureau', 'bureauId')->whereIn('status', self::ACTIVE_OFFICE_STATUSES)],
            'status' => ['required', Rule::in(['1', '0'])],
            'isLocked' => ['required', Rule::in(['Y', 'N'])],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
        ]);

        $role = DB::connection('legacy')->table('role')->where('roleId', $validated['role_id'])->value('rolename');
        $bureau = BureauLegacy::query()->findOrFail($validated['officeId']);
        $office = Office::query()->firstOrCreate(
            ['name' => $bureau->longName],
            ['short_name' => $bureau->shortName, 'code' => $bureau->officeCode, 'email' => $bureau->officeEmail],
        );
        $user->fill([
            'name' => trim($validated['firstname'].' '.$validated['lastname']),
            'firstname' => $validated['firstname'],
            'lastname' => $validated['lastname'],
            'role' => $role ?: 'user',
            'role_id' => (int) $validated['role_id'],
            'office_id' => $office->id,
            'legacy_bureau_id' => (int) $validated['officeId'],
            'is_active' => $validated['status'] === '1',
            'is_locked' => $validated['isLocked'] === 'Y',
        ]);

        if (filled($validated['password'] ?? null)) {
            $user->password = Hash::make($validated['password']);
        }

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
