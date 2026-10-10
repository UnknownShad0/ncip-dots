<?php

namespace Tests\Feature;

use App\Models\{ActionType, Document, Office, Range, User};
use App\Services\DocumentAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Http, Notification};
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class EmployeeOfficeAssignmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_can_use_an_imported_office_with_a_different_hris_division_code(): void
    {
        Notification::fake();
        $range = Range::create(['name' => 'Central', 'legacy_range_id' => 77]);
        $office = Office::create(['name' => 'OPPR', 'code' => 'OLD-OPPR', 'range_id' => $range->id, 'legacy_bureau_id' => 500]);
        $admin = User::factory()->create(['role_id' => 1]);
        $document = Document::create(['title' => 'Old document', 'tracking_number' => 'OLD-1', 'office_id' => $office->id, 'created_by' => $admin->id, 'legacy_doc_id' => 100]);
        $this->actingAs($admin)->get('/user-accounts')->assertInertia(fn (Assert $page) => $page
            ->where('officeTableOptions.0.id', 'new-'.$office->id)->where('officeTableOptions.0.range_name', 'Central'));
        $this->withSession($this->lookup())->post('/user-accounts', $this->payload('new-'.$office->id))
            ->assertSessionHasNoErrors()->assertRedirect('/user-accounts');
        $user = User::where('employee_code', 'EMP-TEST')->firstOrFail();
        $this->assertSame($office->id, $user->office_id);
        $this->assertSame('OLD-OPPR', $user->office_code);
        $this->assertSame('DIV-NEW', $user->division_code);
        $this->assertNull($user->region_code);
        $this->assertSame(1, Office::count());
        $this->assertTrue(app(DocumentAccess::class)->scope(Document::query(), $user)->whereKey($document->id)->exists());
    }

    public function test_missing_office_or_range_cannot_create_an_employee_account(): void
    {
        Notification::fake();
        $this->actingAs(User::factory()->create(['role_id' => 1]));
        $office = Office::create(['name' => 'Unmapped', 'code' => 'OLD']);
        foreach (['legacy-500', 'new-99999', 'new-'.$office->id] as $selection) {
            $this->withSession($this->lookup())->post('/user-accounts', $this->payload($selection))
                ->assertSessionHasErrors('office_table_id');
        }
        $this->assertSame(1, User::count());
        Notification::assertNothingSent();
    }

    public function test_employee_lookup_no_longer_requires_the_hris_office_api(): void
    {
        config(['services.hris.use_sample_data' => false, 'services.hris.url' => 'https://hris.example.test', 'services.hris.employee_path' => 'employee']);
        Http::preventStrayRequests();
        Http::fake(['https://hris.example.test/employee/EMP-TEST' => Http::response($this->lookup()['hris_employee_lookup']['employee'])]);
        $this->actingAs(User::factory()->create(['role_id' => 1]))
            ->postJson('/user-accounts/lookup-employee', ['employee_code' => 'EMP-TEST'])
            ->assertOk()->assertJsonPath('employee.employee_code', 'EMP-TEST');
        Http::assertSentCount(1);
    }

    public function test_routing_uses_local_range_even_when_user_has_a_different_hris_region(): void
    {
        $range = Range::create(['name' => 'Assigned range']);
        $otherRange = Range::create(['name' => 'Other range']);
        $source = Office::create(['name' => 'Source', 'range_id' => $range->id]);
        $same = Office::create(['name' => 'Same range', 'range_id' => $range->id]);
        $other = Office::create(['name' => 'Other range', 'range_id' => $otherRange->id]);
        $user = User::factory()->create(['office_id' => $source->id, 'role_id' => 3, 'region_code' => 'HRIS-OTHER']);
        foreach ([$same, $other] as $office) {
            User::factory()->create(['office_id' => $office->id, 'is_active' => true]);
        }
        $document = Document::create(['title' => 'Route me', 'tracking_number' => 'ROUTE-1', 'office_id' => $source->id, 'created_by' => $user->id, 'status' => 'pending']);
        $document->trails()->create(['from_office_id' => $source->id, 'to_office_id' => $source->id, 'created_by' => $user->id, 'status' => 'pending']);
        $action = ActionType::create(['name' => 'For review', 'is_active' => true]);
        $this->actingAs($user)->get('/documents/latest')->assertInertia(fn (Assert $page) => $page
            ->has('offices', 2)->where('offices', fn ($offices) => collect($offices)->pluck('id')->sort()->values()->all() === collect([$source->id, $same->id])->map(fn ($id) => (string) $id)->sort()->values()->all()));
        $this->post('/documents/'.$document->id.'/release', ['action_type_id' => $action->id, 'to_office_id' => $other->id])->assertSessionHasErrors('to_office_id');
        $this->post('/documents/'.$document->id.'/release', ['action_type_id' => $action->id, 'to_office_id' => $same->id])->assertSessionHasNoErrors()->assertRedirect();
        $this->assertSame($same->id, $document->fresh()->latestTrail->to_office_id);
    }

    private function lookup(): array
    {
        return ['hris_employee_lookup' => ['employee' => ['employee_code' => 'EMP-TEST', 'username' => 'employee.test', 'first_name' => 'Test', 'last_name' => 'Employee', 'division_code' => 'DIV-NEW'], 'offices' => []]];
    }

    private function payload(string $office): array
    {
        return ['operation' => 'create', 'account_type' => 'employee', 'employee_code' => 'EMP-TEST', 'email' => 'employee@example.test', 'employee_role' => 'Admin Staff', 'office_table_id' => $office];
    }
}
