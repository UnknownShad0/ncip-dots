<?php

namespace Tests\Feature;

use App\Models\ActionType;
use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\Range;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApprovedDocumentForwardingTest extends TestCase
{
    use RefreshDatabase;

    private function scenario(): array
    {
        Storage::fake('public');
        $range = Range::create(['name' => 'Central']);
        $origin = Office::create(['name' => 'Origin', 'range_id' => $range->id]);
        $destination = Office::create(['name' => 'Destination', 'range_id' => $range->id]);
        $user = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3]);
        User::factory()->create(['office_id' => $destination->id, 'is_active' => true]);
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $action = ActionType::create(['name' => 'For review', 'is_active' => true]);
        $draft = DocumentCreationDraft::create(['title' => 'Approved response', 'document_type_id' => $type->id,
            'created_by' => $user->id, 'status' => 'approved', 'content' => ['subject' => 'Response', 'body' => 'Approved content']]);
        $this->actingAs($user)->post('/documents', ['title' => 'Original request', 'document_type_id' => $type->id,
            'is_finalized' => true, 'file' => UploadedFile::fake()->create('original.pdf', 10, 'application/pdf')])->assertSessionHasNoErrors();
        $document = Document::latest('id')->firstOrFail();
        $payload = ['action_type_id' => $action->id, 'to_office_id' => $destination->id,
            'document_source' => 'approved', 'approved_draft_id' => $draft->id];

        return [$document, $draft, $payload];
    }

    public function test_approved_versions_preserve_tracking_and_original_files_for_forwarding_and_release(): void
    {
        [$document, $draft, $payload] = $this->scenario();
        $original = $document->files()->firstOrFail();
        foreach (['For review', 'For release'] as $actionName) {
            ActionType::findOrFail($payload['action_type_id'])->update(['name' => $actionName]);
            $this->post('/documents/'.$document->id.'/release', $payload)->assertSessionHasNoErrors()->assertRedirect();
            $fresh = $document->fresh();
            $this->assertSame($document->tracking_number, $fresh->tracking_number);
            $this->assertSame('Original request', $fresh->title);
            $this->assertSame($document->document_type_id, $fresh->document_type_id);
            $version = $fresh->files()->latest('id')->firstOrFail();
            $this->assertSame('version', $version->type);
            $this->assertSame($fresh->latestTrail->id, $version->document_trail_id);
            $this->assertSame('Approved response.pdf', $version->original_name);
            Storage::disk('public')->assertExists($version->file_path);
            $this->assertStringStartsWith('%PDF-', Storage::disk('public')->get($version->file_path));
            Storage::disk('public')->assertExists($original->file_path);
            // Return custody to the origin to exercise another forwarding operation.
            $document->trails()->create(['from_office_id' => $document->office_id, 'to_office_id' => $document->office_id,
                'created_by' => $document->created_by, 'status' => 'pending']);
            $document->update(['status' => 'pending']);
        }
        $this->assertSame(3, $document->files()->count());
        $this->assertSame(1, Document::count());
        $this->assertSame(2, $draft->events()->where('event', 'Used in document forwarding')->count());
        $this->assertSame(2, AuditTrail::where('action', 'document.version_added')->count());
        $this->assertSame('approved', $draft->fresh()->status);
    }

    public function test_upload_and_current_document_choices_remain_supported(): void
    {
        [$document, $draft, $payload] = $this->scenario();
        unset($payload['approved_draft_id']);
        $payload['document_source'] = 'upload';
        $this->post('/documents/'.$document->id.'/release', $payload)->assertSessionHasErrors('file');
        $this->post('/documents/'.$document->id.'/release', $payload + ['file' => UploadedFile::fake()->create('revision.pdf', 10, 'application/pdf')])->assertSessionHasNoErrors();
        $this->assertSame(2, $document->files()->count());
        $document->trails()->create(['from_office_id' => $document->office_id, 'to_office_id' => $document->office_id,
            'created_by' => $document->created_by, 'status' => 'pending']);
        $document->update(['status' => 'pending']);
        $payload['document_source'] = 'current';
        $this->post('/documents/'.$document->id.'/release', $payload)->assertSessionHasNoErrors();
        $this->assertSame(2, $document->files()->count());
        $this->assertSame('available', $document->fresh()->status);
    }

    public function test_failed_pdf_storage_rolls_back_forwarding(): void
    {
        [$document, $draft, $payload] = $this->scenario();
        $disk = \Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('put')->once()->andReturn(false);
        $disk->shouldReceive('delete')->once()->andReturn(true);
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);
        $this->withoutExceptionHandling();
        try {
            $this->post('/documents/'.$document->id.'/release', $payload);
            $this->fail('Expected a storage failure.');
        } catch (\RuntimeException $exception) {
            $this->assertSame('Could not save the approved document version.', $exception->getMessage());
        }
        $this->assertSame('pending', $document->fresh()->status);
        $this->assertSame(1, $document->trails()->count());
        $this->assertSame(1, $document->files()->count());
        $this->assertSame(0, $draft->events()->count());
        $this->assertSame(0, AuditTrail::where('action', 'document.released')->count());
    }

    public function test_invalid_selections_do_not_forward_or_add_files(): void
    {
        [$document, $draft, $payload] = $this->scenario();
        $other = User::factory()->create();
        foreach (['draft', 'rejected', 'submitted'] as $status) {
            $draft->update(['status' => $status]);
            $this->post('/documents/'.$document->id.'/release', $payload)->assertSessionHasErrors('approved_draft_id');
        }
        $draft->update(['status' => 'approved', 'created_by' => $other->id]);
        $this->post('/documents/'.$document->id.'/release', $payload)->assertSessionHasErrors('approved_draft_id');
        $this->post('/documents/'.$document->id.'/release', array_replace($payload, ['approved_draft_id' => null]))->assertSessionHasErrors('approved_draft_id');
        $this->post('/documents/'.$document->id.'/release', $payload + ['file' => UploadedFile::fake()->create('extra.pdf', 10, 'application/pdf')])->assertSessionHasErrors('file');
        $this->assertSame('pending', $document->fresh()->status);
        $this->assertSame(1, $document->trails()->count());
        $this->assertSame(1, $document->files()->count());
        $this->assertSame(0, AuditTrail::where('action', 'document.released')->count());
    }
}
