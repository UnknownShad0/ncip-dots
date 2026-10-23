<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\User;
use App\Services\NotificationCounts;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DocumentArchiveLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private function draft(User $user, string $status): DocumentCreationDraft
    {
        return DocumentCreationDraft::create([
            'created_by' => $user->id, 'document_type_id' => DocumentType::create(['name' => 'Memo'])->id,
            'title' => 'Lifecycle memo', 'content' => ['body' => 'Preserve me'], 'status' => $status,
        ]);
    }

    public function test_generated_archive_preserves_status_and_content_and_restores_to_approved_list(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $draft = $this->draft($user, 'registered');
        $this->actingAs($user)->post(route('document-creation.archive', $draft))->assertRedirect();
        $this->assertNotNull($draft->fresh()->archived_at);
        $this->assertSame('registered', $draft->fresh()->status);
        $this->assertSame(['body' => 'Preserve me'], $draft->fresh()->content);
        $this->get('/approved-documents')->assertInertia(fn (Assert $p) => $p->has('drafts', 0));
        $this->get('/archives?source=generation&search=Lifecycle')->assertInertia(fn (Assert $p) => $p
            ->where('source', 'generation')->where('documents.total', 1)->where('documents.data.0.id', $draft->id));
        $this->post('/documents', ['approved_draft_id' => $draft->id, 'is_finalized' => true])->assertUnprocessable();
        $this->post(route('document-creation.restore', $draft))->assertRedirect();
        $this->assertNull($draft->fresh()->archived_at);
        $this->get('/approved-documents')->assertInertia(fn (Assert $p) => $p->has('drafts', 1));
        $this->assertSame(2, $draft->events()->count());
    }

    public function test_ready_for_routing_generated_document_can_be_archived_and_restored(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $draft = $this->draft($user, 'ready_for_routing');

        $this->actingAs($user)->post(route('document-creation.archive', $draft))->assertRedirect();
        $this->assertNotNull($draft->fresh()->archived_at);
        $this->get('/document-workflow')->assertInertia(fn (Assert $page) => $page
            ->where('readyPagination.total', 0));

        $this->post(route('document-creation.restore', $draft))->assertRedirect();
        $this->assertNull($draft->fresh()->archived_at);
        $this->get('/document-workflow')->assertInertia(fn (Assert $page) => $page
            ->where('readyPagination.total', 1)
            ->where('readyDocuments.0.id', $draft->id));
    }

    public function test_approved_counts_refresh_after_archive_and_restore_with_a_warm_cache(): void
    {
        $user = User::factory()->create(['is_active' => true]);
        $other = User::factory()->create(['is_active' => true]);
        $registered = $this->draft($user, 'registered');
        $this->draft($user, 'approved');
        $this->draft($user, 'draft');
        $this->draft($other, 'approved');
        $deleted = $this->draft($user, 'approved');
        $deleted->delete();
        $counts = app(NotificationCounts::class);
        $before = $counts->forUser($user);
        $this->assertSame(2, $before['approved']);

        $this->actingAs($user)->post(route('document-creation.archive', $registered))->assertRedirect();
        $archived = $counts->forUser($user);
        $this->assertSame(1, $archived['approved']);
        $this->assertSame($before['total'] - 1, $archived['total']);

        $this->post(route('document-creation.restore', $registered))->assertRedirect();
        $restored = $counts->forUser($user);
        $this->assertSame(2, $restored['approved']);
        $this->assertSame($before['total'], $restored['total']);
        $this->get('/approved-documents')->assertInertia(fn (Assert $p) => $p
            ->where('draftsPagination.total', $restored['approved']));
    }

    public function test_generated_actions_enforce_ownership_and_status_and_soft_delete_drafts(): void
    {
        $owner = User::factory()->create(['is_active' => true]);
        $other = User::factory()->create(['is_active' => true]);
        $draft = $this->draft($owner, 'draft');
        $approved = $this->draft($owner, 'approved');
        $this->actingAs($other)->delete(route('document-creation.destroy', $draft))->assertForbidden();
        $this->post(route('document-creation.archive', $approved))->assertForbidden();
        $this->actingAs($owner)->post(route('document-creation.archive', $draft))->assertForbidden();
        $this->delete(route('document-creation.destroy', $approved))->assertForbidden();
        $this->delete(route('document-creation.destroy', $draft))->assertRedirect();
        $this->assertSoftDeleted($draft);
        $this->get('/drafts?source=generation')->assertInertia(fn (Assert $p) => $p->has('drafts', 0));
        $this->post(route('document-creation.archive', $approved))->assertRedirect();
        $this->actingAs($other)->post(route('document-creation.restore', $approved))->assertForbidden();
        $this->get('/archives?source=generation')->assertInertia(fn (Assert $p) => $p->where('documents.total', 0));
    }

    public function test_tracking_drafts_can_be_deleted_but_finalized_records_cannot(): void
    {
        $office = Office::create(['name' => 'Origin']);
        $user = User::factory()->create(['office_id' => $office->id, 'role_id' => 3, 'is_active' => true]);
        $draft = Document::create(['title' => 'Draft', 'tracking_number' => 'D-1', 'office_id' => $office->id,
            'created_by' => $user->id, 'status' => 'draft', 'is_finalized' => false]);
        $this->actingAs($user)->delete(route('documents.destroy', $draft))->assertRedirect();
        $this->assertSoftDeleted($draft);
        $final = Document::create(['title' => 'Final', 'tracking_number' => 'D-2', 'office_id' => $office->id,
            'created_by' => $user->id, 'status' => 'pending', 'is_finalized' => true]);
        $this->delete(route('documents.destroy', $final))->assertForbidden();
    }

    public function test_tracking_restore_retains_history_and_returns_to_terminal_holding_office(): void
    {
        $origin = Office::create(['name' => 'Origin']);
        $holder = Office::create(['name' => 'Holder']);
        $user = User::factory()->create(['office_id' => $holder->id, 'role_id' => 3, 'is_active' => true]);
        $other = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3, 'is_active' => true]);
        $document = Document::create(['title' => 'Tracked', 'tracking_number' => 'T-1', 'office_id' => $origin->id,
            'created_by' => $other->id, 'status' => 'pending', 'is_finalized' => true]);
        $document->trails()->create(['from_office_id' => $origin->id, 'to_office_id' => $holder->id,
            'created_by' => $user->id, 'status' => 'pending', 'action' => 'Received']);
        $this->actingAs($user)->post(route('documents.terminal', $document))->assertRedirect();
        $this->assertNotNull($document->fresh()->archived_at);
        $this->actingAs($other)->post(route('archives.restore', $document))->assertForbidden();
        $this->actingAs($user)->post(route('archives.restore', $document))->assertRedirect();
        $this->assertFalse($document->fresh()->is_archived);
        $this->assertSame('pending', $document->fresh()->status);
        $this->assertSame($holder->id, $document->fresh()->latestTrail->to_office_id);
        $this->assertSame(3, $document->trails()->count());
    }
}
