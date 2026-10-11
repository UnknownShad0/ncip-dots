<?php

namespace Tests\Feature;

use App\Models\{DocumentCreationDraft, DocumentType, Office, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentInlineEditingTest extends TestCase
{
    use RefreshDatabase;

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
        $props = $this->get('/document-creation')->assertOk()->viewData('page')['props'];
        $this->assertSame($content['body'], $props['drafts'][0]['content']['body']);
        $this->assertSame($content['cc'], $props['drafts'][0]['content']['cc']);
    }

    public function test_long_document_exports_to_multiple_pages_with_reserved_header_and_footer(): void
    {
        $html = view('documents.generated', ['title' => 'Long document',
            'header' => 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/header.png'))),
            'content' => ['from' => 'Sender', 'subject' => 'Pagination', 'body' => str_repeat("A long document must continue on another page.\n", 130)]])->render();
        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadHTML($html)->setPaper('letter');
        $pdf->output();
        $this->assertGreaterThan(1, $pdf->getDomPDF()->getCanvas()->get_page_count());
        $this->assertStringContainsString('margin: 1.6667in .65in 1.75in', $html);
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
        $this->assertStringNotContainsString('THRU:', $html);
    }
}
