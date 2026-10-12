<?php

namespace Tests\Feature;

use App\Models\{Document, DocumentType, Office, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DashboardOfficeFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_privileged_roles_filter_both_graphs_without_changing_summary_counts(): void
    {
        $office = Office::create(['name' => 'Origin']);
        $other = Office::create(['name' => 'Other']);
        $empty = Office::create(['name' => 'Empty']);
        $type = DocumentType::create(['name' => 'Memo']);
        $creator = User::factory()->create(['office_id' => $office->id]);
        foreach ([$office, $other] as $index => $origin) {
            $document = Document::create(['title' => 'Test', 'tracking_number' => 'FILTER-'.$index, 'document_type_id' => $type->id, 'office_id' => $origin->id, 'created_by' => $creator->id, 'status' => 'available', 'legacy_doc_id' => $index === 0 ? 100 : null]);
            $document->trails()->create(['from_office_id' => $origin->id, 'to_office_id' => $other->id, 'created_by' => $creator->id, 'status' => 'available']);
        }
        foreach ([1, 2] as $roleId) {
            $this->actingAs(User::factory()->create(['role_id' => $roleId, 'office_id' => $office->id]));
            $this->get('/dashboard')->assertInertia(fn (Assert $page) => $page
                ->where('canFilterCharts', true)->has('chartOffices', 3)
                ->where('selectedChartOfficeId', null)
                ->loadDeferredProps(fn (Assert $deferred) => $deferred->where('analytics.documentTypeCounts.0.count', 2)));
            $this->get('/dashboard?chart_office_id='.$office->id)->assertInertia(fn (Assert $page) => $page
                ->where('selectedChartOfficeId', $office->id)
                ->where('stats.incoming_documents', 2)->where('stats.released_documents', 2)
                ->has('incomingDocuments', 0)
                ->loadDeferredProps(fn (Assert $deferred) => $deferred
                    ->where('analytics.documentTypeCounts.0.count', 1)
                    ->where('analytics.chartStats.incoming_documents', 0)
                    ->where('analytics.chartStats.released_documents', 1)));
            $this->get('/dashboard?chart_office_id='.$empty->id)->assertInertia(fn (Assert $page) => $page
                ->where('selectedChartOfficeId', $empty->id)
                ->loadDeferredProps(fn (Assert $deferred) => $deferred
                    ->has('analytics.documentTypeCounts', 0)
                    ->where('analytics.chartStats.incoming_documents', 0)));
            $this->getJson('/dashboard?chart_office_id=999999')->assertUnprocessable();
            $this->getJson('/dashboard?chart_office_id=invalid')->assertUnprocessable();
        }
    }

    public function test_selected_office_graphs_match_staff_for_documents_from_other_offices(): void
    {
        $office = Office::create(['name' => 'Selected']);
        $other = Office::create(['name' => 'Other']);
        $staff = User::factory()->create(['role_id' => 3, 'office_id' => $office->id]);
        $creator = User::factory()->create(['role_id' => 3, 'office_id' => $other->id]);
        $type = DocumentType::create(['name' => 'Memo']);
        foreach (['incoming', 'pending', 'forwarded', 'archived', 'unrelated'] as $index => $kind) {
            $document = Document::create([
                'title' => $kind, 'tracking_number' => 'SCOPE-'.$index, 'office_id' => $other->id,
                'created_by' => $creator->id, 'document_type_id' => $type->id,
                'is_archived' => $kind === 'archived', 'legacy_doc_id' => $index + 1,
            ]);
            $trail = ['created_by' => $creator->id, 'from_office_id' => $other->id,
                'to_office_id' => $kind === 'unrelated' ? $other->id : $office->id,
                'status' => $kind === 'pending' ? 'pending' : 'available'];
            $document->trails()->create($trail);
            if ($kind === 'forwarded') {
                $document->trails()->create(array_replace($trail, ['from_office_id' => $office->id, 'to_office_id' => $other->id]));
            }
        }
        // Personal access follows this user after a transfer, but is not office history.
        foreach (['draft', 'archived'] as $kind) {
            Document::unguarded(fn () => Document::create([
                'title' => 'Personal '.$kind, 'tracking_number' => 'PERSONAL-'.$kind,
                'office_id' => $other->id, 'created_by' => $staff->id,
                'document_type_id' => $type->id, 'status' => $kind === 'draft' ? 'draft' : 'terminal',
                'is_archived' => $kind === 'archived', 'is_finalized' => false,
                'legacy_doc_id' => $kind === 'archived' ? 100 : null,
            ]));
        }
        $this->assertSame(6, app(\App\Services\DocumentAccess::class)->scope(Document::query(), $staff)->count());
        $expected = ['incoming_documents' => 1, 'pending_documents' => 1, 'released_documents' => 1, 'archived_documents' => 1];
        $this->actingAs($staff)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $deferred) => $deferred
                ->where('analytics.chartStats', $expected)
                ->where('analytics.documentTypeCounts', [['name' => 'Memo', 'count' => 4]])));
        foreach ([1, 2] as $role) {
            $admin = User::factory()->create(['role_id' => $role, 'office_id' => $other->id]);
            $this->actingAs($admin)->get('/dashboard?chart_office_id='.$office->id)->assertInertia(fn (Assert $page) => $page
                ->loadDeferredProps(fn (Assert $deferred) => $deferred
                    ->where('analytics.chartStats', $expected)
                    ->where('analytics.documentTypeCounts', [['name' => 'Memo', 'count' => 4]])));
        }
    }

    public function test_staff_without_an_office_gets_empty_graphs_not_global_counts(): void
    {
        $staff = User::factory()->create(['role_id' => 3, 'office_id' => null]);
        Document::create(['title' => 'Personal draft', 'tracking_number' => 'NO-OFFICE', 'created_by' => $staff->id, 'status' => 'draft', 'is_finalized' => false]);
        $this->actingAs($staff)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps(fn (Assert $deferred) => $deferred
                ->has('analytics.documentTypeCounts', 0)
                ->where('analytics.chartStats', ['incoming_documents' => 0, 'pending_documents' => 0, 'released_documents' => 0, 'archived_documents' => 0])));
    }

    public function test_regular_users_cannot_filter_or_fetch_other_offices_graph_data(): void
    {
        $own = Office::create(['name' => 'Own']);
        $other = Office::create(['name' => 'Other']);
        $user = User::factory()->create(['role_id' => 3, 'office_id' => $own->id]);
        Document::create(['title' => 'Private', 'tracking_number' => 'PRIVATE', 'office_id' => $other->id, 'created_by' => $user->id, 'status' => 'pending', 'is_finalized' => true]);
        $this->actingAs($user)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
            ->where('canFilterCharts', false)->has('chartOffices', 0)
            ->loadDeferredProps(fn (Assert $deferred) => $deferred->has('analytics.documentTypeCounts', 0)));
        $this->get('/dashboard?chart_office_id='.$other->id)->assertForbidden();
    }
}
