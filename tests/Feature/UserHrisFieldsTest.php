<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserHrisFieldsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.legacy' => config('database.connections.sqlite')]);
        DB::purge('legacy');
        foreach ([
            '0001_01_01_000000_create_users_table.php',
            '2026_09_23_000001_create_offices_table.php',
            '2026_10_06_000001_add_hris_fields_to_users_table.php',
            '2026_10_07_000002_rename_legacy_bureau_id_to_legacy_office_id.php',
            '2026_10_07_000003_make_user_password_nullable.php',
            '2026_10_07_000004_replace_agency_employee_no_with_employee_code.php',
            '2026_10_07_000005_add_hris_names_to_users_table.php',
        ] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        Schema::connection('legacy')->create('bureau', function ($table) {
            $table->integer('bureauId')->primary();
            $table->string('officeCode')->nullable();
            $table->string('longName');
            $table->string('shortName')->nullable();
            $table->string('officeEmail')->nullable();
            $table->string('status');
        });
        Schema::connection('legacy')->create('role', function ($table) {
            $table->integer('roleId')->primary();
            $table->string('rolename');
        });
        Notification::fake();
        $admin = User::create(['name' => 'Admin', 'email' => 'admin@example.test', 'password' => 'password', 'role_id' => 1]);
        $this->actingAs($admin);
        DB::connection('legacy')->table('role')->insert(['roleId' => 3, 'rolename' => 'Admin Staff']);
        DB::connection('legacy')->table('bureau')->insert([
            'bureauId' => 7, 'officeCode' => 'OFF-7', 'longName' => 'Legacy office',
            'officeEmail' => 'office@example.test', 'status' => 'active',
        ]);
    }

    public function test_employee_creation_stores_all_six_verified_hris_fields(): void
    {
        $office = Office::create(['code' => 'LOCAL-CODE', 'name' => 'Assigned office']);
        $expected = [
            'office_code' => 'BSO-434', 'office_name' => 'OFFICE ON POLICY, PLANNING AND RESEARCH',
            'region_code' => '13', 'region_name' => 'Central Office',
            'division_code' => 'DIV-4824', 'division' => 'OPPR - INFORMATION AND COMMUNICATIONS TECHNOLOGY DIVISION',
        ];
        $this->withSession(['hris_employee_lookup' => [
            'employee' => [
                'employee_code' => 'EMP-12639', 'username' => 'hris.test', 'first_name' => 'Test', 'last_name' => 'Employee',
                'division_code' => $expected['division_code'], 'division' => $expected['division'],
            ],
            'offices' => [array_intersect_key($expected, array_flip(['office_code', 'office_name', 'region_code', 'region_name']))],
        ]])->post('/user-accounts', [
            'account_type' => 'employee', 'operation' => 'create', 'employee_code' => 'EMP-12639',
            'email' => 'hris@example.test', 'office_code' => 'BSO-434', 'office_table_id' => 'new-'.$office->id,
            'employee_role' => 'admin staff', 'division' => 'Untrusted form value', 'region_name' => 'Untrusted form value',
        ])->assertSessionHasNoErrors()->assertRedirect('/user-accounts');

        $user = User::where('employee_code', 'EMP-12639')->firstOrFail();
        foreach ($expected as $column => $value) {
            $this->assertSame($value, $user->getRawOriginal($column), $column);
        }
        $this->assertSame($office->id, $user->office_id);
        $this->assertSame(1, Office::count());
    }

    public function test_dots_creation_reuses_existing_office_by_code_without_changing_it(): void
    {
        $office = Office::create(['code' => 'OFF-7', 'name' => 'Different local name']);
        $this->post('/user-accounts', [
            'operation' => 'create', 'account_type' => 'dots', 'firstname' => 'Test', 'lastname' => 'User',
            'username' => 'dots.test', 'role_id' => 3, 'officeId' => 7,
        ])->assertSessionHasNoErrors()->assertRedirect('/user-accounts');
        $this->assertSame(1, Office::count());
        $this->assertSame($office->id, User::where('username', 'dots.test')->firstOrFail()->office_id);
        $this->assertSame('Different local name', $office->fresh()->name);
    }

    public function test_dots_creation_rejects_unmatched_office_without_inserting_records(): void
    {
        $this->post('/user-accounts', [
            'operation' => 'create', 'account_type' => 'dots', 'firstname' => 'Test', 'lastname' => 'User',
            'username' => 'dots.test', 'role_id' => 3, 'officeId' => 7,
        ])->assertSessionHasErrors('officeId');
        $this->assertSame(0, Office::count());
        $this->assertSame(1, User::count());
        Notification::assertNothingSent();
    }

    public function test_employee_creation_rejects_unmatched_legacy_office(): void
    {
        $this->withSession(['hris_employee_lookup' => [
            'employee' => ['employee_code' => 'EMP-TEST', 'username' => 'test.employee', 'first_name' => 'Test', 'last_name' => 'Employee'],
            'offices' => [['office_code' => 'OFF-7']],
        ]])->post('/user-accounts', [
            'operation' => 'create', 'account_type' => 'employee', 'employee_code' => 'EMP-TEST',
            'email' => 'employee@example.test', 'office_code' => 'OFF-7', 'office_table_id' => 'legacy-7',
            'employee_role' => 'admin staff',
        ])->assertSessionHasErrors('office_table_id');
        $this->assertSame(0, Office::count());
        $this->assertSame(1, User::count());
        Notification::assertNothingSent();
    }

    public function test_update_rejects_unmatched_office_without_creating_one(): void
    {
        $user = User::create(['name' => 'Existing User', 'username' => 'existing', 'email' => 'existing@example.test']);
        $this->put('/user-accounts/'.$user->id, [
            'operation' => 'update', 'username' => 'existing', 'firstname' => 'Changed', 'lastname' => 'User',
            'email' => $user->email, 'role_id' => 3, 'officeId' => 7, 'status' => '1', 'isLocked' => 'N',
        ])->assertSessionHasErrors('officeId');
        $this->assertSame(0, Office::count());
        $this->assertSame('Existing User', $user->fresh()->name);
    }
}
