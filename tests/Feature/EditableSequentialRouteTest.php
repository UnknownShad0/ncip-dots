<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\Office;
use App\Models\Range;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EditableSequentialRouteTest extends TestCase
{
    use RefreshDatabase;

    public function test_route_creator_can_reorder_and_add_waiting_offices_without_changing_locked_steps(): void
    {
        $scenario = $this->scenario();
        $route = $scenario['route'];
        $approvedStep = $route->steps()->where('status', 'approved')->firstOrFail();
        $availableStep = $route->steps()->where('status', 'available')->firstOrFail();
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['second']->id, $scenario['offices']['fourth']->id, $scenario['offices']['third']->id],
            'reason' => 'Move the additional review ahead of the last waiting office.',
            'revision' => $revision,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $steps = $route->fresh()->steps()->orderBy('position')->get();
        $this->assertSame([
            $scenario['offices']['first']->id,
            $scenario['offices']['second']->id,
            $scenario['offices']['fourth']->id,
            $scenario['offices']['third']->id,
        ], $steps->pluck('office_id')->all());
        $this->assertSame(['approved', 'available', 'waiting', 'waiting'], $steps->pluck('status')->all());
        $this->assertSame([1, 2, 3, 4], $steps->pluck('position')->all());
        $this->assertSame($approvedStep->id, $steps[0]->id);
        $this->assertSame($availableStep->id, $steps[1]->id);

        $audit = AuditTrail::query()->where('action', 'document.route_updated')->firstOrFail();
        $this->assertStringContainsString('Move the additional review', $audit->details);
        $this->assertStringContainsString('"before"', $audit->details);
        $this->assertStringContainsString('"after"', $audit->details);
    }

    public function test_unreceived_available_office_can_be_replaced_with_preserved_dispatch_history(): void
    {
        $scenario = $this->scenario();
        $oldAvailable = $scenario['route']->steps()->where('status', 'available')->firstOrFail();
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['fourth']->id, $scenario['offices']['third']->id],
            'reason' => 'The currently assigned office is unavailable.',
            'revision' => $revision,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $steps = $scenario['route']->fresh()->steps()->orderBy('position')->get();
        $this->assertSame([
            $scenario['offices']['first']->id,
            $scenario['offices']['fourth']->id,
            $scenario['offices']['third']->id,
        ], $steps->pluck('office_id')->all());
        $this->assertSame(['approved', 'available', 'waiting'], $steps->pluck('status')->all());
        $this->assertDatabaseMissing('document_route_steps', ['id' => $oldAvailable->id]);
        $this->assertDatabaseHas('document_trails', [
            'document_id' => $scenario['document']->id,
            'to_office_id' => $scenario['offices']['second']->id,
            'status' => 'cancelled',
            'action' => 'Approval assignment cancelled before receipt',
        ]);
        $this->assertDatabaseHas('document_trails', [
            'document_id' => $scenario['document']->id,
            'to_office_id' => $scenario['offices']['fourth']->id,
            'status' => 'available',
        ]);
    }

    public function test_received_and_approved_steps_remain_locked_while_future_steps_are_editable(): void
    {
        $scenario = $this->scenario();
        $receiver = User::query()->where('office_id', $scenario['offices']['second']->id)->firstOrFail();
        $receivedStep = $scenario['route']->steps()->where('status', 'available')->firstOrFail();
        $receivedStep->update(['status' => 'in_progress', 'received_by' => $receiver->id, 'received_at' => now()]);
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['fourth']->id, $scenario['offices']['third']->id],
            'reason' => 'Update only the offices that have not received the document.',
            'revision' => $revision,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $steps = $scenario['route']->fresh()->steps()->orderBy('position')->get();
        $this->assertSame([
            $scenario['offices']['first']->id,
            $scenario['offices']['second']->id,
            $scenario['offices']['fourth']->id,
            $scenario['offices']['third']->id,
        ], $steps->pluck('office_id')->all());
        $this->assertSame(['approved', 'in_progress', 'waiting', 'waiting'], $steps->pluck('status')->all());
        $this->assertSame($receivedStep->id, $steps[1]->id);

        $freshRevision = $this->revision($scenario['document']);
        $this->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['first']->id, $scenario['offices']['third']->id],
            'reason' => 'Attempt to re-add a locked office.',
            'revision' => $freshRevision,
        ])->assertSessionHasErrors('office_ids');
        $this->assertSame('in_progress', $receivedStep->fresh()->status);
    }

    public function test_stale_route_revision_is_rejected_after_an_office_receives_the_document(): void
    {
        $scenario = $this->scenario();
        $revision = $this->revision($scenario['document']);
        $receiver = User::query()->where('office_id', $scenario['offices']['second']->id)->firstOrFail();
        $scenario['route']->steps()->where('status', 'available')->firstOrFail()->update([
            'status' => 'in_progress',
            'received_by' => $receiver->id,
            'received_at' => now(),
        ]);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['fourth']->id],
            'reason' => 'This request was based on an older route state.',
            'revision' => $revision,
        ])->assertSessionHasErrors('route');

        $this->assertSame(3, $scenario['route']->fresh()->steps()->count());
        $this->assertDatabaseMissing('audit_trails', ['action' => 'document.route_updated']);
    }

    public function test_removing_the_last_unreceived_step_completes_a_route_with_only_approved_steps_left(): void
    {
        $scenario = $this->scenario();
        $scenario['route']->steps()->where('status', 'waiting')->delete();
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [],
            'reason' => 'The final unreceived office is no longer required.',
            'revision' => $revision,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('approved', $scenario['route']->fresh()->status);
        $this->assertNotNull($scenario['route']->fresh()->completed_at);
        $this->assertSame('approved', $scenario['document']->fresh()->status);
        $this->assertSame('approved', $scenario['document']->fresh()->approval_status);
        $this->assertSame(['approved'], $scenario['route']->fresh()->steps()->pluck('status')->all());
    }

    public function test_sequential_approval_activates_the_next_waiting_position_even_if_legacy_positions_have_a_gap(): void
    {
        $scenario = $this->scenario();
        $activeStep = $scenario['route']->steps()->where('position', 1)->firstOrFail();
        $nextStep = $scenario['route']->steps()->where('position', 2)->firstOrFail();
        $scenario['route']->steps()->where('position', 3)->delete();
        $activeStep->update([
            'status' => 'in_progress',
            'decision' => null,
            'decided_by' => null,
            'decided_at' => null,
        ]);
        $nextStep->update(['position' => 3, 'status' => 'waiting']);
        $approver = User::query()->where('office_id', $scenario['offices']['first']->id)->firstOrFail();
        $scenario['document']->trails()->create([
            'from_office_id' => $scenario['origin']->id,
            'to_office_id' => $scenario['offices']['first']->id,
            'created_by' => $scenario['creator']->id,
            'status' => 'pending',
            'action' => 'Received for approval',
        ]);

        $this->actingAs($approver)->post('/documents/'.$scenario['document']->id.'/approval', [
            'decision' => 'approved',
            'remarks' => 'Approved with a legacy position gap.',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('approved', $activeStep->fresh()->status);
        $this->assertSame('available', $nextStep->fresh()->status);
        $this->assertDatabaseHas('document_trails', [
            'document_id' => $scenario['document']->id,
            'to_office_id' => $nextStep->office_id,
            'status' => 'available',
            'action' => 'Advanced to sequential approval step 3',
        ]);
    }

    public function test_unrelated_users_cannot_edit_remaining_steps(): void
    {
        $scenario = $this->scenario();
        $revision = $this->revision($scenario['document']);
        $unrelated = User::factory()->create([
            'office_id' => $scenario['origin']->id,
            'role_id' => 14,
            'is_active' => true,
        ]);

        $this->actingAs($unrelated)->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['second']->id],
            'reason' => 'Unauthorized correction.',
            'revision' => $revision,
        ])->assertForbidden();
    }

    public function test_route_creator_can_add_a_forgotten_office_to_an_active_parallel_route(): void
    {
        $scenario = $this->scenario();
        $scenario['route']->update(['mode' => 'parallel']);
        $thirdStep = $scenario['route']->steps()->where('office_id', $scenario['offices']['third']->id)->firstOrFail();
        $thirdStep->update(['status' => 'available']);
        $secondStep = $scenario['route']->steps()->where('office_id', $scenario['offices']['second']->id)->firstOrFail();
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [
                $scenario['offices']['second']->id,
                $scenario['offices']['third']->id,
                $scenario['offices']['fourth']->id,
            ],
            'reason' => 'Add the office that was missed in the original parallel route.',
            'revision' => $revision,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $steps = $scenario['route']->fresh()->steps()->orderBy('position')->get();
        $this->assertSame(4, $steps->count());
        $this->assertSame('approved', $steps->firstWhere('office_id', $scenario['offices']['first']->id)->status);
        $this->assertSame($secondStep->id, $steps->firstWhere('office_id', $scenario['offices']['second']->id)->id);
        $this->assertSame($thirdStep->id, $steps->firstWhere('office_id', $scenario['offices']['third']->id)->id);
        $this->assertSame('available', $steps->firstWhere('office_id', $scenario['offices']['fourth']->id)->status);
        $this->assertDatabaseHas('document_trails', [
            'document_id' => $scenario['document']->id,
            'to_office_id' => $scenario['offices']['fourth']->id,
            'status' => 'available',
            'action' => 'Added to the active parallel approval route',
        ]);
    }

    public function test_parallel_editor_can_remove_only_unreceived_offices_and_keeps_received_steps_locked(): void
    {
        $scenario = $this->scenario();
        $scenario['route']->update(['mode' => 'parallel']);
        $receivedStep = $scenario['route']->steps()->where('office_id', $scenario['offices']['third']->id)->firstOrFail();
        $receiver = User::query()->where('office_id', $scenario['offices']['third']->id)->firstOrFail();
        $receivedStep->update(['status' => 'in_progress', 'received_by' => $receiver->id, 'received_at' => now()]);
        $removedStep = $scenario['route']->steps()->where('office_id', $scenario['offices']['second']->id)->firstOrFail();
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['fourth']->id],
            'reason' => 'Replace the unreceived office while preserving the office already reviewing.',
            'revision' => $revision,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $steps = $scenario['route']->fresh()->steps;
        $this->assertDatabaseMissing('document_route_steps', ['id' => $removedStep->id]);
        $this->assertSame('in_progress', $steps->firstWhere('office_id', $scenario['offices']['third']->id)->status);
        $this->assertSame($receivedStep->id, $steps->firstWhere('office_id', $scenario['offices']['third']->id)->id);
        $this->assertSame('available', $steps->firstWhere('office_id', $scenario['offices']['fourth']->id)->status);
        $this->assertDatabaseHas('document_trails', [
            'document_id' => $scenario['document']->id,
            'to_office_id' => $scenario['offices']['second']->id,
            'status' => 'cancelled',
            'action' => 'Parallel approval assignment cancelled before receipt',
        ]);
    }

    public function test_reordering_parallel_offices_is_not_treated_as_a_route_change(): void
    {
        $scenario = $this->scenario();
        $scenario['route']->update(['mode' => 'parallel']);
        $scenario['route']->steps()->where('office_id', $scenario['offices']['third']->id)->update(['status' => 'available']);
        $revision = $this->revision($scenario['document']);

        $this->actingAs($scenario['creator'])->put($this->updateUrl($scenario), [
            'office_ids' => [$scenario['offices']['third']->id, $scenario['offices']['second']->id],
            'reason' => 'Changing display order should not change a parallel route.',
            'revision' => $revision,
        ])->assertSessionHasErrors('office_ids');

        $this->assertSame(3, $scenario['route']->fresh()->steps()->count());
        $this->assertDatabaseMissing('audit_trails', ['action' => 'document.route_updated']);
    }

    private function revision(Document $document): string
    {
        return (string) $this->actingAs($document->creator)->getJson('/documents/'.$document->id.'/details')
            ->assertOk()
            ->json('editable_route.revision');
    }

    private function updateUrl(array $scenario): string
    {
        return '/documents/'.$scenario['document']->id.'/routes/'.$scenario['route']->id.'/remaining-steps';
    }

    private function scenario(): array
    {
        $range = Range::create(['name' => 'Central']);
        $origin = Office::create(['name' => 'Origin Office', 'range_id' => $range->id]);
        $offices = collect(['first', 'second', 'third', 'fourth'])->mapWithKeys(function (string $key) use ($range) {
            $office = Office::create(['name' => ucfirst($key).' Office', 'range_id' => $range->id]);
            User::factory()->create(['office_id' => $office->id, 'role_id' => 3, 'is_active' => true]);

            return [$key => $office];
        })->all();
        $creator = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3, 'is_active' => true]);
        $document = Document::create([
            'title' => 'Editable sequential route',
            'tracking_number' => 'EDIT-ROUTE-001',
            'office_id' => $origin->id,
            'created_by' => $creator->id,
            'status' => 'pending',
            'approval_status' => 'awaiting_approval',
            'is_finalized' => true,
        ]);
        $route = $document->routes()->create([
            'created_by' => $creator->id,
            'from_office_id' => $origin->id,
            'mode' => 'sequential',
            'status' => 'pending',
            'started_at' => now(),
        ]);
        $route->steps()->create([
            'office_id' => $offices['first']->id,
            'position' => 1,
            'status' => 'approved',
            'decision' => 'approved',
            'decided_by' => User::query()->where('office_id', $offices['first']->id)->value('id'),
            'decided_at' => now(),
        ]);
        $dispatch = $document->trails()->create([
            'from_office_id' => $origin->id,
            'to_office_id' => $offices['second']->id,
            'created_by' => $creator->id,
            'status' => 'available',
            'action' => 'Advanced to sequential approval step 2',
        ]);
        $route->steps()->create([
            'office_id' => $offices['second']->id,
            'position' => 2,
            'status' => 'available',
            'dispatch_trail_id' => $dispatch->id,
        ]);
        $route->steps()->create([
            'office_id' => $offices['third']->id,
            'position' => 3,
            'status' => 'waiting',
        ]);

        return compact('origin', 'offices', 'creator', 'document', 'route');
    }
}
