<?php

namespace Tests\Feature;

use App\Models\{DocumentAsset, DocumentCreationDraft, DocumentTemplateVersion, DocumentType, Office, User};
use App\Services\{DocumentPdf, DocumentTemplates, RichDocumentContent};
use Barryvdh\DomPDF\Facade\Pdf;
use Database\Seeders\DocumentTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DynamicDocumentTemplatesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    private function type(): DocumentType
    {
        $type = DocumentType::create(['name' => 'Letter', 'is_active' => true]);
        $this->seed(DocumentTemplateSeeder::class);

        return $type->fresh();
    }

    private function payload(DocumentType $type): array
    {
        return ['document_type_id' => $type->id, 'title' => 'Rich document', 'content' => [
            'for' => 'Recipient', 'from' => 'Sender', 'subject' => 'Formatting', 'date' => '2026-10-14',
            'body' => 'Client fallback must not be trusted',
            'body_document' => $type->defaultTemplateVersion->sample_content['body_document'], 'cc' => ['Records'],
        ]];
    }

    public function test_samples_and_header_mapping_are_available_and_seeding_preserves_assignments(): void
    {
        $type = $this->type();
        $user = User::factory()->create();
        $page = $this->actingAs($user)->get('/document-creation')->assertOk()->viewData('page')['props'];
        $this->assertSame('logos', $page['documentTypes'][0]['template']['header_mode']);
        $this->assertCount(2, $page['documentTypes'][0]['template']['header_images']);
        $url = $page['documentTypes'][0]['template']['header_images'][0]['src'];
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertSame('doc', $page['documentTypes'][0]['sample_content']['body_document']['type']);
        $other = DocumentTemplateVersion::where('template_key', 'ncip-standard')->firstOrFail();
        $type->update(['default_template_version_id' => $other->id]);
        $this->seed(DocumentTemplateSeeder::class);
        $this->assertSame($other->id, $type->fresh()->default_template_version_id);
        $this->assertSame(4, DocumentTemplateVersion::count());
    }

    public function test_rich_content_round_trips_and_server_owns_the_header_snapshot(): void
    {
        $type = $this->type();
        $user = User::factory()->create();
        $payload = $this->payload($type);
        $payload['content']['template_snapshot'] = ['name' => 'Forged header'];
        $payload['content']['html'] = '<script>alert(1)</script>';
        $this->actingAs($user)->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $this->assertSame('Letter sample — two logos', $draft->content['template_snapshot']['name']);
        $this->assertSame(2, $draft->content['schema_version']);
        $this->assertArrayNotHasKey('html', $draft->content);
        $this->assertStringNotContainsString('Client fallback', $draft->content['body']);
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        $this->assertSame($draft->content['body_document'], $props['draftToEdit']['content']['body_document']);
        $this->assertSame('logos', $props['draftToEdit']['content']['template']['header_mode']);
    }

    public function test_saved_headers_and_submitted_content_survive_template_reassignment(): void
    {
        $type = $this->type();
        $office = Office::create(['name' => 'Approval office']);
        $user = User::factory()->create();
        $admin = User::factory()->create(['office_id' => $office->id, 'role_id' => 1, 'is_active' => true]);
        $payload = $this->payload($type);
        $this->actingAs($user)->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $snapshot = $draft->content['template_snapshot'];
        $type->update(['default_template_version_id' => null]);
        $payload['title'] = 'Saved title';
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $this->assertSame($snapshot, $draft->fresh()->content['template_snapshot']);
        $this->post('/document-creation/'.$draft->id.'/submit', ['approver_office_id' => $office->id])->assertSessionHasNoErrors();
        $submitted = $draft->versions()->firstOrFail()->content;
        $this->assertSame($snapshot, $submitted['template_snapshot']);
        $this->assertSame('Saved title', $submitted['document_title']);
        $draft->refresh()->update(['title' => 'Later title', 'content' => ['body' => 'Later body']]);
        $pdf = app(DocumentPdf::class);
        $this->assertSame($submitted, $pdf->approvedContent($draft));
        $this->assertStringContainsString('Saved title', $pdf->html($draft->title, $pdf->approvedContent($draft)));
        $this->actingAs($admin)->get('/document-creation/'.$draft->id.'/preview')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs(User::factory()->create())->get('/document-creation/'.$draft->id.'/preview')->assertForbidden();
    }

    public function test_preview_is_a_pdf_and_does_not_create_a_draft(): void
    {
        $type = $this->type();
        $this->actingAs(User::factory()->create())->postJson('/document-creation/preview', $this->payload($type))
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertSame(0, DocumentCreationDraft::count());
    }

    public function test_unsafe_or_unsupported_rich_content_is_rejected(): void
    {
        $type = $this->type();
        $this->actingAs(User::factory()->create());
        foreach ([
            ['type' => 'image', 'attrs' => ['src' => 'https://example.com/private']],
            ['type' => 'paragraph', 'attrs' => ['textAlign' => 'left; color:red'], 'content' => [['type' => 'text', 'text' => 'Unsafe']]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Unsafe', 'marks' => [['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]]]],
            ['type' => 'table', 'content' => [['type' => 'tableRow', 'content' => [['type' => 'tableCell', 'attrs' => ['colspan' => 2], 'content' => [['type' => 'paragraph']]]]]]],
        ] as $node) {
            $payload = $this->payload($type);
            $payload['content']['body_document'] = ['type' => 'doc', 'content' => [$node]];
            $this->postJson('/document-creation', $payload)->assertUnprocessable()->assertJsonValidationErrors('content.body_document');
        }
        $this->assertSame(0, DocumentCreationDraft::count());
    }

    public function test_table_text_is_escaped_and_long_cells_keep_every_character(): void
    {
        $type = $this->type();
        $rich = app(RichDocumentContent::class);
        $document = $this->payload($type)['content']['body_document'];
        $text = '<script>alert(1)</script> '.str_repeat('ABCDEFGHIJ ', 100).' LAST-CELL-MARKER';
        $document['content'][1]['content'][1]['content'][0]['content'] = [['type' => 'paragraph', 'content' => [
            ['type' => 'text', 'text' => $text, 'marks' => [['type' => 'bold']]],
        ]]];
        $html = $rich->html($document);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringContainsString('<thead>', $html);
        $this->assertStringContainsString('continuation-row', $html);
        $dom = new \DOMDocument;
        @$dom->loadHTML('<meta charset="utf-8">'.$html);
        $firstColumn = '';
        foreach ((new \DOMXPath($dom))->query('//tbody/tr/td[1]') as $cell) $firstColumn .= $cell->textContent;
        $this->assertStringContainsString($text, $firstColumn);
    }

    public function test_long_rich_tables_export_to_multiple_pages(): void
    {
        $type = $this->type();
        $content = $this->payload($type)['content'];
        $rows = &$content['body_document']['content'][1]['content'];
        $sampleRow = $rows[1];
        for ($i = 0; $i < 80; $i++) {
            $row = $sampleRow;
            $row['content'][0]['content'][0]['content'][0]['text'] = 'Activity '.($i + 1);
            $rows[] = $row;
        }
        $content['template_snapshot'] = app(DocumentTemplates::class)->forType($type)['snapshot'];
        $pdf = Pdf::loadHTML(app(DocumentPdf::class)->html('Long table', $content))->setPaper('letter');
        $pdf->output();
        $this->assertGreaterThan(2, $pdf->getDomPDF()->getCanvas()->get_page_count());
    }

    public function test_missing_header_assets_fail_instead_of_changing_the_logo(): void
    {
        $type = $this->type();
        $templates = app(DocumentTemplates::class);
        $snapshot = $templates->forType($type)['snapshot'];
        Storage::disk('local')->delete($snapshot['header_images'][0]['path']);
        $this->expectException(ValidationException::class);
        $templates->presentation($snapshot, true);
    }

    public function test_administrator_can_assign_a_template_but_non_admin_cannot(): void
    {
        $type = $this->type();
        $template = DocumentTemplateVersion::where('template_key', 'ncip-standard')->firstOrFail();
        $data = ['name' => 'Letter', 'is_active' => true, 'default_template_version_id' => $template->id];
        $this->actingAs(User::factory()->create(['role_id' => 14]))->put('/document-types/'.$type->id, $data)->assertForbidden();
        $this->actingAs(User::factory()->create(['role_id' => 1, 'is_active' => true]))->put('/document-types/'.$type->id, $data)->assertSessionHasNoErrors();
        $this->assertSame($template->id, $type->fresh()->default_template_version_id);
    }
}
