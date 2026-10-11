<?php

namespace Tests\Feature;

use App\Services\LegacyDirectoryImport;
use App\Services\LegacyDocumentImport;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LegacyImportAllTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        Storage::fake('local');
        Schema::connection('legacy')->create('audit_trail', function ($table) {
            $table->string('trailUuid')->primary();
            foreach (['userUuid', 'event', 'module', 'query', 'logDate'] as $column) {
                $table->text($column)->nullable();
            }
        });
        DB::connection('legacy')->table('audit_trail')->insert(['trailUuid' => 'audit-1', 'userUuid' => 'actor', 'event' => 'Historical action', 'logDate' => '2022-01-01 00:00:00']);
    }

    private function stages(bool $apply): void
    {
        // Exercise the real directory writer and audit importer; isolate source
        // fixture construction and the independently tested document processor.
        $directory = \Mockery::mock(LegacyDirectoryImport::class)->makePartial();
        $directory->shouldReceive('plan')->once()->with(true)->andReturn([
            'operations' => [
                ['table' => 'users', 'id' => -1, 'insert' => true, 'values' => ['legacy_user_uuid' => 'actor', 'name' => 'Imported', 'email' => 'actor@example.test']],
                ['table' => 'offices', 'id' => -2, 'insert' => true, 'values' => ['legacy_bureau_id' => 10, 'name' => 'Office']],
            ],
            'counts' => ['users' => ['insert' => 1], 'offices' => ['insert' => 1]], 'warnings' => [],
        ]);
        $this->app->instance(LegacyDirectoryImport::class, $directory);
        $documents = \Mockery::mock(LegacyDocumentImport::class);
        $documents->shouldReceive('run')->once()->andReturnUsing(function ($commit, $preview) use ($apply) {
            $this->assertSame($apply, $commit);
            if ($apply) {
                $this->assertNull($preview);
                $this->assertSame(1, DB::table('users')->count());
                DB::table('audit_trails')->insert(['action' => 'Document-stage marker']);
            } else {
                $this->assertSame(-1, $preview['users']['actor']);
                $this->assertSame(-2, $preview['offices'][10]);
                $this->assertSame(0, DB::table('users')->count());
            }

            return ['counts' => [], 'issues' => []];
        });
        $this->app->instance(LegacyDocumentImport::class, $documents);
    }

    public function test_full_preview_uses_projected_directory_without_writing(): void
    {
        $this->stages(false);
        $this->artisan('legacy:import-all', ['--unassign-mismatched-divisions' => true])->assertSuccessful();
        $this->assertSame(0, DB::table('users')->count());
        $this->assertSame(0, DB::table('audit_trails')->count());
    }

    public function test_apply_commits_stages_in_dependency_order(): void
    {
        $this->stages(true);
        $this->artisan('legacy:import-all', ['--apply' => true, '--target' => ':memory:', '--unassign-mismatched-divisions' => true])->assertSuccessful();
        $this->assertSame(1, DB::table('users')->count());
        $this->assertSame(2, DB::table('audit_trails')->count());
        $this->assertSame(DB::table('users')->value('id'), DB::table('audit_trails')->where('legacy_trail_uuid', 'audit-1')->value('user_id'));
    }

    public function test_audit_failure_rolls_back_directory_and_document_stage_writes(): void
    {
        $this->stages(true);
        DB::connection('legacy')->table('audit_trail')->update(['userUuid' => 'missing']);
        $this->artisan('legacy:import-all', ['--apply' => true, '--target' => ':memory:', '--unassign-mismatched-divisions' => true])->assertFailed();
        $this->assertSame(0, DB::table('users')->count());
        $this->assertSame(0, DB::table('offices')->count());
        $this->assertSame(0, DB::table('audit_trails')->count());
    }

    public function test_wrong_target_is_rejected_before_running_importers(): void
    {
        $this->artisan('legacy:import-all', ['--apply' => true, '--target' => 'wrong'])->assertFailed();
        $this->assertSame(0, DB::table('users')->count());
    }
}
