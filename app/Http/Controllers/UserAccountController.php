<?php

namespace App\Http\Controllers;

use App\Models\BureauLegacy;
use App\Models\Division;
use App\Models\DivisionLegacy;
use App\Models\Office;
use App\Models\User;
use App\Models\UserLegacy;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UserAccountController extends Controller
{
    public function index()
    {
        $legacyOffices = BureauLegacy::query()->get(['bureauId', 'longName'])->keyBy('bureauId');
        $legacyDivisions = DivisionLegacy::query()->get(['divisionId', 'longName'])->keyBy('divisionId');

        $legacyUsers = UserLegacy::query()
            ->select([
                'userUuid', 'username', 'firstname', 'lastname', 'middlename', 'extensionname',
                'role', 'emailAddress', 'status', 'lastLoggedInTime', 'bureauId', 'divisionId',
            ])
            ->orderBy('lastname')
            ->orderBy('firstname')
            ->get()
            ->map(function (UserLegacy $user) use ($legacyOffices, $legacyDivisions) {
                $name = collect([$user->firstname, $user->middlename, $user->lastname, $user->extensionname])
                    ->filter(fn ($part) => filled($part))
                    ->implode(' ');

                return [
                    'id' => $user->userUuid,
                    'name' => $name ?: ($user->username ?? ''),
                    'email' => $user->emailAddress ?? '',
                    'username' => $user->username ?? '',
                    'role' => (string) ($user->role ?? 'user'),
                    'office_id' => $user->bureauId,
                    'office_name' => $legacyOffices->get($user->bureauId)?->longName ?? '',
                    'division_id' => $user->divisionId,
                    'division_name' => $legacyDivisions->get($user->divisionId)?->longName ?? '',
                    'is_active' => in_array(strtolower((string) $user->status), ['1', 'active', 'y'], true),
                    'last_login_at' => $user->lastLoggedInTime?->toDateTimeString(),
                    'source' => 'Old DB',
                ];
            });

        $users = User::query()
            ->with(['office:id,name', 'division:id,name'])
            ->select(['id', 'name', 'email', 'role', 'office_id', 'division_id', 'is_active', 'last_login_at'])
            ->orderBy('name')
            ->get();

        return Inertia::render('UserAccounts/Index', [
            'users' => [
                ...$legacyUsers->toArray(),
                ...$users->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? 'user',
                    'office_id' => $user->office_id,
                    'office_name' => $user->office?->name ?? '',
                    'division_id' => $user->division_id,
                    'division_name' => $user->division?->name ?? '',
                    'is_active' => (bool) $user->is_active,
                    'last_login_at' => $user->last_login_at?->toDateTimeString(),
                    'source' => 'New DB',
                ])->toArray(),
            ],
            'offices' => Office::query()->orderBy('name')->get(['id', 'name']),
            'divisions' => Division::query()->orderBy('name')->get(['id', 'name', 'office_id']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'string', 'max:50'],
            'office_id' => ['nullable', 'exists:offices,id'],
            'division_id' => ['nullable', 'exists:divisions,id'],
            'is_active' => ['required', 'boolean'],
        ]);

        User::create($validated);

        return redirect()->route('user-accounts.index')->with('success', 'User account added.');
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'string', 'max:50'],
            'office_id' => ['nullable', 'exists:offices,id'],
            'division_id' => ['nullable', 'exists:divisions,id'],
            'is_active' => ['required', 'boolean'],
        ]);

        if (blank($validated['password'] ?? null)) {
            unset($validated['password']);
        }

        $user->update($validated);

        return redirect()->route('user-accounts.index')->with('success', 'User account updated.');
    }
}
