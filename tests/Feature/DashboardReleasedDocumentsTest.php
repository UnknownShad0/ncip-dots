<?php

namespace Tests\Feature;

use App\Http\Controllers\DashboardController;
use App\Models\Document;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class DashboardReleasedDocumentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_released_count_survives_receipt_and_counts_each_document_once_per_office(): void
    {
        $sender = Office::create(['name' => 'Sender', 'code' => 'SEND']);
        $receiver = Office::create(['name' => 'Receiver', 'code' => 'RECV']);
        $user = User::factory()->create([
            'office_id' => $sender->id, 'legacy_office_id' => 10,
            'role' => 'Encoder', 'role_id' => 14,
        ]);
        $document = Document::create([
            'title' => 'Current document', 'tracking_number' => 'CURRENT-1',
            'office_id' => $sender->id, 'created_by' => $user->id, 'status' => 'pending',
        ]);
        $currentTrail = ['from_office_id' => $sender->id, 'to_office_id' => $receiver->id, 'created_by' => $user->id];

        $this->assertSame(0, $this->stats($user)['released_documents']);
        $document->trails()->create($currentTrail + ['status' => 'available', 'action' => 'Released']);
        $this->assertSame(1, $this->stats($user)['released_documents']);

        $document->trails()->create($currentTrail + ['status' => 'pending', 'action' => 'Received']);
        $this->assertSame(1, $this->stats($user)['released_documents']);

        // Being the recipient does not count as having released either document.
        $recipient = User::factory()->create([
            'office_id' => $receiver->id, 'legacy_office_id' => 20,
            'role' => 'Encoder', 'role_id' => 14,
        ]);
        $recipientStats = $this->stats($recipient);
        $this->assertSame(0, $recipientStats['released_documents']);
        $this->assertSame(1, $recipientStats['pending_documents']);
        $this->assertSame(0, $recipientStats['incoming_documents']);

        // A repeat release contributes no additional documents.
        $document->trails()->create($currentTrail + ['status' => 'available', 'action' => 'Released again']);
        $this->assertSame(1, $this->stats($user)['released_documents']);
        $this->assertSame(1, $this->stats($recipient)['incoming_documents']);

        // Forwarding from another office still preserves the original sender's count.
        $document->trails()->create([
            'from_office_id' => $receiver->id, 'to_office_id' => $sender->id,
            'status' => 'available', 'action' => 'Forwarded', 'created_by' => $recipient->id,
        ]);
        $this->assertSame(1, $this->stats($user)['released_documents']);
        $this->assertSame(1, $this->stats($recipient)['released_documents']);

        $admin = User::factory()->create(['role' => 'System Admin', 'role_id' => 1]);
        $this->assertSame(1, $this->stats($admin)['released_documents']);
    }

    private function stats(User $user): array
    {
        $this->actingAs($user);
        $request = Request::create('/dashboard');
        $request->headers->set('X-Inertia', 'true');

        return app(DashboardController::class)->index()->toResponse($request)->getData(true)['props']['stats'];
    }
}
