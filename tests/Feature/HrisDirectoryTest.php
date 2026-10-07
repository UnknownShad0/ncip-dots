<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\HrisDirectory;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class HrisDirectoryTest extends TestCase
{
    public function test_sample_credentials_are_valid_without_calling_api(): void
    {
        config(['services.hris.use_sample_data' => true, 'services.hris.url' => null]);
        Http::fake();

        $this->assertTrue(app(HrisDirectory::class)->verifyCredentials('sample.user', 'sample-password'));
        Http::assertNothingSent();
    }

    public function test_real_credentials_use_api_response_when_sample_mode_is_disabled(): void
    {
        config([
            'services.hris.use_sample_data' => false,
            'services.hris.url' => 'https://hris.example.test',
            'services.hris.credentials_path' => '/api/login-credentials/verify',
        ]);
        Http::fake([
            'hris.example.test/api/login-credentials/verify' => Http::sequence()
                ->push(['valid' => true])->push(['valid' => false]),
        ]);

        $directory = app(HrisDirectory::class);
        $this->assertTrue($directory->verifyCredentials('sample.user', 'correct-password'));
        $this->assertFalse($directory->verifyCredentials('sample.user', 'wrong-password'));
        Http::assertSentCount(2);
    }

    public function test_sample_lookup_uses_employee_code_without_network_requests(): void
    {
        config(['services.hris.use_sample_data' => true, 'services.hris.url' => null]);
        Http::preventStrayRequests();
        Http::fake();

        $result = app(HrisDirectory::class)->lookup('EMP-12149');
        $this->assertNotNull($result);
        $this->assertSame('EMP-12149', $result['employee']['employee_code']);
        $this->assertNotEmpty($result['offices']);
        Http::assertNothingSent();
    }

    public function test_sample_lookup_does_not_match_agency_employee_number(): void
    {
        config(['services.hris.use_sample_data' => true]);
        Http::fake();
        $this->assertNull(app(HrisDirectory::class)->lookup('EMP-7846'));
        $this->assertNull(app(HrisDirectory::class)->lookup('UNKNOWN'));
        Http::assertNothingSent();
    }

    public function test_real_lookup_calls_employee_code_path_and_matches_division(): void
    {
        config([
            'services.hris.use_sample_data' => false,
            'services.hris.url' => 'https://hris.example.test',
            'services.hris.employee_path' => '/api/employee',
            'services.hris.office_path' => '/api/offices',
        ]);
        Http::preventStrayRequests();
        Http::fake([
            'hris.example.test/api/employee/EMP-12149' => Http::response(['employee' => [
                'employee_code' => 'EMP-12149', 'agency_employee_no' => 'DIFFERENT-NUMBER', 'division_code' => 'DIV-1',
            ]]),
            'hris.example.test/api/offices*' => Http::response([
                ['code' => 'OFF-1', 'name' => 'Matched office', 'divisions' => [['code' => 'DIV-1']]],
                ['code' => 'OFF-2', 'name' => 'Other office', 'divisions' => [['code' => 'DIV-2']]],
            ]),
        ]);

        $result = app(HrisDirectory::class)->lookup('EMP-12149');
        $this->assertSame('EMP-12149', $result['employee']['employee_code']);
        $this->assertCount(1, $result['offices']);
        $this->assertSame('OFF-1', $result['offices'][0]['office_code']);
        Http::assertSent(fn ($request) => $request->url() === 'https://hris.example.test/api/employee/EMP-12149');
        Http::assertSentCount(2);
    }

    public function test_modal_lookup_accepts_employee_code_in_sample_mode(): void
    {
        config(['services.hris.use_sample_data' => true]);
        Http::fake();
        $admin = new User(['name' => 'Admin', 'role_id' => 1]);
        $admin->id = 1;
        $this->actingAs($admin)->postJson('/user-accounts/lookup-employee', ['employee_code' => 'EMP-12149'])
            ->assertOk()->assertJsonPath('employee.employee_code', 'EMP-12149');
        Http::assertNothingSent();
    }
}
