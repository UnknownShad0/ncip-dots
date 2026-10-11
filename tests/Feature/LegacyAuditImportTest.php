<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\User;
use App\Services\LegacyAuditImport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LegacyAuditImportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        Storage::fake('local');
        DB::table('users')->insert(['id' => 77, 'name' => 'Alex Molina', 'firstname' => 'Alex', 'lastname' => 'Molina', 'email' => 'actor@example.test', 'legacy_user_uuid' => 'old-user']);
        Schema::connection('legacy')->create('audit_trail', function ($t) {
            $t->string('trailUuid', 100)->primary();
            foreach (['event', 'module', 'query', 'logDate', 'userUuid'] as $col) {
                $t->text($col)->nullable();
            }
        });
        DB::connection('legacy')->table('audit_trail')->insert([
            ['trailUuid' => 'a-1', 'event' => 'Updated office', 'module' => 'Office', 'query' => 'DROP TABLE users; -- historical text only', 'logDate' => '2022-02-21 01:50:59', 'userUuid' => 'old-user'],
            ['trailUuid' => 'a-2', 'event' => null, 'module' => null, 'query' => "SELECT '<script>private</script>'", 'logDate' => '0000-00-00 00:00:00', 'userUuid' => null],
        ]);
    }

    public function test_preview_and_repeat_import_preserve_identity_actor_timestamp_and_query_text(): void
    {
        $native = AuditTrail::create(['user_id' => 77, 'action' => 'Native action']);
        $before = $native->fresh()->getAttributes();
        $import = new LegacyAuditImport;
        $report = $import->run();
        $this->assertSame(2, $report['new']);
        $this->assertSame(1, $report['without_actor']);
        $this->assertSame(1, AuditTrail::count());
        $import->run(true);
        $entry = AuditTrail::where('legacy_trail_uuid', 'a-1')->firstOrFail();
        $this->assertSame(77, $entry->user_id);
        $this->assertSame('2022-02-21 01:50:59', $entry->getRawOriginal('created_at'));
        $this->assertSame('Office', $entry->legacy_module);
        $this->assertSame('legacy_import', $entry->record_source);
        $this->assertSame('DROP TABLE users; -- historical text only', json_decode($entry->legacy_payload, true)['query']);
        $this->assertNull($entry->model_id);
        $this->assertNull($entry->model_type);
        $this->assertArrayNotHasKey('legacy_payload', $entry->toArray());
        $unknown = AuditTrail::where('legacy_trail_uuid', 'a-2')->firstOrFail();
        $this->assertNull($unknown->created_at);
        $this->assertNull($unknown->user_id);
        $this->assertNull($unknown->action);
        $this->assertSame(1, DB::table('users')->count());
        DB::connection('legacy')->table('audit_trail')->where('trailUuid', 'a-1')->update(['event' => 'Changed at source']);
        $rerun = $import->run(true);
        $this->assertSame(0, $rerun['new']);
        $this->assertSame(2, $rerun['existing']);
        $this->assertSame('Updated office', $entry->fresh()->action);
        $this->assertSame($before, $native->fresh()->getAttributes());
    }

    public function test_unmapped_user_rolls_back_earlier_batches(): void
    {
        $rows = [];
        for ($i = 0; $i < 501; $i++) {
            $rows[] = ['trailUuid' => sprintf('b-%04d', $i), 'event' => 'Historical action', 'logDate' => '2022-01-01 00:00:00', 'userUuid' => $i === 500 ? 'unmapped-user' : 'old-user'];
        }
        DB::connection('legacy')->table('audit_trail')->insert($rows);
        try {
            (new LegacyAuditImport)->run(true);
            $this->fail('Expected missing mapping');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('unmapped users', $e->getMessage());
        }
        $this->assertSame(0, AuditTrail::count());
    }

    public function test_command_defaults_to_preview_and_requires_exact_target_for_apply(): void
    {
        $this->artisan('legacy:import-audit')->assertSuccessful();
        $this->assertSame(0, AuditTrail::count());
        $this->artisan('legacy:import-audit', ['--apply' => true, '--target' => 'wrong-db'])->assertFailed();
        $this->assertSame(0, AuditTrail::count());
    }

    public function test_audit_page_paginates_and_never_serializes_raw_legacy_query(): void
    {
        (new LegacyAuditImport)->run(true);
        for ($i = 0; $i < 51; $i++) {
            AuditTrail::create(['user_id' => 77, 'action' => 'Native '.$i]);
        }
        $this->actingAs(User::findOrFail(77))->get('/audit-trail?page=2')->assertInertia(fn (Assert $page) => $page
            ->component('AuditTrail/Index')->has('trail', 3)
            ->where('pagination.total', 53)->where('pagination.current_page', 2)
            ->where('trail.1.user.short_name', 'A. Molina')
            ->where('trail.1.action', 'Updated office')
            ->missing('trail.1.legacy_payload')->where('trail.1.details', null));
    }

    public function test_rollback_refuses_to_erase_imported_history(): void
    {
        (new LegacyAuditImport)->run(true);
        $migration = require database_path('migrations/2026_10_11_000001_prepare_legacy_audit_import.php');
        $this->expectException(\RuntimeException::class);
        $migration->down();
    }
}
