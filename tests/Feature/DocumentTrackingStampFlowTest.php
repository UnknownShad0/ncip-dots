<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\Range;
use App\Models\User;
use App\Services\DocumentPdf;
use App\Services\RenderedDocumentPdf;
use App\Services\TrackingNumberPdfStamper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use setasign\Fpdi\Fpdi;
use Tests\TestCase;

class DocumentTrackingStampFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_primary_and_supporting_pdfs_use_the_same_tracking_stamper(): void
    {
        Storage::fake('document_private');
        [$user, $type] = $this->userAndType();
        $calls = [];
        $stamper = Mockery::mock(TrackingNumberPdfStamper::class);
        $stamper->shouldReceive('stamp')->twice()->andReturnUsing(function (string $path, string $number, string $url) use (&$calls): string {
            $calls[] = compact('path', 'number', 'url');

            return "%PDF-1.4\n% stamped {$number}\n";
        });
        $this->app->instance(TrackingNumberPdfStamper::class, $stamper);

        $response = $this->actingAs($user)->post('/documents', [
            'title' => 'Stamped uploads',
            'document_type_id' => $type->id,
            'is_finalized' => true,
            'file' => UploadedFile::fake()->createWithContent('primary.pdf', $this->sourcePdf()),
            'supporting_files' => [UploadedFile::fake()->createWithContent('support.pdf', $this->sourcePdf())],
        ]);

        $response->assertSessionHasNoErrors()->assertRedirect('/documents');
        $document = Document::query()->latest('id')->firstOrFail();
        $this->assertCount(2, $calls);
        $this->assertSame([$document->tracking_number, $document->tracking_number], array_column($calls, 'number'));
        foreach ($calls as $call) {
            $this->assertStringContainsString(rawurlencode($document->tracking_number), $call['url']);
            $this->assertStringContainsString('signature=', $call['url']);
        }
        $this->assertSame(['original', 'supporting'], $document->files()->orderBy('id')->pluck('type')->all());
    }

    public function test_generated_official_pdf_is_rendered_clean_then_stamped_once(): void
    {
        Storage::fake('document_private');
        [$user, $type] = $this->userAndType();
        $draft = DocumentCreationDraft::create([
            'title' => 'Generated memo',
            'document_type_id' => $type->id,
            'created_by' => $user->id,
            'status' => 'ready_for_routing',
            'content' => ['subject' => 'Generated memo'],
        ]);

        $documentPdf = Mockery::mock(DocumentPdf::class);
        $documentPdf->shouldReceive('renderDraft')->once()->with(Mockery::on(fn ($value) => $value->is($draft)))
            ->andReturn(new RenderedDocumentPdf($this->sourcePdf(), ['pages' => 1]));
        $this->app->instance(DocumentPdf::class, $documentPdf);

        $stamper = Mockery::mock(TrackingNumberPdfStamper::class);
        $stamper->shouldReceive('stampBytes')->once()->withArgs(function (string $pdf, string $number, string $url): bool {
            return str_starts_with($pdf, '%PDF-')
                && $number !== ''
                && str_contains($url, rawurlencode($number))
                && str_contains($url, 'signature=');
        })->andReturn("%PDF-1.4\n% unified generated stamp\n");
        $this->app->instance(TrackingNumberPdfStamper::class, $stamper);

        $response = $this->actingAs($user)->post('/documents', [
            'approved_draft_id' => $draft->id,
            'is_finalized' => true,
        ]);

        $response->assertSessionHasNoErrors()->assertRedirect('/documents');
        $document = Document::query()->latest('id')->firstOrFail();
        $file = $document->files()->sole();
        $this->assertSame('original', $file->type);
        $this->assertSame("%PDF-1.4\n% unified generated stamp\n", Storage::disk('document_private')->get($file->file_path));
    }

    public function test_generated_revision_uses_the_same_tracking_stamper(): void
    {
        Storage::fake('document_private');
        [$user, $type] = $this->userAndType();
        $document = Document::create([
            'title' => 'Tracked memo',
            'tracking_number' => 'ORG-26-10-0042',
            'document_type_id' => $type->id,
            'office_id' => $user->office_id,
            'created_by' => $user->id,
            'status' => 'changes_requested',
            'approval_status' => 'changes_requested',
            'is_finalized' => true,
        ]);
        $draft = DocumentCreationDraft::create([
            'title' => 'Tracked memo',
            'document_type_id' => $type->id,
            'created_by' => $user->id,
            'status' => 'revision_requested',
            'version_number' => 1,
            'official_document_id' => $document->id,
            'content' => [
                'from' => 'Origin Office',
                'subject' => 'Tracked memo',
                'body' => 'Original body',
            ],
        ]);

        $documentPdf = Mockery::mock(DocumentPdf::class);
        $documentPdf->shouldReceive('renderDraft')->once()
            ->andReturn(new RenderedDocumentPdf($this->sourcePdf(), ['pages' => 1]));
        $this->app->instance(DocumentPdf::class, $documentPdf);

        $stamper = Mockery::mock(TrackingNumberPdfStamper::class);
        $stamper->shouldReceive('stampBytes')->once()->withArgs(fn (string $pdf, string $number, string $url): bool => str_starts_with($pdf, '%PDF-')
            && $number === $document->tracking_number
            && str_contains($url, $document->tracking_number)
            && str_contains($url, 'signature='))
            ->andReturn("%PDF-1.4\n% unified revision stamp\n");
        $this->app->instance(TrackingNumberPdfStamper::class, $stamper);

        $response = $this->actingAs($user)->post('/document-creation/finalize', [
            'draft_id' => $draft->id,
            'document_type_id' => $type->id,
            'title' => 'Tracked memo',
            'content' => [
                'from' => 'Origin Office',
                'subject' => 'Tracked memo',
                'body' => 'Revised body',
            ],
        ]);

        $response->assertSessionHasNoErrors()->assertRedirect('/document-workflow');
        $file = $document->files()->sole();
        $this->assertSame('version', $file->type);
        $this->assertSame("%PDF-1.4\n% unified revision stamp\n", Storage::disk('document_private')->get($file->file_path));
    }

    private function userAndType(): array
    {
        $range = Range::create(['name' => 'Central']);
        $office = Office::create(['name' => 'Origin', 'short_name' => 'ORG', 'range_id' => $range->id]);
        $user = User::factory()->create([
            'office_id' => $office->id,
            'role_id' => 3,
            'is_active' => true,
        ]);
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);

        return [$user, $type];
    }

    private function sourcePdf(): string
    {
        $pdf = new Fpdi;
        $pdf->AddPage();

        return $pdf->Output('S');
    }
}
