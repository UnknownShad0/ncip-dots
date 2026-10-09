<?php

namespace App\Support;

use App\Models\DocumentType;
use Illuminate\Support\Collection;

class LegacyDocumentTypeMap
{
    // Original document_type IDs from the legacy snapshot, matched by name in the new database.
    private const NAMES = [
        2 => 'Memorandum',
        3 => 'Purchase Request',
        4 => 'Letter',
        5 => 'Purchase Order',
        7 => 'Special Order',
        8 => 'Contract',
        9 => 'CNO,CP, FPIC,CLAIM BOOK,WFP',
        10 => 'Project Proposal',
        11 => 'Certification',
        12 => 'Endorsement',
        13 => 'Sub-allotment Advice',
        14 => 'Cases',
        15 => 'NCIP Cases',
        16 => 'RELEASING',
        17 => 'Incomming',
        18 => 'Disbursement Voucher',
        19 => 'Others',
        20 => 'Report',
        21 => 'Application for Leave',
        22 => 'Letter of Invitation',
        23 => 'Request',
        24 => 'Travel Order',
        25 => 'Resolution',
        26 => 'MOA / MOU',
        27 => 'Terms of Reference (TOR)',
        28 => 'Recognition Book',
        29 => 'Legal Advisory',
        30 => 'Legal Opinion',
        31 => 'Position Paper',
        32 => 'Presidential Complaint Center (PCC)',
        33 => 'EAP Master list',
        34 => 'MBSP Master list',
        35 => 'PAMANA Master list',
        36 => 'Royalty Document',
        37 => 'APP/ASPD',
        38 => 'ARTA',
        39 => 'Procurement',
    ];

    public static function typesByLegacyId(): Collection
    {
        $types = DocumentType::query()->whereIn('name', self::NAMES)->get(['id', 'name'])->keyBy('name');

        return collect(self::NAMES)
            ->map(fn (string $name) => $types->get($name))
            ->filter();
    }
}
