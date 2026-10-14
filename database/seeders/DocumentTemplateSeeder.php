<?php

namespace Database\Seeders;

use App\Models\DocumentTemplateVersion;
use App\Models\DocumentType;
use App\Services\DocumentTemplates;
use Illuminate\Database\Seeder;

class DocumentTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $assets = app(DocumentTemplates::class);
        $header = $assets->import(public_path('images/header.png'), 'NCIP Standard header', 'full_header');
        $logo = $assets->import(public_path('images/logo/ncip-logo.png'), 'NCIP logo');
        $bagong = $assets->import(public_path('images/bagong-pilipinas.png'), 'Bagong Pilipinas', 'logo');
        $assets->defaultSnapshot();
        $paragraph = fn (string $text, bool $bold = false) => ['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => $text, ...($bold ? ['marks' => [['type' => 'bold']]] : [])],
        ]];
        $row = fn (array $values, bool $heading = false) => ['type' => 'tableRow', 'content' => array_map(fn ($value) => [
            'type' => $heading ? 'tableHeader' : 'tableCell', 'content' => [$paragraph($value)],
        ], $values)];
        $body = ['type' => 'doc', 'content' => [
            $paragraph('Please review the proposed activities and assigned responsibilities below.'),
            ['type' => 'table', 'content' => [
                $row(['Activity', 'Responsible office', 'Target date'], true),
                $row(['Document preparation', '[Office A]', '[Date]']),
                $row(['Review and approval', '[Office B]', '[Date]']),
            ]],
            $paragraph('Kindly submit the required documents on or before the indicated date.', true),
            $paragraph('[AUTHORIZED SIGNATORY]'), $paragraph('[Position / designation]'),
        ]];
        $specs = [
            ['ncip-standard', 'NCIP Standard', null, ['header_mode' => 'image', 'header_asset_ids' => [$header->id]]],
            ['ncip-memorandum', 'Memorandum sample', 'Memorandum', ['header_mode' => 'image', 'header_asset_ids' => [$header->id]]],
            ['ncip-letter', 'Letter sample — two logos', 'Letter', ['header_mode' => 'logos', 'header_asset_ids' => [$logo->id, $bagong->id],
                'header_text' => ['Republic of the Philippines', 'NATIONAL COMMISSION ON INDIGENOUS PEOPLES', '[Office / program name]']]],
            ['ncip-certification', 'Certification sample', 'Certification', ['header_mode' => 'logos', 'header_asset_ids' => [$logo->id],
                'header_text' => ['Republic of the Philippines', 'NATIONAL COMMISSION ON INDIGENOUS PEOPLES', '[Issuing office]']]],
        ];
        foreach ($specs as [$key, $name, $typeName, $layout]) {
            $template = DocumentTemplateVersion::firstOrCreate(['template_key' => $key, 'version' => 1], [
                'name' => $name, 'layout' => [...$layout, 'repeat_header' => false],
                'sample_content' => ['title' => strtoupper($typeName ?? 'DOCUMENT'), 'for' => '[Recipient / office]',
                    'from' => '[Sender / office]', 'subject' => 'Sample document', 'body_document' => $body],
                'is_active' => true,
            ]);
            if ($typeName) {
                DocumentType::where('name', $typeName)->whereNull('default_template_version_id')
                    ->update(['default_template_version_id' => $template->id]);
            }
        }
    }
}
