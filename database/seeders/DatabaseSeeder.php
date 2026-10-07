<?php

namespace Database\Seeders;

use App\Models\ActionType;
use App\Models\Division;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\PurposeType;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $office = Office::firstOrCreate([
            'name' => 'Central Office',
            'short_name' => 'CO',
            'code' => 'CENTRAL',
        ]);

        $division = Division::firstOrCreate([
            'office_id' => $office->id,
            'name' => 'Records Management',
            'code' => 'RM',
        ]);

        $carTmsdOfficeId = Office::query()->where('code', 'CAR-TMSD')->value('id') ?? $office->id;

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
                'name' => 'Admin Staff User',
                'username' => 'admin.staff',
                'email' => 'admin.staff@dots.local',
                'role' => 'Admin Staff',
                'role_id' => 3,
            ],
            [
                'name' => 'Encoder User',
                'username' => 'encoder',
                'email' => 'encoder@dots.local',
                'role' => 'Encoder',
                'role_id' => 14,
            ],            
            [
                'name' => 'JOHN MARK BALEROSO ANUNCIADO',
                'username' => 'jmbannunciado1',
                'firstname' => 'JOHN MARK',
                'middlename' => 'BALEROSO',
                'lastname' => 'ANUNCIADO',
                'extensionname' => null,
                'email' => 'jmarkanunciado1@gmail.com',
                'agency_employee_no' => 'EMP-78466',
                'division_code' => 'DIV-4824',
                'division' => null,
                'region_code' => '13',
                'office_code' => 'CAR-TMSD',
                'office_id' => $carTmsdOfficeId,
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
                'agency_employee_no' => 'EMP-2967',
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
                'agency_employee_no' => 'EMP-2970',
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
                'agency_employee_no' => 'EMP-2971',
                'division_code' => 'DIV-4854',
                'division' => 'AS - GENERAL SERVICES DIVISION',
                'region_code' => '13',
                'office_code' => 'BSO-439',
                'role' => 'Admin Staff',
                'role_id' => 3,
            ],
        ];

        $accounts = collect($seedAccounts)->mapWithKeys(function (array $account) use ($office, $division) {
            $accountOfficeId = $account['office_id']
                ?? Office::query()->where('code', $account['office_code'] ?? '')->value('id')
                ?? $office->id;
            $accountDivisionId = array_key_exists('division_id', $account) ? $account['division_id'] : $division->id;
            $accountIdentity = filled($account['agency_employee_no'] ?? null)
                ? ['agency_employee_no' => $account['agency_employee_no']]
                : ['username' => $account['username']];

            $user = User::updateOrCreate(
                $accountIdentity,
                [
                    ...[
                        'office_id' => $accountOfficeId,
                        'division_id' => $accountDivisionId,
                    ],
                    ...$account,
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'is_locked' => false,
                ],
            );
            $user->forceFill(['email_verified_at' => now()])->save();

            return [$account['role_id'] => $user];
        });

        $incomingLetterType = DocumentType::firstOrCreate(['name' => 'Incoming Letter']);
        DocumentType::firstOrCreate(['name' => 'Others']);
        $reviewActionType = ActionType::firstOrCreate(['name' => 'Review']);
        ActionType::firstOrCreate(['name' => 'Others']);
        $referencePurposeType = PurposeType::firstOrCreate(['name' => 'Reference']);
        PurposeType::firstOrCreate(['name' => 'Others']);

        // Document::firstOrCreate(
        //     ['tracking_number' => 'DOC-1001'],
        //     [
        //         'title' => 'Pilot Document',
        //         'document_type_id' => $incomingLetterType->id,
        //         'action_type_id' => $reviewActionType->id,
        //         'purpose_type_id' => $referencePurposeType->id,
        //         'office_id' => $office->id,
        //         'division_id' => $division->id,
        //         'created_by' => $accounts[1]->id,
        //         'status' => 'pending',
        //         'received_from' => 'External Office',
        //         'received_at' => now(),
        //         'is_archived' => false,
        //         'remarks' => 'Initial sample document for the new DOTS scaffold.',
        //     ],
        // );
    }
}
