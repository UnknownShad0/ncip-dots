<?php

namespace Database\Seeders;

use App\Models\PurposeType;
use Illuminate\Database\Seeder;

class PurposeTypeSeeder extends Seeder
{
    public function run(): void
    {
        // Snapshot of the legacy purpose_type table; keep its original names and statuses.
        $types = [
            [
                'name' => 'Signing',
                'description' => '',
                'is_active' => false,
            ],
            [
                'name' => 'For Revision',
                'description' => 'for revision',
                'is_active' => true,
            ],
            [
                'name' => 'Others',
                'description' => 'Others',
                'is_active' => true,
            ],
            [
                'name' => 'For Compliance',
                'description' => 'For reviewing',
                'is_active' => true,
            ],
            [
                'name' => 'For Dissemination',
                'description' => 'For dissemination ',
                'is_active' => true,
            ],
            [
                'name' => 'For Appropriate Action',
                'description' => 'For Immediate Action',
                'is_active' => true,
            ],
            [
                'name' => 'For Approval',
                'description' => 'For Approval',
                'is_active' => true,
            ],
            [
                'name' => 'For Comments',
                'description' => 'For Comments',
                'is_active' => true,
            ],
            [
                'name' => 'For Recommendation',
                'description' => 'For Recommendation',
                'is_active' => true,
            ],
            [
                'name' => 'For Information/File',
                'description' => 'For Information/File',
                'is_active' => true,
            ],
            [
                'name' => 'Please prepare reply',
                'description' => 'Please prepare reply',
                'is_active' => true,
            ],
            [
                'name' => 'Please note and return',
                'description' => 'Please note and return',
                'is_active' => true,
            ],
            [
                'name' => 'Please file',
                'description' => 'Please file',
                'is_active' => false,
            ],
            [
                'name' => 'RUSH/URGENT',
                'description' => 'RUSH/URGENT',
                'is_active' => true,
            ],
            [
                'name' => 'For Review',
                'description' => 'For Review',
                'is_active' => true,
            ],
            [
                'name' => 'For Release',
                'description' => 'For Release',
                'is_active' => true,
            ],
            [
                'name' => 'For Digital Signature',
                'description' => 'This document is for digital signature.',
                'is_active' => true,
            ],
        ];

        foreach ($types as $type) {
            PurposeType::updateOrCreate(
                ['name' => $type['name']],
                [
                    'description' => $type['description'],
                    'is_active' => $type['is_active'],
                ],
            );
        }
    }
}
