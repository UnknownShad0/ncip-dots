<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\UserAccountCreated;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class UserAccountCreationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.legacy' => config('database.connections.sqlite')]);
        DB::purge('legacy');
        (require database_path('migrations/0001_01_01_000000_create_users_table.php'))->up();
        (require database_path('migrations/2026_09_23_000001_create_offices_table.php'))->up();
        (require database_path('migrations/2026_10_06_000001_add_hris_fields_to_users_table.php'))->up();
        Schema::connection('legacy')->create('bureau', function ($table) {
            $table->integer('bureauId')->primary();
            $table->string('longName');
            $table->string('shortName')->nullable();
            $table->string('officeCode');
            $table->string('officeEmail')->nullable();
            $table->string('status');
        });
        Schema::connection('legacy')->create('role', function ($table) {
            $table->integer('roleId')->primary();
            $table->string('rolename');
        });
        DB::connection('legacy')->table('bureau')->insert([
            'bureauId' => 7, 'longName' => 'Test Office', 'officeCode' => 'OFF-7', 'officeEmail' => 'office@example.test', 'status' => '1',
        ]);
        DB::connection('legacy')->table('role')->insert(['roleId' => 14, 'rolename' => 'Encoder']);
        $this->actingAs(User::create([
            'name' => 'Administrator', 'email' => 'admin@example.test', 'password' => 'password', 'role_id' => 1,
        ]));
        Notification::fake();
    }

    public function test_dots_account_emails_a_generated_password(): void
    {
        $this->post('/user-accounts', [
            'account_type' => 'dots', 'operation' => 'create', 'firstname' => 'Test', 'lastname' => 'Account',
            'username' => 'test.account', 'email' => 'test@example.test', 'role_id' => 14, 'officeId' => 7,
        ])->assertSessionHasNoErrors()->assertRedirect('/user-accounts');

        $user = User::where('username', 'test.account')->firstOrFail();
        $this->assertSame('Test Office', $user->officeByCode->name);
        $this->assertSame('office@example.test', $user->email);
        Notification::assertSentTo($user, UserAccountCreated::class, function ($notification) use ($user) {
            $lines = $notification->toMail($user)->introLines;
            $passwordLine = collect($lines)->first(fn ($line) => str_starts_with($line, 'Password: '));
            return Hash::check(substr($passwordLine, 10), $user->password);
        });
    }

    public function test_employee_lookup_maps_fixture_office_and_saves_verified_names(): void
    {
        config(['services.hris.url' => 'https://hris.example.test']);
        Http::fake([
            'hris.example.test/employee*' => Http::response(json_decode(file_get_contents(base_path('tests/Fixtures/hris/get-employee.json')), true)),
            'hris.example.test/office*' => Http::response(json_decode(file_get_contents(base_path('tests/Fixtures/hris/get-office.json')), true)),
        ]);
        $response = $this->postJson('/user-accounts/lookup-employee', ['agency_employee_no' => 'EMP-7846']);
        $response->assertOk()->assertJsonPath('employee.agency_employee_no', 'EMP-7846')
            ->assertJsonPath('offices.0.office_code', 'BSO-434');
        $this->post('/user-accounts', [
            'account_type' => 'employee', 'operation' => 'create', 'agency_employee_no' => 'EMP-7846',
            'employee_role' => 'employee', 'email' => 'employee@example.test', 'office_code' => 'BSO-434',
            'firstname' => 'Forged name', 'role_id' => 1,
        ])->assertSessionHasNoErrors()->assertRedirect('/user-accounts');
        $user = User::where('agency_employee_no', 'EMP-7846')->firstOrFail();
        $this->assertSame('JOHN MARK', $user->firstname);
        $this->assertSame('BALEROSO', $user->middlename);
        $this->assertSame('employee', $user->role);
        $this->assertNull($user->role_id);
        $this->assertSame('OFFICE ON POLICY, PLANNING AND RESEARCH', $user->officeByCode->name);
        Notification::assertSentTo($user, UserAccountCreated::class);
    }

    public function test_employee_cannot_be_created_without_successful_lookup(): void
    {
        $this->post('/user-accounts', [
            'account_type' => 'employee', 'operation' => 'create', 'agency_employee_no' => 'EMP-7846',
            'employee_role' => 'employee', 'email' => 'employee@example.test', 'office_code' => 'BSO-434',
        ])->assertSessionHasErrors('user');
        $this->assertSame(1, User::count());
        Notification::assertNothingSent();
    }

    public function test_failed_search_clears_previously_verified_employee(): void
    {
        config(['services.hris.url' => 'https://hris.example.test']);
        Http::fake(['*' => Http::response([])]);
        $this->withSession(['hris_employee_lookup' => ['employee' => ['agency_employee_no' => 'OLD']]])
            ->postJson('/user-accounts/lookup-employee', ['agency_employee_no' => 'UNKNOWN'])
            ->assertNotFound()->assertSessionMissing('hris_employee_lookup');
    }

    public function test_mail_failure_reports_that_account_was_created(): void
    {
        Notification::shouldReceive('send')->once()->andThrow(new \RuntimeException('Mail service unavailable'));
        $this->post('/user-accounts', [
            'account_type' => 'dots', 'operation' => 'create', 'firstname' => 'Test', 'lastname' => 'Account',
            'username' => 'mail.failure', 'email' => 'failure@example.test', 'role_id' => 14, 'officeId' => 7,
        ])->assertSessionHasNoErrors()->assertRedirect('/user-accounts')->assertSessionHas('warning');
        $this->assertTrue(User::where('username', 'mail.failure')->exists());
    }

    public function test_existing_hris_columns_are_preserved_by_migration(): void
    {
        DB::table('users')->where('email', 'admin@example.test')->update(['agency_employee_no' => 'EXISTING']);
        (require database_path('migrations/2026_10_06_000001_add_hris_fields_to_users_table.php'))->up();
        $this->assertSame('EXISTING', User::where('email', 'admin@example.test')->value('agency_employee_no'));
    }

    public function test_dots_account_cannot_be_created_without_office_email(): void
    {
        DB::connection('legacy')->table('bureau')->update(['officeEmail' => null]);
        $this->post('/user-accounts', [
            'account_type' => 'dots', 'operation' => 'create', 'firstname' => 'Test', 'lastname' => 'Account',
            'username' => 'test.account', 'email' => 'override@example.test', 'role_id' => 14, 'officeId' => 7,
        ])->assertSessionHasErrors('officeId');
        $this->assertSame(1, User::count());
        Notification::assertNothingSent();
    }

    public function test_employee_chief_uses_existing_database_role_id(): void
    {
        DB::connection('legacy')->table('role')->insert(['roleId' => 5, 'rolename' => 'Chief']);
        $this->withSession(['hris_employee_lookup' => [
            'employee' => ['agency_employee_no' => 'EMP-TEST', 'username' => 'test.chief', 'first_name' => 'Test', 'last_name' => 'Chief'],
            'offices' => [['office_code' => 'OFF-7', 'office_name' => 'Test Office', 'region_code' => '13']],
        ]])->post('/user-accounts', [
            'account_type' => 'employee', 'operation' => 'create', 'agency_employee_no' => 'EMP-TEST',
            'email' => 'chief@example.test', 'office_code' => 'OFF-7', 'employee_role' => 'chief',
        ])->assertSessionHasNoErrors();
        $user = User::where('username', 'test.chief')->firstOrFail();
        $this->assertSame('chief', $user->role);
        $this->assertSame(5, $user->role_id);
        Notification::assertSentTo($user, UserAccountCreated::class);
    }

    public function test_employee_role_cannot_be_an_administrator(): void
    {
        $this->post('/user-accounts', [
            'account_type' => 'employee', 'operation' => 'create', 'agency_employee_no' => 'EMP-TEST',
            'email' => 'employee@example.test', 'office_code' => 'OFF-7', 'employee_role' => 'System Admin',
        ])->assertSessionHasErrors('employee_role');
        $this->assertSame(1, User::count());
        Notification::assertNothingSent();
    }
}
