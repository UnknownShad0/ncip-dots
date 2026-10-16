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
        $html = $pdf->html($draft->title, $pdf->approvedContent($draft));
        $this->assertStringNotContainsString('<h1>', $html);
        $this->assertStringContainsString('Formatting', $html);
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

    public function test_document_without_a_title_uses_its_subject_through_registration(): void
    {
        $type = $this->type();
        $office = Office::create(['name' => 'Creator office']);
        $approvalOffice = Office::create(['name' => 'Approval office']);
        $creator = User::factory()->create(['office_id' => $office->id]);
        $approver = User::factory()->create(['office_id' => $approvalOffice->id, 'role_id' => 1, 'is_active' => true]);
        $payload = $this->payload($type);
        unset($payload['title']);

        $this->actingAs($creator)->postJson('/document-creation/preview', $payload)
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertSame(0, DocumentCreationDraft::count());
        $this->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $this->assertSame('Formatting', $draft->title);
        $this->assertDatabaseHas('audit_trails', ['action' => 'document.draft_created', 'model_id' => $draft->id]);

        $payload['content']['subject'] = 'Revised subject';
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $this->assertSame('Revised subject', $draft->fresh()->title);
        $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk();
        $this->assertDatabaseHas('audit_trails', ['action' => 'document.draft_updated', 'model_id' => $draft->id]);

        $payload['content']['subject'] = 'Submitted subject';
        $this->post('/document-creation/submit-current', [
            ...$payload, 'draft_id' => $draft->id, 'approver_office_id' => $approvalOffice->id,
        ])->assertSessionHasNoErrors();
        $draft->refresh();
        $this->assertSame('Submitted subject', $draft->title);
        $this->assertSame('Submitted subject', $draft->versions()->firstOrFail()->content['document_title']);
        $this->actingAs($approver)->post('/document-creation/'.$draft->id.'/decision', [
            'decision' => 'approved', 'version_number' => $draft->version_number,
        ])->assertSessionHasNoErrors();
        $this->actingAs($creator)->post('/document-creation/'.$draft->id.'/register')->assertSessionHasNoErrors();
        $document = \App\Models\Document::findOrFail($draft->fresh()->official_document_id);
        $this->assertSame('Submitted subject', $document->title);
        $this->assertStringStartsWith('Creator-office-', $document->tracking_number);
    }

    public function test_positions_date_text_and_creator_office_survive_reopening_and_submission(): void
    {
        $type = $this->type();
        $office = Office::create(['name' => 'Office of the Chairperson']);
        $otherOffice = Office::create(['name' => 'Review office']);
        $creator = User::factory()->create(['office_id' => $office->id]);
        $reviewer = User::factory()->create(['office_id' => $otherOffice->id, 'role_id' => 1, 'is_active' => true]);
        $payload = $this->payload($type);
        $positions = ['for_position' => 'Chairman', 'thru_position' => 'Executive Director',
            'attention_position' => 'Records Officer', 'from_position' => 'Division Chief'];
        $payload['content'] = [...$payload['content'], ...$positions, 'date' => 'Upon approval',
            'footer_office_name' => 'Untrusted client office'];
        $this->actingAs($creator)->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $this->assertSame($office->name, $draft->content['footer_office_name']);
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        foreach ($positions as $key => $value) {
            $this->assertSame($value, $props['draftToEdit']['content'][$key]);
        }
        $this->assertSame('Upon approval', $props['draftToEdit']['content']['date']);
        $this->assertSame($office->name, $props['footerOfficeName']);

        $creator->update(['office_id' => $otherOffice->id]);
        $this->actingAs($creator->fresh())->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $this->assertSame($office->name, $draft->fresh()->content['footer_office_name']);
        $this->post('/document-creation/'.$draft->id.'/submit', ['approver_office_id' => $otherOffice->id])->assertSessionHasNoErrors();
        $this->actingAs($reviewer)->get('/document-creation/'.$draft->id.'/preview')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $pdf = app(DocumentPdf::class);
        $submitted = $pdf->approvedContent($draft->fresh());
        $this->assertSame($office->name, $submitted['footer_office_name']);
        $html = $pdf->html($draft->title, $submitted);
        $this->assertStringContainsString('<strong>Office of the Chairperson</strong>', $html);
        $this->assertStringNotContainsString('Untrusted client office', $html);
        $this->assertStringContainsString('<div class="position">Chairman</div>', $html);
        $this->assertStringContainsString('Upon approval', $html);
        $this->assertStringContainsString('1614 Quezon Avenue', $html);
        $this->assertStringContainsString('csc@ncip.gov.ph', $html);
    }

    public function test_optional_dates_and_legacy_iso_dates_render_consistently(): void
    {
        $type = $this->type();
        $this->actingAs(User::factory()->create());
        $payload = $this->payload($type);
        unset($payload['content']['date']);
        $this->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $pdf = app(DocumentPdf::class);
        $this->assertStringNotContainsString('<th>DATE</th>', $pdf->html($draft->title, $draft->content));
        $this->assertStringNotContainsString('class="position"', $pdf->html($draft->title, $draft->content));

        $payload['content']['date'] = 'January 01, 2001';
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $this->assertSame('January 01, 2001', $draft->fresh()->content['date']);
        $payload['content']['date'] = '';
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $this->assertSame('', $draft->fresh()->content['date']);

        $content = $draft->fresh()->content;
        $content['date'] = '2001-01-01';
        $draft->update(['content' => $content]);
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        $this->assertSame('January 01, 2001', $props['draftToEdit']['content']['date']);
        $this->assertStringContainsString('January 01, 2001', $pdf->html($draft->title, $content));
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

    public function test_column_widths_survive_save_reopen_and_render_in_print(): void
    {
        $type = $this->type();
        $this->actingAs(User::factory()->create());
        $payload = $this->payload($type);
        $cell = fn ($text, $width, $header = false) => ['type' => $header ? 'tableHeader' : 'tableCell',
            'attrs' => ['colwidth' => [$width]], 'content' => [['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]]]];
        $payload['content']['body_document'] = ['type' => 'doc', 'content' => [['type' => 'table', 'content' => [
            ['type' => 'tableRow', 'content' => [$cell('#', 50, true), $cell('Description', 641, true)]],
            ['type' => 'tableRow', 'content' => [$cell('1', 50), $cell('John Mark reviews '.str_repeat('a detailed document ', 100).'END-MARKER', 641)]],
        ]]]];
        $this->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        $document = $props['draftToEdit']['content']['body_document'];
        foreach ($document['content'][0]['content'] as $row) {
            $this->assertSame([50], $row['content'][0]['attrs']['colwidth']);
            $this->assertSame([641], $row['content'][1]['attrs']['colwidth']);
        }
        $html = app(DocumentPdf::class)->html($draft->title, $draft->fresh()->content);
        $this->assertStringContainsString('width:7.2359%', $html);
        $this->assertStringContainsString('width:92.7641%', $html);
        $this->assertStringContainsString('END-MARKER', $html);
        $this->assertStringContainsString('continuation-row', $html);
        $pdf = Pdf::loadHTML($html)->setPaper('letter');
        $this->assertStringStartsWith('%PDF-', $pdf->output());

        foreach ([[0], [-1], [4000], ['50; color:red'], [40, 50], '50'] as $width) {
            $payload['content']['body_document']['content'][0]['content'][0]['content'][0]['attrs']['colwidth'] = $width;
            $this->postJson('/document-creation', $payload)->assertUnprocessable()->assertJsonValidationErrors('content.body_document');
        }
    }

    public function test_normalizing_column_widths_is_stable_on_repeated_saves(): void
    {
        $cell = fn ($width) => ['type' => 'tableCell', 'attrs' => ['colwidth' => [$width]], 'content' => [['type' => 'paragraph']]];
        $document = ['type' => 'doc', 'content' => [['type' => 'table', 'content' => [
            ['type' => 'tableRow', 'content' => [$cell(44), $cell(647)]],
        ]]]];
        $rich = app(RichDocumentContent::class);
        $normalized = $rich->normalize($document);
        $this->assertSame([44], $normalized['content'][0]['content'][0]['content'][0]['attrs']['colwidth']);
        $this->assertSame($normalized, $rich->normalize($normalized));
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
