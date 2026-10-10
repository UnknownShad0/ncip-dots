<?php

namespace Tests\Feature;

use App\Models\{ActionType, Document, DocumentCreationDraft, DocumentType, Office, Range, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApprovedDocumentReuseTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_document_can_create_independent_submissions_for_two_offices(): void
    {
        Storage::fake('public');
        $range = Range::create(['name' => 'Central']);
        $origin = Office::create(['name' => 'Origin', 'range_id' => $range->id]);
        $officeA = Office::create(['name' => 'A', 'range_id' => $range->id]);
        $officeB = Office::create(['name' => 'B', 'range_id' => $range->id]);
        $creator = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3]);
        $receiverA = User::factory()->create(['office_id' => $officeA->id, 'role_id' => 3, 'is_active' => true]);
        $receiverB = User::factory()->create(['office_id' => $officeB->id, 'role_id' => 3, 'is_active' => true]);
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $action = ActionType::create(['name' => 'For review', 'is_active' => true]);
        $draft = DocumentCreationDraft::create(['title' => 'Approved memo', 'document_type_id' => $type->id,
            'created_by' => $creator->id, 'status' => 'approved', 'content' => ['subject' => 'Reusable', 'body' => 'Approved content']]);
        $records = [];
        foreach ([$officeA, $officeB] as $office) {
            $this->actingAs($creator)->post('/documents', ['approved_draft_id' => $draft->id, 'is_finalized' => true])
                ->assertSessionHasNoErrors()->assertRedirect('/documents');
            $record = Document::latest('id')->firstOrFail();
            $records[] = $record;
            $this->assertSame('pending', $record->status);
            $this->assertSame('Approved memo', $record->title);
            $this->assertSame(1, $record->files()->count());
            Storage::disk('public')->assertExists($record->files()->first()->file_path);
            $this->post('/documents/'.$record->id.'/release', ['action_type_id' => $action->id, 'to_office_id' => $office->id])
                ->assertSessionHasNoErrors()->assertRedirect();
        }
        [$first, $second] = $records;
        $this->assertNotSame($first->tracking_number, $second->tracking_number);
        $this->assertSame(2, Document::count());
        $this->assertSame($first->id, $draft->fresh()->official_document_id);
        $this->assertSame([$first->id, $second->id], $draft->events()->reorder('id')->get()->map(fn ($event) => $event->metadata['document_id'])->all());
        $this->assertSame($officeA->id, $first->fresh()->latestTrail->to_office_id);
        $this->assertSame($officeB->id, $second->fresh()->latestTrail->to_office_id);
        $this->actingAs($receiverA)->post('/documents/'.$first->id.'/receive')->assertSessionHasNoErrors();
        $this->assertSame('available', $second->fresh()->status);
        $this->actingAs($receiverB)->post('/documents/'.$second->id.'/receive')->assertSessionHasNoErrors();
        $this->assertSame('pending', $first->fresh()->status);
        $this->assertSame('pending', $second->fresh()->status);
    }

    public function test_unapproved_or_other_users_documents_cannot_be_reused(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $type = DocumentType::create(['name' => 'Memo']);
        foreach ([['draft', $user], ['registered', $other]] as [$status, $owner]) {
            $draft = DocumentCreationDraft::create(['title' => 'Restricted', 'document_type_id' => $type->id, 'created_by' => $owner->id, 'status' => $status, 'content' => []]);
            $this->actingAs($user)->post('/documents', ['approved_draft_id' => $draft->id, 'is_finalized' => true])->assertUnprocessable();
        }
        $this->assertSame(0, Document::count());
    }
}
