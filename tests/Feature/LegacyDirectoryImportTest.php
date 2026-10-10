<?php

namespace Tests\Feature;

use App\Services\LegacyDirectoryImport;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LegacyDirectoryImportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        $this->artisan('migrate', ['--force' => true])->assertSuccessful();
        $fixtures = [
            'rangeregion' => [['id' => 28, 'name' => 'Central Office', 'status' => 'Active']],
            'bureau' => [
                ['bureauId' => 25, 'longName' => 'Parent Office', 'shortName' => 'PO', 'officeCode' => 'OLD', 'officeEmail' => 'office@example.test', 'dateAdded' => '2020-01-01 00:00:00', 'parentbureauId' => null, 'range' => 'Central Office'],
                ['bureauId' => 99, 'longName' => 'Child Office', 'shortName' => 'CO', 'officeCode' => 'CHILD', 'officeEmail' => null, 'dateAdded' => null, 'parentbureauId' => 25, 'range' => 'Select Range Office'],
            ],
            'division' => [['divisionId' => 11, 'longName' => 'Division', 'bureauId' => 25, 'dateAdded' => null]],
            'role' => [['roleId' => 3, 'rolename' => 'Admin Staff']],
            'user' => [[
                'userUuid' => 'legacy-user', 'username' => 'legacy.user', 'password' => password_hash('old-password', PASSWORD_BCRYPT),
                'firstname' => 'Test', 'lastname' => 'User', 'middlename' => null, 'extensionname' => null,
                'emailAddress' => 'legacy@example.test', 'role' => 3, 'status' => '2', 'isLocked' => 'Y',
                'bureauId' => 25, 'divisionId' => 11, 'dateCreated' => '2020-01-01 00:00:00', 'lastLoggedInTime' => null,
            ]],
        ];
        foreach ($fixtures as $table => $rows) {
            Schema::connection('legacy')->create($table, function ($schema) use ($rows) {
                foreach (array_keys($rows[0]) as $column) {
                    if (in_array($column, ['id', 'bureauId', 'parentbureauId', 'divisionId', 'roleId', 'role'])) {
                        $schema->integer($column)->nullable();
                    } else {
                        $schema->string($column)->nullable();
                    }
                }
            });
            DB::connection('legacy')->table($table)->insert($rows);
        }
    }

    public function test_preview_writes_nothing_and_import_remaps_ids_preserves_hashes_and_repeats_safely(): void
    {
        $office = DB::table('offices')->insertGetId(['name' => 'Parent Office', 'code' => 'HRIS-CODE']);
        $this->artisan('legacy:import-directory')->assertSuccessful();
        $this->assertSame(0, DB::table('users')->count());
        $this->assertSame(0, DB::table('ranges')->count());
        $this->assertNull(DB::table('offices')->value('legacy_bureau_id'));
        $import = new LegacyDirectoryImport;
        $import->apply($import->plan());
        $user = DB::table('users')->first();
        $this->assertSame($office, $user->office_id);
        $this->assertSame('HRIS-CODE', DB::table('offices')->where('id', $office)->value('code'));
        $this->assertSame($office, DB::table('offices')->where('legacy_bureau_id', 99)->value('parent_id'));
        $this->assertSame(DB::table('divisions')->value('id'), $user->division_id);
        $this->assertSame(DB::connection('legacy')->table('user')->value('password'), $user->password);
        $this->assertTrue(password_verify('old-password', $user->password));
        $this->assertSame(0, $user->is_active);
        $this->assertSame(1, $user->is_locked);
        $this->assertSame('legacy_import', $user->record_source);
        $this->assertSame('legacy_import', DB::table('ranges')->value('record_source'));
        $this->assertSame('legacy_linked', DB::table('offices')->where('id', $office)->value('record_source'));
        $this->assertSame('legacy_import', DB::table('offices')->where('legacy_bureau_id', 99)->value('record_source'));
        $this->assertSame('2020-01-01 00:00:00', $user->created_at);
        $this->assertSame([], $import->plan()['operations']);
    }

    public function test_existing_account_only_receives_links_and_keeps_password_and_permissions(): void
    {
        DB::table('users')->insert(['name' => 'Existing', 'username' => 'legacy.user', 'email' => 'legacy@example.test', 'password' => 'keep-this-hash', 'role_id' => 14, 'is_active' => true, 'is_locked' => false]);
        $import = new LegacyDirectoryImport;
        $import->apply($import->plan());
        $user = DB::table('users')->first();
        $this->assertSame('keep-this-hash', $user->password);
        $this->assertSame(14, $user->role_id);
        $this->assertSame(1, $user->is_active);
        $this->assertSame('legacy-user', $user->legacy_user_uuid);
        $this->assertSame('legacy_linked', $user->record_source);
        $this->assertSame(1, DB::table('users')->count());
    }

    public function test_new_local_records_default_to_native_source(): void
    {
        $id = DB::table('ranges')->insertGetId(['name' => 'Native range']);

        $this->assertSame('native', DB::table('ranges')->where('id', $id)->value('record_source'));
    }

    public function test_zero_dates_become_null_without_inventing_historical_dates(): void
    {
        DB::connection('legacy')->table('bureau')->update(['dateAdded' => '0000-00-00 00:00:00']);
        $import = new LegacyDirectoryImport;
        $plan = $import->plan();
        $this->assertContains('2 legacy zero dates mapped to null (unknown date).', $plan['warnings']);
        $import->apply($plan);
        $this->assertSame(2, DB::table('offices')->whereNull('created_at')->count());
    }

    public function test_identity_conflict_blocks_the_whole_preview(): void
    {
        DB::table('users')->insert(['name' => 'Unrelated', 'username' => 'another.user', 'email' => 'legacy@example.test']);
        $this->artisan('legacy:import-directory')->assertFailed();
        $this->assertSame(0, DB::table('offices')->count());
    }

    public function test_mismatched_division_requires_explicit_option_and_retains_bureau(): void
    {
        DB::connection('legacy')->table('user')->update(['bureauId' => 99]);
        $this->artisan('legacy:import-directory')->assertFailed();
        $import = new LegacyDirectoryImport;
        $plan = $import->plan(true);
        $this->assertCount(2, $plan['warnings']);
        $import->apply($plan);
        $this->assertNull(DB::table('users')->value('division_id'));
        $this->assertSame(99, DB::table('users')->value('legacy_office_id'));
    }

    public function test_failure_during_write_rolls_back_every_import_table(): void
    {
        $import = new LegacyDirectoryImport;
        $plan = $import->plan();
        DB::table('users')->insert(['name' => 'Concurrent user', 'email' => 'legacy@example.test']);
        try {
            $import->apply($plan);
            $this->fail('Expected unique constraint failure');
        } catch (QueryException $e) {
            $this->assertSame(0, DB::table('ranges')->count());
            $this->assertSame(0, DB::table('offices')->count());
            $this->assertSame(0, DB::table('divisions')->count());
            $this->assertSame(1, DB::table('users')->count());
        }
    }
}
