<?php

namespace Database\Seeders;

use App\Models\Division;
use App\Models\Office;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $seedAccounts = [
            [
                'name' => 'System Admin',
                'username' => 'system.admin',
                'email' => 'admin@dots.local',
                'role' => 'System Admin',
                'role_id' => 1,
            ],
            [
                'name' => 'Executive User',
                'username' => 'executive',
                'email' => 'executive@dots.local',
                'role' => 'Executive',
                'role_id' => 2,
            ],
            [
                'name' => 'JOHN MARK BALEROSO ANUNCIADO',
                'username' => 'jmbannunciado1',
                'firstname' => 'JOHN MARK',
                'middlename' => 'BALEROSO',
                'lastname' => 'ANUNCIADO',
                'extensionname' => null,
                'email' => 'jmarkanunciado1@gmail.com',
                'employee_code' => 'EMP-11111',
                'division_code' => 'DIV-4824',
                'division' => null,
                'region_code' => '13',
                'office_code' => 'CAR-TMSD',
                'legacy_office_id' => 46,
                'division_id' => null,
                'role' => 'Admin Staff',
                'role_id' => 3,
            ],
            [
                'name' => 'HASEL SUGOT DELMAS',
                'username' => 'hsdelmas',
                'firstname' => 'HASEL',
                'middlename' => 'SUGOT',
                'lastname' => 'DELMAS',
                'extensionname' => null,
                'email' => 'hsdelmas@dots.local',
                'employee_code' => 'EMP-12149',
                'division_code' => 'DIV-4954',
                'division' => 'CAR - PROVINCIAL OFFICE, BAGUIO',
                'region_code' => '14',
                'office_code' => 'BSO-299',
                'role' => 'Super Admin',
                'role_id' => 1,
            ],
            [
                'name' => 'TANYA PAULA NORADA LAPITAN-CAMPUED',
                'username' => 'tpnlapitancampued',
                'firstname' => 'TANYA PAULA',
                'middlename' => 'NORADA',
                'lastname' => 'LAPITAN-CAMPUED',
                'extensionname' => null,
                'email' => 'tpnlapitancampued@dots.local',
                'employee_code' => 'EMP-12152',
                'division_code' => 'DIV-4868',
                'division' => 'OC - OFFICE OF THE CLERK OF THE COMMISSION',
                'region_code' => '13',
                'office_code' => 'BSO-442',
                'role' => 'Executive',
                'role_id' => 2,
            ],
            [
                'name' => 'SHIELA GRACE ESCORA ANOG',
                'username' => 'sgeanog',
                'firstname' => 'SHIELA GRACE',
                'middlename' => 'ESCORA',
                'lastname' => 'ANOG',
                'extensionname' => null,
                'email' => 'sgeanog@dots.local',
                'employee_code' => 'EMP-12153',
                'division_code' => 'DIV-4854',
                'division' => 'AS - GENERAL SERVICES DIVISION',
                'region_code' => '13',
                'office_code' => 'BSO-439',
                'role' => 'Admin Staff',
                'role_id' => 3,
            ],
        ];

        foreach ($seedAccounts as $account) {
            $accountOfficeId = Office::query()
                ->where('code', $account['office_code'] ?? 'CENTRAL')
                ->value('id');
            $accountDivisionId = array_key_exists('division_id', $account)
                ? $account['division_id']
                : ($accountOfficeId === null ? null : Division::query()
                    ->where('office_id', $accountOfficeId)
                    ->where('code', $account['division_code'] ?? 'RM')
                    ->value('id'));
            $accountIdentity = filled($account['employee_code'] ?? null)
                ? ['employee_code' => $account['employee_code']]
                : ['username' => $account['username']];

            $user = User::updateOrCreate(
                $accountIdentity,
                [
                    ...$account,
                    'office_id' => $accountOfficeId,
                    'division_id' => $accountDivisionId,
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'is_locked' => false,
                ],
            );
            $user->forceFill(['email_verified_at' => now()])->save();

        }
    }
}
