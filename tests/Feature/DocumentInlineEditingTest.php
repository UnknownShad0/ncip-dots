<?php

namespace Tests\Feature;

use App\Models\{DocumentCreationDraft, DocumentType, Office, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentInlineEditingTest extends TestCase
{
    use RefreshDatabase;

    public function test_spaces_around_inline_marks_survive_save_update_and_reopen(): void
    {
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $this->actingAs(User::factory()->create());
        $nodes = [
            ['type' => 'text', 'text' => 'John '],
            ['type' => 'text', 'text' => 'Mark', 'marks' => [['type' => 'bold']]],
            ['type' => 'text', 'text' => ' '],
            ['type' => 'text', 'text' => ' Molina ', 'marks' => [['type' => 'italic']]],
            ['type' => 'text', 'text' => 'reports.'],
        ];
        $payload = ['document_type_id' => $type->id, 'content' => [
            'from' => ' Sender ', 'subject' => ' Spacing ',
            'body_document' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'content' => $nodes]]],
        ]];
        $this->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $this->putJson('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $draft->refresh();
        $this->assertSame('Sender', $draft->content['from']);
        $this->assertSame('John Mark  Molina reports.', $draft->content['body']);
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        $this->assertSame($nodes, $props['draftToEdit']['content']['body_document']['content'][0]['content']);
        $html = app(\App\Services\DocumentPdf::class)->html($draft->title, $draft->content);
        $this->assertStringContainsString('John <strong>Mark</strong> <em> Molina </em>reports.', $html);
        $this->postJson('/document-creation/preview', $payload)->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_recipient_label_round_trips_and_empty_optional_rows_are_hidden(): void
    {
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $this->actingAs(User::factory()->create());
        $payload = ['document_type_id' => $type->id, 'content' => [
            'recipient_label' => 'TO', 'for' => 'John Mark', 'for_position' => 'Director',
            'from' => 'Sender', 'subject' => 'Recipient labels', 'body' => 'Test body.',
        ]];
        $this->post('/document-creation', $payload)->assertSessionHasNoErrors();
        $draft = DocumentCreationDraft::firstOrFail();
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        $this->assertSame('TO', $props['draftToEdit']['content']['recipient_label']);
        $pdf = app(\App\Services\DocumentPdf::class);
        $html = $pdf->html($draft->title, $draft->content);
        $this->assertStringContainsString('<th>TO</th>', $html);
        $this->assertStringContainsString('Director', $html);
        $this->assertStringNotContainsString('<th>FOR</th>', $html);

        unset($payload['content']['recipient_label']);
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $this->assertStringContainsString('<th>FOR</th>', $pdf->html($draft->title, $draft->fresh()->content));
        $payload['content']['for'] = '';
        $payload['content']['for_position'] = '';
        $this->put('/document-creation/'.$draft->id, $payload)->assertSessionHasNoErrors();
        $html = $pdf->html($draft->title, $draft->fresh()->content);
        foreach (['FOR', 'TO', 'THRU', 'ATTENTION'] as $label) $this->assertStringNotContainsString('<th>'.$label.'</th>', $html);
        $this->assertStringContainsString('<th>FROM</th>', $html);

        $payload['content']['recipient_label'] = 'INVALID';
        $this->putJson('/document-creation/'.$draft->id, $payload)->assertUnprocessable()->assertJsonValidationErrors('content.recipient_label');
    }

    public function test_save_returns_draft_identity_and_preserves_inline_content_on_reopen(): void
    {
        $user = User::factory()->create(['office_id' => Office::create(['name' => 'Office'])->id]);
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $content = ['for' => 'Office A', 'from' => 'Office B', 'subject' => 'Inline editing', 'date' => '2026-10-10', 'body' => "First paragraph.\n\nSecond paragraph.", 'cc' => ['Office C', 'Office D']];
        $this->actingAs($user)->post('/document-creation', ['document_type_id' => $type->id, 'title' => 'Memo', 'content' => $content])
            ->assertSessionHasNoErrors()->assertSessionHas('savedDraftId');
        $draft = DocumentCreationDraft::firstOrFail();
        $this->assertSame($draft->id, session('savedDraftId'));
        $this->assertSame($content['body'], $draft->content['body']);
        $content['body'] .= "\nRevised text.";
        $this->put('/document-creation/'.$draft->id, ['document_type_id' => $type->id, 'title' => 'Memo revised', 'content' => $content])
            ->assertSessionHasNoErrors()->assertSessionHas('savedDraftId', $draft->id);
        $this->assertSame(1, DocumentCreationDraft::count());
        $props = $this->get('/document-creation?edit_draft_id='.$draft->id)->assertOk()->viewData('page')['props'];
        $this->assertSame($content['body'], $props['draftToEdit']['content']['body']);
        $this->assertSame($content['cc'], $props['draftToEdit']['content']['cc']);
    }

    public function test_long_document_exports_to_multiple_pages_with_reserved_header_and_footer(): void
    {
        $html = view('documents.generated', ['title' => 'Long document',
            'header' => 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/header.png'))),
            'content' => ['from' => 'Sender', 'subject' => 'Pagination', 'body' => str_repeat("A long document must continue on another page.\n", 130)]])->render();
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('letter');
        $pdf->output();
        $this->assertGreaterThan(1, $pdf->getDomPDF()->getCanvas()->get_page_count());
        $this->assertStringContainsString('margin: 1.71875in .65in 1.75in', $html);
        $this->assertStringContainsString('header { position: fixed;', $html);
        $this->assertStringContainsString('footer { position: fixed;', $html);
    }

    public function test_generated_document_template_preserves_line_breaks_and_escapes_user_text(): void
    {
        $html = view('documents.generated', ['title' => 'Memo', 'header' => 'data:image/png;base64,example',
            'content' => ['from' => 'Sender', 'subject' => 'Test', 'body' => "First\n\n<script>alert(1)</script>", 'cc' => ['A', 'B']]])->render();
        $this->assertStringContainsString('National Commission on Indigenous Peoples', $html);
        $this->assertStringContainsString("First\n\n&lt;script&gt;alert(1)&lt;/script&gt;", $html);
        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('<th>THRU</th>', $html);
    }
}
