<?php

namespace Tests\Feature;

use App\Http\Controllers\DashboardController;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\DocumentLegacy;
use App\Models\User;
use App\Services\DocumentAccess;
use App\Services\LegacyDocumentImport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LegacyDocumentImportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        DB::table('offices')->insert([
            ['id' => 101, 'name' => 'Origin', 'legacy_bureau_id' => 10],
            ['id' => 102, 'name' => 'Receiver', 'legacy_bureau_id' => 20],
        ]);
        DB::table('users')->insert(['id' => 200, 'name' => 'Test', 'email' => 'user@example.test', 'legacy_user_uuid' => 'actor', 'office_id' => 101, 'role_id' => 14]);
        $lookup = ['dtId' => 4, 'name' => 'Test type', 'description' => null, 'status' => 'active', 'createdBy' => 'actor', 'dateCreated' => '2020-01-01 00:00:00', 'dateUpdated' => null];
        $d = ['docId' => 50, 'trackingNo' => 'OLD-50', 'title' => str_repeat('T', 500), 'dtId' => 4, 'otherDtype' => null, 'purpose' => 'Historical free text', 'originType' => 'Internal', 'createdBy' => 'actor', 'Archived' => 'N', 'isFinalized' => 'yes', 'urgent' => 'yes', 'forNotification' => 'no', 'remarks' => null, 'dateCreated' => '2020-01-01 00:00:00', 'dateLastUpdated' => null];
        $t = ['docTrailId' => 70, 'trackingNo' => 'OLD-50', 'originating' => 10, 'holder' => 10, 'receiving' => 20, 'status' => 'AVAILABLE', 'action' => 'Release', 'remarks' => null, 'createdBy' => 'actor', 'dateCreated' => '2020-01-03 00:00:00', 'initialRelease' => 1];
        $f = ['fileId' => 90, 'docId' => 50, 'docTrailId' => 70, 'type' => 'original', 'fileName' => 'old.pdf', 'origName' => 'original.pdf', 'filePath' => '/old-server/uploads/old.pdf', 'uploadedBy' => 'actor', 'dateUploaded' => '0000-00-00 00:00:00'];
        $fixtures = [
            'document_type' => [$lookup], 'action_type' => [$lookup], 'purpose_type' => [$lookup],
            'document' => [$d, array_replace($d, ['docId' => 51, 'trackingNo' => null, 'title' => null]), array_replace($d, ['docId' => 52, 'trackingNo' => 'OLD-52', 'Archived' => 'Y'])],
            'document_trail' => [$t, array_replace($t, ['docTrailId' => 71, 'holder' => 20, 'status' => 'PENDING', 'dateCreated' => '2020-01-02 00:00:00']), array_replace($t, ['docTrailId' => 72, 'trackingNo' => 'MISSING']), array_replace($t, ['docTrailId' => 73, 'trackingNo' => 'OLD-52'])],
            'file' => [$f, array_replace($f, ['fileId' => 91, 'docId' => 999]), array_replace($f, ['fileId' => 92, 'docTrailId' => 999])],
        ];
        Schema::connection('legacy')->drop('file');
        foreach ($fixtures as $table => $rows) {
            Schema::connection('legacy')->create($table, function ($schema) use ($rows) {
                foreach (array_keys($rows[0]) as $column) {
                    if (in_array($column, ['docId', 'docTrailId', 'fileId', 'dtId', 'originating', 'holder', 'receiving', 'initialRelease'])) {
                        $schema->integer($column)->nullable();
                    } else {
                        $schema->text($column)->nullable();
                    }
                }
            });
            DB::connection('legacy')->table($table)->insert($rows);
        }
    }

    public function test_preview_is_read_only_and_import_preserves_history_metadata_and_exceptions(): void
    {
        $import = new LegacyDocumentImport;
        $report = $import->run();
        $this->assertSame(3, $report['counts']['documents']['new']);
        $this->assertSame(0, DB::table('documents')->count());
        $this->assertSame(0, DB::table('legacy_document_exceptions')->count());
        $import->run(true);
        $doc = Document::where('legacy_doc_id', 50)->firstOrFail();
        $this->assertSame(500, mb_strlen($doc->title));
        $this->assertSame('Historical free text', $doc->other_purpose);
        $this->assertSame(200, $doc->created_by);
        $this->assertSame(101, $doc->office_id);
        $this->assertSame(71, $doc->latestTrail->legacy_doc_trail_id);
        $this->assertSame(102, $doc->latestTrail->to_office_id);
        $release = $doc->trails()->where('legacy_doc_trail_id', 70)->first();
        $this->assertSame(101, $release->holder_office_id);
        $this->assertSame(102, $release->to_office_id);
        $this->assertSame(102, $release->legacy_receiving_office_id);
        $this->assertSame('terminal', Document::where('legacy_doc_id', 52)->value('status'));
        $incomplete = Document::where('legacy_doc_id', 51)->first();
        $this->assertNull($incomplete->title);
        $this->assertNull($incomplete->tracking_number);
        $this->assertTrue($incomplete->legacy_needs_review);
        $this->assertSame(2, DB::table('legacy_document_exceptions')->count());
        $file = DocumentFile::where('legacy_file_id', 90)->firstOrFail();
        $this->assertFalse($file->is_available);
        $this->assertNull($file->downloadUrl());
        $this->assertNull($file->created_at);
        $this->assertNull(DocumentFile::where('legacy_file_id', 92)->value('document_trail_id'));
        $this->assertSame(0, DocumentLegacy::count());
        $rerun = $import->run(true);
        $this->assertSame(3, $rerun['counts']['documents']['existing']);
        $this->assertArrayNotHasKey('new', $rerun['counts']['document_trails']);
        $this->assertSame(2, DB::table('legacy_document_exceptions')->count());
    }

    public function test_combined_import_previews_read_only_then_imports_directory_and_documents(): void
    {
        Storage::fake('local');
        $fixtures = [
            'rangeregion' => [['id' => 1, 'name' => 'Central Region', 'status' => 'Active']],
            'bureau' => [
                ['bureauId' => 10, 'longName' => 'Origin', 'shortName' => 'ORG', 'officeCode' => 'ORG', 'officeEmail' => null, 'dateAdded' => null, 'parentbureauId' => null, 'range' => 'Central Region'],
                ['bureauId' => 20, 'longName' => 'Receiver', 'shortName' => 'RCV', 'officeCode' => 'RCV', 'officeEmail' => null, 'dateAdded' => null, 'parentbureauId' => null, 'range' => 'Central Region'],
            ],
            'division' => [['divisionId' => 30, 'longName' => 'Origin Division', 'bureauId' => 10, 'dateAdded' => null]],
            'role' => [['roleId' => 14, 'rolename' => 'Director']],
            'user' => [[
                'userUuid' => 'actor', 'username' => 'legacy.actor', 'password' => password_hash('old-password', PASSWORD_BCRYPT),
                'firstname' => 'Test', 'lastname' => 'User', 'middlename' => null, 'extensionname' => null,
                'emailAddress' => 'user@example.test', 'role' => 14, 'status' => '1', 'isLocked' => 'N',
                'bureauId' => 10, 'divisionId' => 30, 'dateCreated' => null, 'lastLoggedInTime' => null,
            ]],
        ];
        $integerColumns = ['id', 'bureauId', 'parentbureauId', 'divisionId', 'roleId', 'role'];
        foreach ($fixtures as $table => $rows) {
            Schema::connection('legacy')->create($table, function ($schema) use ($rows, $integerColumns) {
                foreach (array_keys($rows[0]) as $column) {
                    if (in_array($column, $integerColumns, true)) {
                        $schema->integer($column)->nullable();
                    } else {
                        $schema->text($column)->nullable();
                    }
                }
            });
            DB::connection('legacy')->table($table)->insert($rows);
        }

        $this->artisan('legacy:import-all')
            ->expectsOutputToContain('Directory import')
            ->expectsOutputToContain('Document import')
            ->expectsOutputToContain('Preview only: all temporary directory writes were rolled back')
            ->assertSuccessful();
        $this->assertSame(0, DB::table('ranges')->count());
        $this->assertSame(0, DB::table('divisions')->count());
        $this->assertSame(0, DB::table('documents')->count());
        $this->assertSame(0, DB::table('legacy_document_exceptions')->count());

        $this->artisan('legacy:import-all', [
            '--apply' => true,
            '--target' => DB::connection()->getDatabaseName(),
        ])->assertSuccessful();

        $this->assertSame(1, DB::table('ranges')->count());
        $this->assertSame(1, DB::table('divisions')->count());
        $this->assertSame(3, DB::table('documents')->whereNotNull('legacy_doc_id')->count());
        $this->assertSame(3, DB::table('document_trails')->whereNotNull('legacy_doc_trail_id')->count());
        $this->assertSame(2, DB::table('document_files')->whereNotNull('legacy_file_id')->count());
        $this->assertSame(2, DB::table('legacy_document_exceptions')->count());

        $admin = User::query()->create([
            'name' => 'Local Administrator',
            'username' => 'local-admin',
            'email' => 'local-admin@example.test',
            'password' => 'password',
            'role' => 'System Admin',
            'role_id' => 1,
            'email_verified_at' => now(),
            'is_active' => true,
        ]);
        config(['database.connections.legacy' => [
            'driver' => 'sqlite',
            'database' => '/tmp/legacy-database-must-not-be-used.sqlite',
            'prefix' => '',
        ]]);
        DB::purge('legacy');
        $this->actingAs($admin)
            ->get('/ranges')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Ranges/Index')->has('ranges', 1));
        $this->get('/user-accounts')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('UserAccounts/Index')
                ->has('users', 2)
                ->where('users.0.source', 'New DB')
                ->where('users.1.source', 'New DB'));
        $this->get('/offices')->assertOk();
        $this->get('/documents')->assertOk();
        $this->get('/dashboard')->assertOk();
        $this->get('/track/OLD-52')->assertOk();
    }

    public function test_failure_rolls_back_lookup_and_document_changes(): void
    {
        DB::connection('legacy')->table('document_trail')->where('docTrailId', 71)->update(['status' => 'UNKNOWN']);
        try {
            (new LegacyDocumentImport)->run(true);
            $this->fail('Expected unknown status rejection');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Unknown status', $e->getMessage());
        }
        $this->assertSame(0, DB::table('documents')->count());
        $this->assertSame(0, DB::table('document_types')->whereNotNull('legacy_type_id')->count());
    }

    public function test_tracking_collision_is_not_silently_merged(): void
    {
        DB::table('documents')->insert(['title' => 'Local', 'tracking_number' => 'old-50']);
        try {
            (new LegacyDocumentImport)->run(true);
            $this->fail('Expected conflict');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('Tracking-number conflict', $e->getMessage());
        }
        $this->assertSame(1, DB::table('documents')->count());
    }

    public function test_incomplete_or_archived_import_cannot_be_processed(): void
    {
        (new LegacyDocumentImport)->run(true);
        $user = User::findOrFail(200);
        $this->actingAs($user);
        foreach ([51, 52] as $legacyId) {
            $doc = Document::where('legacy_doc_id', $legacyId)->firstOrFail();
            $this->post('/documents/'.$doc->id.'/receive')->assertForbidden();
            $this->post('/documents/'.$doc->id.'/terminal')->assertForbidden();
        }
        $this->assertTrue(app(DocumentAccess::class)->scope(Document::query(), $user)->where('legacy_doc_id', 51)->exists());
    }

    public function test_receiver_can_continue_the_imported_workflow(): void
    {
        DB::connection('legacy')->table('document_trail')->where('docTrailId', 71)->delete();
        (new LegacyDocumentImport)->run(true);
        $doc = Document::where('legacy_doc_id', 50)->firstOrFail();
        DB::table('users')->insert(['id' => 201, 'name' => 'Receiver', 'email' => 'receiver@example.test', 'office_id' => 102, 'role_id' => 14]);
        $this->actingAs(User::findOrFail(201))->post('/documents/'.$doc->id.'/receive')->assertRedirect();
        $doc->refresh();
        $this->assertSame('pending', $doc->status);
        $this->assertSame(102, $doc->latestTrail->to_office_id);
        $this->assertNull($doc->latestTrail->legacy_doc_trail_id);
        $this->post('/documents/'.$doc->id.'/terminal')->assertRedirect();
        $this->assertTrue($doc->fresh()->is_archived);
    }

    public function test_dashboard_does_not_double_count_migrated_documents_or_offer_archived_receipts(): void
    {
        (new LegacyDocumentImport)->run(true);
        $user = User::findOrFail(200);
        $user->update(['role_id' => 1, 'legacy_office_id' => 10]);
        $this->actingAs($user);
        $request = Request::create('/dashboard');
        $request->headers->set('X-Inertia', 'true');
        $stats = app(DashboardController::class)->index()->toResponse($request)->getData(true)['props']['stats'];
        $this->assertSame(0, $stats['incoming_documents']);
        $this->assertSame(1, $stats['pending_documents']);
        $this->assertSame(1, $stats['archived_documents']);
        $this->assertSame(2, $stats['released_documents']);
    }

    public function test_new_native_history_is_preserved_and_later_legacy_append_is_rejected(): void
    {
        $import = new LegacyDocumentImport;
        $import->run(true);
        $doc = Document::where('legacy_doc_id', 50)->firstOrFail();
        $doc->trails()->create(['status' => 'terminal', 'created_by' => 200]);
        $import->run(true); // Existing identities do not overwrite current state.
        $source = (array) DB::connection('legacy')->table('document_trail')->where('docTrailId', 71)->first();
        $source['docTrailId'] = 100;
        DB::connection('legacy')->table('document_trail')->insert($source);
        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Cannot append legacy history');
        $import->run(true);
    }
}
