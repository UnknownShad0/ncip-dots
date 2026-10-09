<?php

namespace Tests\Feature;

use App\Models\DocumentCreationDraft;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DocumentCreationOfficeApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_approver_offices_are_unique_and_require_an_active_admin(): void
    {
        $office = $this->office('Regional Office');
        $otherOffice = $this->office('Central Office');
        $creator = $this->user($office, 'Encoder', 14);
        $this->user($office, 'Admin Staff', 3);
        $this->user($office, 'System Admin', 1);
        $this->user($otherOffice, 'Admin Staff', 3, false);
        $this->actingAs($creator);

        $this->get('/document-creation')->assertInertia(fn (Assert $page) => $page
            ->component('DocumentCreation/Index')
            ->has('approverOffices', 1)
            ->where('approverOffices.0.name', 'Regional Office'));
    }

    public function test_any_active_admin_in_the_assigned_office_can_decide_and_other_offices_cannot(): void
    {
        $creatorOffice = $this->office('Creator Office');
        $approverOffice = $this->office('Approver Office');
        $otherOffice = $this->office('Other Office');
        $creator = $this->user($creatorOffice, 'Encoder', 14);
        $this->user($approverOffice, 'Admin Staff', 3);
        $secondOfficeAdmin = $this->user($approverOffice, 'System Admin', 1);
        $officeMember = $this->user($approverOffice, 'Encoder', 14);
        $otherOfficeAdmin = $this->user($otherOffice, 'Admin Staff', 3);
        $draft = $this->draft($creator);

        $this->actingAs($creator)->post("/document-creation/{$draft->id}/submit", [
            'approver_office_id' => $approverOffice->id,
        ])->assertRedirect();

        $draft->refresh();
        $this->assertSame($approverOffice->id, $draft->approver_office_id);
        $this->assertNull($draft->approver_id);

        $this->actingAs($otherOfficeAdmin)->get('/document-creation?queue=approval')
            ->assertInertia(fn (Assert $page) => $page->has('drafts', 0));
        $this->actingAs($officeMember)->get('/document-creation?queue=approval')
            ->assertInertia(fn (Assert $page) => $page->has('drafts', 0));
        $this->actingAs($otherOfficeAdmin)->post("/document-creation/{$draft->id}/decision", [
            'decision' => 'approved',
            'version_number' => $draft->version_number,
        ])->assertForbidden();
        $this->actingAs($officeMember)->post("/document-creation/{$draft->id}/decision", [
            'decision' => 'approved',
            'version_number' => $draft->version_number,
        ])->assertForbidden();

        $this->actingAs($secondOfficeAdmin)->post("/document-creation/{$draft->id}/decision", [
            'decision' => 'approved',
            'version_number' => $draft->version_number,
        ])->assertRedirect();

        $this->assertSame('approved', $draft->fresh()->status);
        $this->assertSame($secondOfficeAdmin->id, $draft->fresh()->decided_by);
    }

    private function office(string $name): Office
    {
        return Office::query()->create(['name' => $name, 'code' => str($name)->slug()->upper()->value()]);
    }

    private function user(Office $office, string $role, int $roleId, bool $active = true): User
    {
        return User::factory()->create([
            'name' => $role.' '.$office->name,
            'email' => fake()->unique()->safeEmail(),
            'role' => $role,
            'role_id' => $roleId,
            'office_id' => $office->id,
            'is_active' => $active,
            'email_verified_at' => now(),
        ]);
    }

    private function draft(User $creator): DocumentCreationDraft
    {
        $documentType = DocumentType::query()->create(['name' => 'Memo', 'is_active' => true]);
        $draft = DocumentCreationDraft::query()->create([
            'document_type_id' => $documentType->id,
            'created_by' => $creator->id,
            'title' => 'Approval test',
            'content' => ['subject' => 'Test', 'from' => $creator->name, 'body' => 'Test content'],
            'status' => 'draft',
        ]);

        return $draft;
    }
}
