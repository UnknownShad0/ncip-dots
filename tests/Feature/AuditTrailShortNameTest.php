<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AuditTrailShortNameTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_trail_displays_a_short_user_name(): void
    {
        $user = User::factory()->create([
            'name' => 'Alexandra Molina',
            'firstname' => 'Alexandra',
            'lastname' => 'Molina',
        ]);
        AuditTrail::query()->create(['user_id' => $user->id, 'action' => 'Updated office']);

        $this->actingAs($user)->get('/audit-trail')->assertInertia(fn (Assert $page) => $page
            ->component('AuditTrail/Index')
            ->where('trail.0.user.short_name', 'A. Molina')
            ->where('trail.0.user.name', 'Alexandra Molina'));
    }
}
