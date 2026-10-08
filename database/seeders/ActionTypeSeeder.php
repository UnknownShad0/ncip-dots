<?php

namespace Database\Seeders;

use App\Models\ActionType;
use Illuminate\Database\Seeder;

class ActionTypeSeeder extends Seeder
{
    public function run(): void
    {
        // Snapshot of the legacy action_type table; keep its original names and statuses.
        $types = [
            [
                'name' => 'Approved',
                'description' => '',
                'is_active' => false,
            ],
            [
                'name' => 'Disapproved',
                'description' => '',
                'is_active' => false,
            ],
            [
                'name' => 'Revised',
                'description' => 'Revised the Document',
                'is_active' => false,
            ],
            [
                'name' => 'Forwarded ',
                'description' => 'Forwarded ',
                'is_active' => true,
            ],
            [
                'name' => 'Received by Records',
                'description' => 'Received by Records',
                'is_active' => false,
            ],
            [
                'name' => 'Others',
                'description' => 'Others',
                'is_active' => true,
            ],
            [
                'name' => 'Received',
                'description' => 'Received by the office',
                'is_active' => false,
            ],
            [
                'name' => 'For Release',
                'description' => 'For Release',
                'is_active' => true,
            ],
        ];

        foreach ($types as $type) {
            ActionType::updateOrCreate(
                ['name' => $type['name']],
                [
                    'description' => $type['description'],
                    'is_active' => $type['is_active'],
                ],
            );
        }
    }
}
