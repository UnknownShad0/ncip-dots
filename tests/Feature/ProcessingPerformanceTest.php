<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\User;
use App\Services\ProcessingPerformance;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ProcessingPerformanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_tracking_pairs_receipts_once_excludes_weekends_and_preserves_scope(): void
    {
        $office = Office::create(['name' => 'A']);
        $other = Office::create(['name' => 'B']);
        $user = User::factory()->create(['office_id' => $office->id, 'role_id' => 3]);
        $doc = Document::create(['title' => 'Test', 'tracking_number' => 'PERF-1', 'office_id' => $other->id, 'created_by' => $user->id]);
        foreach ([
            ['pending', 'Received', $other->id, $office->id, '2026-10-09 01:00:00'],
            ['available', 'Released - Review', $office->id, $other->id, '2026-10-12 01:00:00'],
            ['available', 'Released - Review', $office->id, $other->id, '2026-10-13 01:00:00'],
            ['pending', 'Received', $other->id, $office->id, '2026-10-14 01:00:00'],
        ] as [$status, $action, $from, $to, $time]) {
            $trail = $doc->trails()->create(['status' => $status, 'action' => $action, 'from_office_id' => $from, 'to_office_id' => $to, 'created_by' => $user->id]);
            $trail->forceFill(['created_at' => $time])->save();
        }
        $rows = app(ProcessingPerformance::class)->forOffice($office->id);
        $this->assertCount(1, $rows);
        $this->assertEquals(1, $rows[0]['tracking']);
        $this->assertSame(1, $rows[0]['tracking_count']);
        $this->assertNull($rows[0]['approval']);
        $this->assertSame([], app(ProcessingPerformance::class)->forOffice(null));
        $this->actingAs($user)->get('/dashboard')->assertInertia(fn ($page) => $page
            ->has('processingPerformance', 1)->where('processingPerformance.0.office_id', $office->id));
        $this->get('/dashboard?chart_office_id='.$other->id)->assertForbidden();
        foreach ([1, 2] as $role) {
            $admin = User::factory()->create(['office_id' => $other->id, 'role_id' => $role]);
            $this->actingAs($admin)->get('/dashboard')->assertInertia(fn ($page) => $page->has('processingPerformance', 2));
            $this->get('/dashboard?chart_office_id='.$office->id)->assertInertia(fn ($page) => $page
                ->has('processingPerformance', 1)->where('processingPerformance.0.tracking_count', 1));
        }
    }

    public function test_receipt_release_pair_survives_a_history_page_boundary(): void
    {
        $office = Office::create(['name' => 'Paged office']);
        $user = User::factory()->create(['office_id' => $office->id]);
        $document = Document::create(['title' => 'Paged', 'tracking_number' => 'PAGED', 'office_id' => $office->id, 'created_by' => $user->id]);
        $rows = [];
        for ($i = 0; $i < 501; $i++) {
            $rows[] = ['document_id' => $document->id, 'from_office_id' => $office->id, 'to_office_id' => $office->id,
                'created_by' => $user->id, 'status' => $i === 500 ? 'available' : 'pending',
                'action' => $i === 499 ? 'Received' : 'Other',
                'created_at' => $i === 500 ? '2026-10-12 01:00:00' : '2026-10-09 01:00:00',
                'updated_at' => '2026-10-12 01:00:00'];
        }
        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('document_trails')->insert($chunk);
        }
        $row = app(ProcessingPerformance::class)->forOffice($office->id)[0];
        $this->assertSame(1, $row['tracking_count']);
        $this->assertEquals(1, $row['tracking']);
    }

    public function test_approval_rounds_use_historical_office_and_do_not_double_count_current_round(): void
    {
        $a = Office::create(['name' => 'A']);
        $b = Office::create(['name' => 'B']);
        $user = User::factory()->create(['office_id' => $a->id]);
        $type = DocumentType::create(['name' => 'Memo']);
        $draft = DocumentCreationDraft::create(['created_by' => $user->id, 'document_type_id' => $type->id,
            'title' => 'Test', 'content' => [], 'status' => 'approved', 'version_number' => 2,
            'approver_office_id' => $b->id, 'submitted_at' => '2026-10-13 01:00:00', 'decision_at' => '2026-10-15 01:00:00']);
        foreach ([
            [1, 'Submitted for approval', $a->id, '2026-10-09 01:00:00'],
            [1, 'Revision requested', null, '2026-10-12 01:00:00'],
            [2, 'Submitted for approval', $b->id, '2026-10-13 01:00:00'],
            [2, 'Approved', null, '2026-10-15 01:00:00'],
        ] as [$version, $event, $office, $time]) {
            $record = $draft->events()->create(['user_id' => $user->id, 'event' => $event,
                'metadata' => ['version' => $version, 'approver_office_id' => $office]]);
            $record->forceFill(['created_at' => $time])->save();
        }
        $service = app(ProcessingPerformance::class);
        $this->assertEquals(1, $service->forOffice($a->id)[0]['approval']);
        $rows = $service->forOffice($b->id);
        $this->assertEquals(2, $rows[0]['approval']);
        $this->assertSame(1, $rows[0]['approval_count']);
        $this->assertNull($rows[0]['tracking']);
    }
}
