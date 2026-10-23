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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApprovedDocumentReuseTest extends TestCase
{
    use RefreshDatabase;

    public function test_approved_document_can_create_independent_submissions_for_two_offices(): void
    {
        Storage::fake('document_private');
        $range = Range::create(['name' => 'Central']);
        $origin = Office::create(['name' => 'Origin', 'range_id' => $range->id]);
        $officeA = Office::create(['name' => 'A', 'range_id' => $range->id]);
        $officeB = Office::create(['name' => 'B', 'range_id' => $range->id]);
        $creator = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3, 'is_active' => true]);
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
            $this->assertSame('registered', $draft->fresh()->status);
            $record = Document::latest('id')->firstOrFail();
            $records[] = $record;
            $this->assertSame('pending', $record->status);
            $this->assertSame('Approved memo', $record->title);
            $this->assertSame(1, $record->files()->count());
            Storage::disk('document_private')->assertExists($record->files()->first()->file_path);
            $this->post('/documents/'.$record->id.'/release', ['action_type_id' => $action->id, 'to_office_id' => $office->id])
                ->assertSessionHasNoErrors()->assertRedirect();
        }
        [$first, $second] = $records;
        $workflowProps = $this->get('/document-workflow')->assertOk()->viewData('page')['props'];
        $this->assertContains($draft->id, collect($workflowProps['readyDocuments'])->pluck('id')->all());
        $documentProps = $this->get('/documents')->assertOk()->viewData('page')['props'];
        $this->assertContains($draft->id, collect($documentProps['approvedDocuments'])->pluck('id')->all());
        $this->assertNotSame($first->tracking_number, $second->tracking_number);
        $this->assertSame(2, Document::count());
        $this->assertSame($first->id, $draft->fresh()->official_document_id);
        $this->assertSame([$first->id, $second->id], $draft->events()->reorder('id')->get()->map(fn ($event) => $event->metadata['document_id'])->all());
        $this->assertSame($officeA->id, $first->fresh()->latestTrail->to_office_id);
        $this->assertSame($officeB->id, $second->fresh()->latestTrail->to_office_id);
        $this->actingAs($receiverA)->post('/documents/'.$first->id.'/receive')->assertSessionHasNoErrors();
        $this->assertSame('pending', $second->fresh()->status);
        $this->actingAs($receiverB)->post('/documents/'.$second->id.'/receive')->assertSessionHasNoErrors();
        $this->assertSame('pending', $first->fresh()->status);
        $this->assertSame('pending', $second->fresh()->status);
        $this->assertSame(2, AuditTrail::where('action', 'document.registered')->count());
        $this->assertSame(2, AuditTrail::where('action', 'document.attachment_uploaded')->count());
        $this->assertSame(2, AuditTrail::where('action', 'document.routed')->count());
        $this->assertSame(2, AuditTrail::where('action', 'document.route_step_received')->count());
        $this->assertSame($officeA->id, AuditTrail::where('action', 'document.route_step_received')
            ->where('model_id', $first->id)->value('actor_office_id'));
    }

    public function test_unapproved_or_other_users_documents_cannot_be_reused(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $other = User::factory()->create(['is_active' => true]);
        $type = DocumentType::create(['name' => 'Memo']);
        foreach ([['draft', $user], ['registered', $other]] as [$status, $owner]) {
            $draft = DocumentCreationDraft::create(['title' => 'Restricted', 'document_type_id' => $type->id, 'created_by' => $owner->id, 'status' => $status, 'content' => []]);
            $this->actingAs($user)->post('/documents', ['approved_draft_id' => $draft->id, 'is_finalized' => true])->assertUnprocessable();
        }
        $this->assertSame(0, Document::count());
    }

    public function test_rejected_first_routing_does_not_consume_the_generated_source(): void
    {
        Storage::fake('document_private');
        $range = Range::create(['name' => 'Central']);
        $origin = Office::create(['name' => 'Origin', 'range_id' => $range->id]);
        $destination = Office::create(['name' => 'Destination', 'range_id' => $range->id]);
        $creator = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3, 'is_active' => true]);
        $approver = User::factory()->create(['office_id' => $destination->id, 'role_id' => 3, 'is_active' => true]);
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $action = ActionType::create(['name' => 'For review', 'is_active' => true]);
        $draft = DocumentCreationDraft::create([
            'title' => 'Reusable after rejection',
            'document_type_id' => $type->id,
            'created_by' => $creator->id,
            'status' => 'approved',
            'content' => ['subject' => 'Reusable', 'body' => 'Approved content'],
        ]);

        $this->actingAs($creator)->post('/documents', ['approved_draft_id' => $draft->id, 'is_finalized' => true])
            ->assertSessionHasNoErrors();
        $first = Document::latest('id')->firstOrFail();
        $this->post('/documents/'.$first->id.'/release', ['action_type_id' => $action->id, 'to_office_id' => $destination->id])
            ->assertSessionHasNoErrors();
        $this->actingAs($approver)->post('/documents/'.$first->id.'/receive')->assertSessionHasNoErrors();
        $this->post('/documents/'.$first->id.'/approval', ['decision' => 'rejected', 'remarks' => 'Use another route.'])
            ->assertSessionHasNoErrors();

        $this->assertSame('rejected', $first->fresh()->approval_status);
        $this->assertSame('registered', $draft->fresh()->status);
        $this->actingAs($creator)->post('/documents', ['approved_draft_id' => $draft->id, 'is_finalized' => true])
            ->assertSessionHasNoErrors();
        $this->assertSame(2, Document::count());
        $this->assertSame($first->id, $draft->fresh()->official_document_id);
    }

    public function test_routed_generated_source_can_be_edited_and_finalized_as_a_new_version(): void
    {
        $office = Office::create(['name' => 'Origin']);
        $creator = User::factory()->create(['office_id' => $office->id, 'role_id' => 3, 'is_active' => true]);
        $type = DocumentType::create(['name' => 'Memo', 'is_active' => true]);
        $tracked = Document::create([
            'title' => 'Original routed memo',
            'tracking_number' => 'ORIGIN-26-10-23-0001',
            'document_type_id' => $type->id,
            'office_id' => $office->id,
            'created_by' => $creator->id,
            'status' => 'pending',
            'approval_status' => 'not_required',
            'is_finalized' => true,
        ]);
        $draft = DocumentCreationDraft::create([
            'title' => 'Original routed memo',
            'document_type_id' => $type->id,
            'created_by' => $creator->id,
            'official_document_id' => $tracked->id,
            'status' => 'registered',
            'version_number' => 1,
            'content' => ['from' => 'Sender', 'subject' => 'Original routed memo', 'body' => 'Original content'],
        ]);
        $draft->versions()->create([
            'version_number' => 1,
            'content' => $draft->content,
            'created_by' => $creator->id,
        ]);

        $this->actingAs($creator)
            ->get('/document-creation?edit_draft_id='.$draft->id)
            ->assertOk();

        $payload = [
            'draft_id' => $draft->id,
            'document_type_id' => $type->id,
            'content' => ['from' => 'Sender', 'subject' => 'Edited for the next route', 'body' => 'Updated reusable content'],
        ];
        $this->post('/document-creation/finalize', $payload)
            ->assertSessionHasNoErrors()
            ->assertRedirect('/document-workflow');

        $draft->refresh();
        $this->assertSame('ready_for_routing', $draft->status);
        $this->assertSame(2, $draft->version_number);
        $this->assertSame($tracked->id, $draft->official_document_id);
        $this->assertSame('Edited for the next route', $draft->title);
        $this->assertSame('Original routed memo', $tracked->fresh()->title);

        $workflowProps = $this->get('/document-workflow')->assertOk()->viewData('page')['props'];
        $ready = collect($workflowProps['readyDocuments'])->firstWhere('id', $draft->id);
        $this->assertTrue($ready['can_edit']);
        $this->assertSame(route('document-creation.preview-submission', $draft), $ready['preview_url']);
    }
}
