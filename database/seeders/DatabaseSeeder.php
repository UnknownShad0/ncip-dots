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
        ];

        $accounts = collect($seedAccounts)->mapWithKeys(function (array $account) use ($office, $division) {
            $user = User::updateOrCreate(
                ['email' => $account['email']],
                [
                    ...$account,
                    'password' => Hash::make('password'),
                    'office_id' => $office->id,
                    'division_id' => $division->id,
                    'is_active' => true,
                    'is_locked' => false,
                ],
            );
            $user->forceFill(['email_verified_at' => now()])->save();

            return [$account['role_id'] => $user];
        });

        DocumentType::firstOrCreate(['name' => 'Incoming Letter']);
        ActionType::firstOrCreate(['name' => 'Review']);
        PurposeType::firstOrCreate(['name' => 'Reference']);

        Document::firstOrCreate(
            ['tracking_number' => 'DOC-1001'],
            [
                'title' => 'Pilot Document',
                'document_type_id' => DocumentType::first()->id,
                'action_type_id' => ActionType::first()->id,
                'purpose_type_id' => PurposeType::first()->id,
                'office_id' => $office->id,
                'division_id' => $division->id,
                'created_by' => $accounts[1]->id,
                'status' => 'pending',
                'received_from' => 'External Office',
                'received_at' => now(),
                'is_archived' => false,
                'remarks' => 'Initial sample document for the new DOTS scaffold.',
            ],
        );
    }
}
