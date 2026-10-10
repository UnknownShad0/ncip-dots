<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DocumentReceivingPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_system_admin_cannot_receive_even_for_their_own_office(): void
    {
        [$user, $document] = $this->scenario(1, 'System Admin');
        $this->actingAs($user)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
            ->where('canReceiveDocuments', false)->has('incomingDocuments', 1)
            ->where('incomingDocuments.0.id', $document->id));
        foreach (['/documents', '/documents/latest'] as $url) {
            $this->get($url)->assertInertia(fn (Assert $page) => $page
                ->where('documents.0.can_receive', false));
        }
        $this->post("/documents/{$document->id}/receive")->assertForbidden();
        $this->assertSame('available', $document->fresh()->status);
        $this->assertSame(1, $document->trails()->count());
    }

    public function test_operational_roles_can_receive_for_their_own_office_only_once(): void
    {
        foreach ([2 => 'Executive', 3 => 'Admin Staff', 14 => 'Encoder'] as $roleId => $role) {
            [$user, $document] = $this->scenario($roleId, $role);
            $this->actingAs($user)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
                ->where('canReceiveDocuments', true)->has('incomingDocuments', 1)
                ->where('incomingDocuments.0.id', $document->id));
            $this->get('/documents/latest')->assertInertia(fn (Assert $page) => $page
                ->where('documents.0.can_receive', true));
            $this->post("/documents/{$document->id}/receive")->assertRedirect()->assertSessionHasNoErrors();
            $this->assertSame('pending', $document->fresh()->status);
            $this->assertSame($user->office_id, $document->fresh()->latestTrail->to_office_id);
            $this->post("/documents/{$document->id}/receive")->assertSessionHasErrors('tracking_number');
            $this->assertSame(2, $document->trails()->count());
        }
    }

    public function test_cross_office_receiving_is_denied_even_for_executives_with_global_visibility(): void
    {
        foreach ([2 => 'Executive', 3 => 'Admin Staff', 14 => 'Encoder'] as $roleId => $role) {
            [$user, $document] = $this->scenario($roleId, $role);
            $user->update(['office_id' => Office::create(['name' => 'Other office', 'code' => 'OTHER-'.$roleId])->id]);
            $this->actingAs($user)->get('/dashboard')->assertInertia(fn (Assert $page) => $page
                ->has('incomingDocuments', 0));
            $this->post("/documents/{$document->id}/receive")->assertSessionHasErrors('tracking_number');
            $this->assertSame('available', $document->fresh()->status);
            $this->assertSame(1, $document->trails()->count());
        }
    }

    public function test_receiving_requires_an_office(): void
    {
        [$user, $document] = $this->scenario(14, 'Encoder');
        $user->update(['office_id' => null]);
        $this->actingAs($user)->post("/documents/{$document->id}/receive")->assertForbidden();
    }

    public function test_role_names_are_normalized_only_when_no_role_id_is_assigned(): void
    {
        foreach (['Executive', 'Executives', ' Admin_Staff ', 'ENCODER'] as $role) {
            $this->assertTrue((new User(['role' => $role]))->canReceiveDocuments());
        }
        foreach (['System Admin', 'Super Admin', 'Admin', 'Administrator', 'Viewer'] as $role) {
            $this->assertFalse((new User(['role' => $role]))->canReceiveDocuments());
        }
        $this->assertFalse((new User(['role_id' => 1, 'role' => 'Encoder']))->canReceiveDocuments());
        $this->assertFalse((new User(['role_id' => 99, 'role' => 'Encoder']))->canReceiveDocuments());
    }

    private function scenario(int $roleId, string $role): array
    {
        $office = Office::create(['name' => 'Receiving office', 'code' => 'RECV-'.$roleId]);
        $user = User::factory()->create(['office_id' => $office->id, 'role_id' => $roleId, 'role' => $role]);
        $document = Document::create([
            'title' => 'Receiving permissions', 'tracking_number' => 'RECEIVE-'.$roleId,
            'office_id' => $office->id, 'created_by' => $user->id, 'status' => 'available',
        ]);
        $document->trails()->create([
            'from_office_id' => $office->id, 'to_office_id' => $office->id,
            'created_by' => $user->id, 'status' => 'available', 'action' => 'Released',
        ]);

        return [$user, $document];
    }
}
