<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\DocumentTrail;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DocumentReceiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_receive_available_document_for_their_office(): void
    {
        [$origin, $destination] = $this->makeOffices();
        $recipient = $this->makeUser($destination);
        $document = $this->makeDocument($origin, $destination, 'DOC-CORRECT');

        $this->receiveAs($recipient, ['tracking_number' => $document->tracking_number])
            ->assertRedirect('/dashboard')
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('document_trails', [
            'document_id' => $document->id,
            'from_office_id' => $origin->id,
            'to_office_id' => $destination->id,
            'created_by' => $recipient->id,
            'status' => 'pending',
            'action' => 'Received',
        ]);
        $this->assertDatabaseHas('documents', ['id' => $document->id, 'status' => 'pending']);
        $this->assertDatabaseHas('audit_trails', [
            'user_id' => $recipient->id,
            'action' => 'document.received',
            'model_id' => $document->id,
        ]);
    }

    public function test_user_cannot_receive_document_addressed_to_another_office(): void
    {
        [$origin, $destination, $otherOffice] = $this->makeOffices(3);
        $recipient = $this->makeUser($otherOffice);
        $document = $this->makeDocument($origin, $destination, 'DOC-WRONG-OFFICE');

        $this->receiveAs($recipient, [
            'tracking_number' => $document->tracking_number,
            'office_id' => $destination->id,
            'can_receive_across_offices' => true,
        ])->assertSessionHasErrors('tracking_number');

        $this->assertNoReceiveSideEffects($document, 1);
    }

    public function test_tracking_number_is_required(): void
    {
        [$origin, $destination] = $this->makeOffices();
        $recipient = $this->makeUser($destination);
        $document = $this->makeDocument($origin, $destination, 'DOC-MISSING-NUMBER');

        $this->receiveAs($recipient, [])->assertSessionHasErrors('tracking_number');

        $this->assertNoReceiveSideEffects($document, 1);
    }

    public function test_unknown_tracking_number_is_rejected(): void
    {
        [, $destination] = $this->makeOffices();
        $recipient = $this->makeUser($destination);

        $this->receiveAs($recipient, ['tracking_number' => 'DOC-UNKNOWN'])
            ->assertSessionHasErrors('tracking_number');

        $this->assertSame(0, DocumentTrail::query()->count());
        $this->assertSame(0, AuditTrail::query()->count());
    }

    public function test_document_with_non_available_latest_trail_cannot_be_received(): void
    {
        [$origin, $destination] = $this->makeOffices();
        $recipient = $this->makeUser($destination);
        $document = $this->makeDocument($origin, $destination, 'DOC-NOT-AVAILABLE', 'pending');

        $this->receiveAs($recipient, ['tracking_number' => $document->tracking_number])
            ->assertSessionHasErrors('tracking_number');

        $this->assertNoReceiveSideEffects($document, 1);
    }

    public function test_archived_document_cannot_be_received(): void
    {
        [$origin, $destination] = $this->makeOffices();
        $recipient = $this->makeUser($destination);
        $document = $this->makeDocument($origin, $destination, 'DOC-ARCHIVED', 'AVAILABLE', true);

        $this->receiveAs($recipient, ['tracking_number' => $document->tracking_number])
            ->assertSessionHasErrors('tracking_number');

        $this->assertNoReceiveSideEffects($document, 1);
    }

    public function test_repeat_receive_attempt_is_rejected_without_extra_trail_or_audit(): void
    {
        [$origin, $destination] = $this->makeOffices();
        $recipient = $this->makeUser($destination);
        $document = $this->makeDocument($origin, $destination, 'DOC-REPEAT');

        $this->receiveAs($recipient, ['tracking_number' => $document->tracking_number])
            ->assertSessionHasNoErrors();
        $this->receiveAs($recipient, ['tracking_number' => $document->tracking_number])
            ->assertSessionHasErrors('tracking_number');

        $this->assertNoReceiveSideEffects($document, 2, 1);
    }

    public function test_executive_global_visibility_does_not_allow_receiving_for_another_office(): void
    {
        [$origin, $adminOffice, $otherOffice] = $this->makeOffices(3);
        $this->configureLegacyDashboardConnection();
        $executive = $this->makeUser($adminOffice, 'Executive', 2, 77);
        $visibleDocument = $this->makeDocument($origin, $adminOffice, 'DOC-GLOBAL-OWN');
        $foreignDocument = $this->makeDocument($origin, $otherOffice, 'DOC-GLOBAL-OTHER');
        DB::table('documents')->where('id', $foreignDocument->id)->update(['updated_at' => now()->addMinute()]);

        $this->actingAs($executive)
            ->get(route('dashboard'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard')
                ->where('canViewIncomingDocuments', true)
                ->where('canReceiveDocuments', true)
                ->has('incomingDocuments', 2)
                ->where('incomingDocuments.0.tracking_number', $foreignDocument->tracking_number)
                ->where('incomingDocuments.0.can_receive', false)
                ->where('incomingDocuments.1.tracking_number', $visibleDocument->tracking_number)
                ->where('incomingDocuments.1.can_receive', true));

        $this->receiveAs($executive, ['tracking_number' => $foreignDocument->tracking_number])
            ->assertSessionHasErrors('tracking_number');

        $this->assertNoReceiveSideEffects($foreignDocument, 1);
    }

    public function test_receive_requires_an_authenticated_session(): void
    {
        $this->post(route('documents.receive'), ['tracking_number' => 'DOC-UNKNOWN'])
            ->assertRedirect(route('login'));

        $this->assertSame(0, DocumentTrail::query()->count());
        $this->assertSame(0, AuditTrail::query()->count());
    }

    private function makeOffices(int $count = 2): array
    {
        return collect(range(1, $count))
            ->map(fn (int $index) => Office::query()->create(['name' => "Office {$index}"]))
            ->all();
    }

    private function makeUser(Office $office, string $role = 'Encoder', int $roleId = 14, ?int $legacyBureauId = null): User
    {
        return User::factory()->create([
            'role' => $role,
            'role_id' => $roleId,
            'office_id' => $office->id,
            'legacy_bureau_id' => $legacyBureauId,
            'email_verified_at' => now(),
        ]);
    }

    private function configureLegacyDashboardConnection(): void
    {
        config(['database.connections.legacy' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]]);
        DB::purge('legacy');

        Schema::connection('legacy')->create('document', function (Blueprint $table) {
            $table->string('trackingNo')->primary();
            $table->string('Archived')->nullable();
        });
        Schema::connection('legacy')->create('document_trail', function (Blueprint $table) {
            $table->integer('docTrailId')->primary();
            $table->string('trackingNo');
            $table->string('status');
            $table->integer('originating')->nullable();
            $table->integer('receiving')->nullable();
            $table->integer('holder')->nullable();
        });
    }

    private function makeDocument(
        Office $origin,
        Office $destination,
        string $trackingNumber,
        string $latestStatus = 'AVAILABLE',
        bool $archived = false,
    ): Document {
        $creator = $this->makeUser($origin, 'Admin Staff', 14);
        $document = Document::query()->create([
            'tracking_number' => $trackingNumber,
            'title' => $trackingNumber,
            'office_id' => $origin->id,
            'created_by' => $creator->id,
            'status' => strtolower($latestStatus),
            'is_finalized' => true,
            'is_archived' => $archived,
        ]);
        $document->trails()->create([
            'from_office_id' => $origin->id,
            'to_office_id' => $destination->id,
            'created_by' => $creator->id,
            'status' => $latestStatus,
            'action' => 'Released',
        ]);

        return $document;
    }

    private function receiveAs(User $user, array $payload)
    {
        return $this->from('/dashboard')
            ->actingAs($user)
            ->post(route('documents.receive'), $payload);
    }

    private function assertNoReceiveSideEffects(Document $document, int $expectedTrailCount, int $expectedAuditCount = 0): void
    {
        $this->assertSame($expectedTrailCount, $document->trails()->count());
        $this->assertSame($expectedAuditCount, AuditTrail::query()->count());
    }
}