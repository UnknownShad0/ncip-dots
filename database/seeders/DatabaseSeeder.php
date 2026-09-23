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

        $admin = User::firstOrCreate(
            ['email' => 'admin@dots.local'],
            [
                'name' => 'Admin User',
                'password' => Hash::make('password'),
                'role' => 'admin',
                'office_id' => $office->id,
                'division_id' => $division->id,
                'is_active' => true,
            ],
        );

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
                'created_by' => $admin->id,
                'status' => 'pending',
                'received_from' => 'External Office',
                'received_at' => now(),
                'is_archived' => false,
                'remarks' => 'Initial sample document for the new DOTS scaffold.',
            ],
        );
    }
}
