<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Office;
use App\Models\User;
use App\Services\AuditTrailWriter;
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

    public function test_native_audit_records_actor_and_bureau_snapshots(): void
    {
        $office = Office::create(['name' => 'Bureau A']);
        $user = User::factory()->create(['office_id' => $office->id, 'name' => 'Alexandra Molina']);

        $entry = app(AuditTrailWriter::class)->record('user.updated', $user, [
            'credentials_changed' => true,
        ], actor: $user);
        $user->update(['office_id' => null, 'name' => 'Alex Molina']);

        $this->assertSame('Alexandra Molina', $entry->fresh()->actor_name);
        $this->assertSame($office->id, $entry->fresh()->actor_office_id);
        $this->assertSame('Bureau A', $entry->fresh()->actor_office_name);
        $this->assertSame('success', $entry->fresh()->result);
        $this->assertStringNotContainsString('secret-value', $entry->fresh()->details);
    }
}
