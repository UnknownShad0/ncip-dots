<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuditTrailBureauFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_and_executive_can_filter_by_actor_bureau(): void
    {
        $a = Office::create(['name' => 'Bureau A']);
        $b = Office::create(['name' => 'Bureau B']);
        $actor = User::factory()->create(['office_id' => $a->id]);
        $other = User::factory()->create(['office_id' => $b->id]);
        AuditTrail::create(['user_id' => $actor->id, 'action' => 'A action']);
        AuditTrail::create(['user_id' => $other->id, 'action' => 'B action']);
        AuditTrail::create(['action' => 'Unknown actor']);
        foreach ([1, 2] as $role) {
            $viewer = User::factory()->create(['role_id' => $role]);
            $this->actingAs($viewer)->get('/audit-trail?office_id='.$a->id)->assertInertia(fn (Assert $page) => $page
                ->where('canFilterBureaus', true)->has('bureaus', 2)
                ->where('filters.office_id', $a->id)->has('trail', 1)
                ->where('trail.0.action', 'A action')->where('trail.0.user.office.name', 'Bureau A'));
            $this->get('/audit-trail')->assertInertia(fn (Assert $page) => $page->has('trail', 3)->where('filters.office_id', null));
        }
    }

    public function test_other_roles_cannot_submit_bureau_filters_even_with_privileged_name(): void
    {
        $office = Office::create(['name' => 'Bureau']);
        foreach ([3, 14] as $role) {
            $user = User::factory()->create(['role_id' => $role, 'role' => 'Super Admin']);
            $this->actingAs($user)->get('/audit-trail')->assertInertia(fn (Assert $page) => $page->where('canFilterBureaus', false)->has('bureaus', 0));
            $this->get('/audit-trail?office_id='.$office->id)->assertForbidden();
        }
    }

    public function test_admin_staff_only_sees_own_bureau_including_pagination_totals(): void
    {
        $own = Office::create(['name' => 'Own bureau']);
        $other = Office::create(['name' => 'Other bureau']);
        $colleague = User::factory()->create(['office_id' => $own->id]);
        $outsider = User::factory()->create(['office_id' => $other->id]);
        for ($i = 0; $i < 51; $i++) {
            AuditTrail::create(['user_id' => $colleague->id, 'action' => 'Own bureau action']);
        }
        AuditTrail::create(['user_id' => $outsider->id, 'action' => 'Other bureau secret']);
        AuditTrail::create(['action' => 'Unknown actor']);
        foreach ([3, null] as $roleId) {
            $staff = User::factory()->create(['role_id' => $roleId, 'role' => 'Admin_Staff', 'office_id' => $own->id]);
            $this->actingAs($staff)->get('/audit-trail')->assertInertia(fn (Assert $page) => $page
                ->where('canFilterBureaus', false)->where('filters.office_id', $own->id)
                ->has('bureaus', 0)->has('trail', 50)->where('pagination.total', 51)
                ->where('trail', fn ($rows) => collect($rows)->every(fn ($row) => $row['action'] === 'Own bureau action')));
            $this->get('/audit-trail?page=2')->assertInertia(fn (Assert $page) => $page->has('trail', 1)->where('trail.0.action', 'Own bureau action'));
            $this->get('/audit-trail?office_id='.$other->id)->assertForbidden();
            $this->get('/audit-trail?office_id=')->assertInertia(fn (Assert $page) => $page->where('pagination.total', 51));
        }
    }

    public function test_admin_staff_without_assigned_bureau_cannot_see_unassigned_or_other_activity(): void
    {
        $staff = User::factory()->create(['role_id' => 3, 'role' => 'Super Admin', 'office_id' => null]);
        AuditTrail::create(['user_id' => $staff->id, 'action' => 'Unassigned actor']);
        AuditTrail::create(['action' => 'System activity']);
        $this->actingAs($staff)->get('/audit-trail')->assertInertia(fn (Assert $page) => $page
            ->has('trail', 0)->where('pagination.total', 0)->where('canFilterBureaus', false)
            ->where('scopeNotice', fn ($notice) => str_contains($notice, 'no assigned bureau')));
    }

    public function test_name_only_roles_are_supported_and_invalid_offices_are_rejected(): void
    {
        foreach (['Super_Admin', 'System Admin', 'Executive'] as $role) {
            $viewer = User::factory()->create(['role_id' => null, 'role' => $role]);
            $this->actingAs($viewer)->get('/audit-trail')->assertInertia(fn (Assert $page) => $page->where('canFilterBureaus', true));
            $this->getJson('/audit-trail?office_id=999999')->assertUnprocessable()->assertJsonValidationErrors('office_id');
        }
    }

    public function test_pagination_keeps_filter_and_uses_current_assignment(): void
    {
        $office = Office::create(['name' => 'Bureau A']);
        $other = Office::create(['name' => 'Bureau B']);
        $actor = User::factory()->create(['office_id' => $office->id]);
        for ($i = 0; $i < 51; $i++) {
            AuditTrail::create(['user_id' => $actor->id, 'action' => 'Recorded action']);
        }
        $viewer = User::factory()->create(['role_id' => 1]);
        $this->actingAs($viewer)->get('/audit-trail?office_id='.$office->id)->assertInertia(fn (Assert $page) => $page
            ->has('trail', 50)->where('pagination.total', 51)
            ->where('pagination.next_page_url', fn ($url) => str_contains($url, 'office_id='.$office->id) && str_contains($url, 'page=2')));
        $this->get('/audit-trail?office_id='.$office->id.'&page=2')->assertInertia(fn (Assert $page) => $page->has('trail', 1));
        $actor->update(['office_id' => $other->id]);
        $this->get('/audit-trail?office_id='.$office->id)->assertInertia(fn (Assert $page) => $page->has('trail', 0));
    }
}
