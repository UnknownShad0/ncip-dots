<?php

namespace Database\Seeders;

use App\Models\DocumentType;
use Illuminate\Database\Seeder;

class DocumentTypeSeeder extends Seeder
{
    public function run(): void
    {
        // Snapshot of the legacy document_type table; keep its original names and statuses.
        $documentTypes = [
            [
                'name' => 'Memorandum',
                'description' => '',
                'is_active' => true,
            ],
            [
                'name' => 'Purchase Request',
                'description' => '',
                'is_active' => false,
            ],
            [
                'name' => 'Letter',
                'description' => '',
                'is_active' => true,
            ],
            [
                'name' => 'Purchase Order',
                'description' => '',
                'is_active' => false,
            ],
            [
                'name' => 'Special Order',
                'description' => 'Internal Special Order',
                'is_active' => true,
            ],
            [
                'name' => 'Contract',
                'description' => '',
                'is_active' => true,
            ],
            [
                'name' => 'CNO,CP, FPIC,CLAIM BOOK,WFP',
                'description' => 'CNO,CP, FPIC,CLAIM BOOK,WFP',
                'is_active' => true,
            ],
            [
                'name' => 'Project Proposal',
                'description' => 'PROJECT PROPOSALS',
                'is_active' => true,
            ],
            [
                'name' => 'Certification',
                'description' => 'Certification',
                'is_active' => true,
            ],
            [
                'name' => 'Endorsement',
                'description' => 'ENDORSEMENT',
                'is_active' => true,
            ],
            [
                'name' => 'Sub-allotment Advice',
                'description' => 'SUB-ALLOTMENT ADVICE',
                'is_active' => true,
            ],
            [
                'name' => 'Cases',
                'description' => "a. Supreme Court \r\nb. Court of Appeals\r\nc. Ombudsman\r\nd. RTC\r\ne. DOJ\r\nf. Sandigan Bayan \r\ng. SOL-GEN",
                'is_active' => true,
            ],
            [
                'name' => 'NCIP Cases',
                'description' => "a. ADMIN\r\nb. OJ-Case \r\nc. NSC-Case \r\nd. Appealed Case ",
                'is_active' => false,
            ],
            [
                'name' => 'RELEASING',
                'description' => 'RELEASING',
                'is_active' => false,
            ],
            [
                'name' => 'Incomming',
                'description' => 'INCOMMING',
                'is_active' => false,
            ],
            [
                'name' => 'Disbursement Voucher',
                'description' => 'Disbursement Voucher',
                'is_active' => false,
            ],
            [
                'name' => 'Others',
                'description' => 'Others',
                'is_active' => true,
            ],
            [
                'name' => 'Report',
                'description' => 'Reportorial Documents',
                'is_active' => true,
            ],
            [
                'name' => 'Application for Leave',
                'description' => "Application for Leave\r\n",
                'is_active' => true,
            ],
            [
                'name' => 'Letter of Invitation',
                'description' => 'Letter of Invitation',
                'is_active' => true,
            ],
            [
                'name' => 'Request',
                'description' => 'Request',
                'is_active' => false,
            ],
            [
                'name' => 'Travel Order',
                'description' => 'Travel Order',
                'is_active' => true,
            ],
            [
                'name' => 'Resolution',
                'description' => 'Resolution',
                'is_active' => true,
            ],
            [
                'name' => 'MOA / MOU',
                'description' => 'Memorandum of Agreement, Memorandum of Understanding',
                'is_active' => true,
            ],
            [
                'name' => 'Terms of Reference (TOR)',
                'description' => 'Terms of Reference (TOR)',
                'is_active' => true,
            ],
            [
                'name' => 'Recognition Book',
                'description' => 'Recognition Book',
                'is_active' => true,
            ],
            [
                'name' => 'Legal Advisory',
                'description' => 'Legal Advisory',
                'is_active' => true,
            ],
            [
                'name' => 'Legal Opinion',
                'description' => 'Legal Opinion',
                'is_active' => true,
            ],
            [
                'name' => 'Position Paper',
                'description' => 'Position Paper',
                'is_active' => true,
            ],
            [
                'name' => 'Presidential Complaint Center (PCC)',
                'description' => 'Presidential Complaint Center (PCC)',
                'is_active' => true,
            ],
            [
                'name' => 'EAP Master list',
                'description' => 'EAP Master list',
                'is_active' => true,
            ],
            [
                'name' => 'MBSP Master list',
                'description' => 'MBSP Master list',
                'is_active' => true,
            ],
            [
                'name' => 'PAMANA Master list',
                'description' => 'PAMANA Master list',
                'is_active' => true,
            ],
            [
                'name' => 'Royalty Document',
                'description' => 'Royalty Document',
                'is_active' => true,
            ],
            [
                'name' => 'APP/ASPD',
                'description' => 'APP/ASPD',
                'is_active' => true,
            ],
            [
                'name' => 'ARTA',
                'description' => 'ARTA',
                'is_active' => true,
            ],
            [
                'name' => 'Procurement',
                'description' => 'It includes PR, NOA, BAC RESO, and NTP',
                'is_active' => true,
            ],
        ];

        foreach ($documentTypes as $documentType) {
            DocumentType::updateOrCreate(
                ['name' => $documentType['name']],
                [
                    'description' => $documentType['description'],
                    'is_active' => $documentType['is_active'],
                ],
            );
        }
    }
}
