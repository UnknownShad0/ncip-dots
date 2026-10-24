<?php

namespace Tests\Feature;

use App\Models\ActionType;
use App\Models\Document;
use App\Models\DocumentAccessOtpChallenge;
use App\Models\Office;
use App\Models\Range;
use App\Models\User;
use App\Services\EmailNotificationMailer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery;
use Tests\TestCase;

class QrDocumentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_an_eligible_existing_dots_user_gets_a_real_challenge(): void
    {
        [$user, $document] = $this->scenario(roleId: 3);
        $code = $this->captureOtp();

        $this->post($this->signedOtpUrl($document), ['email' => $user->email])
            ->assertRedirect()->assertSessionHasNoErrors();

        $this->assertDatabaseCount('document_access_otp_challenges', 1);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code());

        $this->post($this->signedOtpUrl($document), ['email' => 'not-a-user@example.test'])
            ->assertRedirect()->assertSessionHasErrors([
                'email' => 'This email is not registered in DOTS. Check the address or contact the DOTS administrator.',
            ]);

        $this->assertDatabaseCount('document_access_otp_challenges', 1);
    }

    public function test_finalized_but_unrouted_document_does_not_offer_qr_processing(): void
    {
        $office = Office::create(['name' => 'Origin only']);
        $creator = User::factory()->create(['office_id' => $office->id, 'role_id' => 3, 'is_active' => true]);
        $document = Document::create([
            'title' => 'Finalized but not forwarded',
            'tracking_number' => 'QR-NOT-ROUTED',
            'office_id' => $office->id,
            'created_by' => $creator->id,
            'status' => 'pending',
            'approval_status' => 'not_required',
            'is_finalized' => true,
        ]);

        $this->get(URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('workflow.state', 'public')
                ->where('workflow.can_start', false));
    }

    public function test_existing_but_ineligible_user_gets_an_actionable_error(): void
    {
        [, $document] = $this->scenario(roleId: 3, suffix: 'INELIGIBLE');
        $otherOffice = Office::create(['name' => 'Wrong Office']);
        $user = User::factory()->create([
            'office_id' => $otherOffice->id,
            'role_id' => 3,
            'is_active' => true,
            'is_locked' => false,
            'email_verified_at' => now(),
        ]);

        $this->post($this->signedOtpUrl($document), ['email' => $user->email])
            ->assertRedirect()->assertSessionHasErrors('email');

        $this->assertDatabaseCount('document_access_otp_challenges', 0);
    }

    public function test_successful_otp_verifies_an_existing_imported_users_email(): void
    {
        [$user, $document] = $this->scenario(roleId: 3, suffix: 'UNVERIFIED');
        $user->forceFill(['email_verified_at' => null])->save();
        $this->assertNull($user->fresh()->email_verified_at);

        $this->authenticateQrSession($user, $document);

        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->get(URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]))
            ->assertInertia(fn (Assert $page) => $page->where('workflow.state', 'verified'));
    }

    public function test_email_otp_creates_document_scoped_access_then_receive_and_approve_work(): void
    {
        [$user, $document, $step] = $this->scenario(roleId: 3);
        $this->authenticateQrSession($user, $document);

        $this->get(URL::signedRoute('documents.track', ['trackingNumber' => $document->tracking_number]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('workflow.state', 'verified')
                ->where('workflow.can_receive', true)
                ->where('workflow.user.office', $user->office->name)
                ->where('auth.user', null));

        $this->post(route('documents.track.receive', $document->tracking_number))
            ->assertRedirect()->assertSessionHasNoErrors();
        $this->assertSame('in_progress', $step->fresh()->status);

        $this->post(route('documents.track.decision', $document->tracking_number), [
            'decision' => 'approved',
            'remarks' => 'Checked from the QR workflow.',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('approved', $step->fresh()->status);
        $this->assertSame('approved', $document->fresh()->approval_status);
        $this->assertDatabaseHas('audit_trails', [
            'action' => 'document.qr_otp_authenticated',
            'user_id' => $user->id,
        ]);
    }

    public function test_receiver_can_receive_but_cannot_approve(): void
    {
        [$user, $document, $step] = $this->scenario(roleId: 14);
        $this->authenticateQrSession($user, $document);
        $this->post(route('documents.track.receive', $document->tracking_number))->assertRedirect();

        $this->post(route('documents.track.decision', $document->tracking_number), [
            'decision' => 'approved',
        ])->assertForbidden();

        $this->assertSame('in_progress', $step->fresh()->status);
    }

    public function test_wet_signed_pdf_becomes_a_hashed_version_and_approves_the_step(): void
    {
        Storage::fake('document_private');
        [$user, $document, $step] = $this->scenario(roleId: 3, signatureStatus: 'needs_signature');
        $source = $document->files()->create([
            'type' => 'original',
            'file_name' => 'source.pdf',
            'original_name' => 'source.pdf',
            'file_path' => 'documents/source.pdf',
            'mime_type' => 'application/pdf',
            'size_bytes' => 20,
            'uploaded_by' => $document->created_by,
        ]);
        $this->authenticateQrSession($user, $document);
        $this->post(route('documents.track.receive', $document->tracking_number))->assertRedirect();

        $this->post(route('documents.track.decision', $document->tracking_number), ['decision' => 'approved'])
            ->assertSessionHasErrors('decision');

        $pdf = UploadedFile::fake()->createWithContent('wet-signed.pdf', "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
        $this->post(route('documents.track.wet-signed', $document->tracking_number), [
            'signed_file' => $pdf,
            'remarks' => 'Wet signed and scanned.',
        ])->assertRedirect()->assertSessionHasNoErrors();

        $signed = $document->files()->where('type', 'signed')->firstOrFail();
        $this->assertSame($source->id, $signed->source_document_file_id);
        $this->assertSame('wet_ink', $signed->signature_method);
        $this->assertSame(64, strlen($signed->sha256));
        $this->assertSame($signed->id, $step->fresh()->signed_document_file_id);
        $this->assertSame('signed', $document->fresh()->signature_status);
        Storage::disk('document_private')->assertExists($signed->file_path);
    }

    public function test_authenticated_approver_can_forward_with_a_new_document_version(): void
    {
        Storage::fake('document_private');
        [$user, $document, $step] = $this->scenario(roleId: 3, suffix: 'FORWARD');
        $targetOffice = Office::create([
            'name' => 'Next Office FORWARD',
            'range_id' => $user->office->range_id,
        ]);
        User::factory()->create([
            'office_id' => $targetOffice->id,
            'role_id' => 3,
            'is_active' => true,
            'is_locked' => false,
        ]);
        $action = ActionType::create(['name' => 'For review', 'is_active' => true]);

        $this->authenticateQrSession($user, $document);
        $this->post(route('documents.track.receive', $document->tracking_number))->assertRedirect();
        $mailer = Mockery::mock(EmailNotificationMailer::class);
        $mailer->shouldReceive('canSendAutomated')->once()->andReturnFalse();
        $this->app->instance(EmailNotificationMailer::class, $mailer);

        $replacement = new UploadedFile(
            base_path('tests/Approved Conduct of Overtime for the month of October.pdf'),
            'forwarded-version.pdf',
            'application/pdf',
            null,
            true,
        );
        $this->post(route('documents.track.forward', $document->tracking_number), [
            'action_type_id' => $action->id,
            'routing_mode' => 'sequential',
            'to_office_ids' => [$targetOffice->id],
            'remarks' => 'Forwarded from the QR dialog.',
            'document_source' => 'upload',
            'file' => $replacement,
        ])->assertRedirect()->assertSessionHasNoErrors();

        $this->assertSame('waiting_on_branch', $step->fresh()->status);
        $this->assertDatabaseHas('document_route_steps', [
            'office_id' => $targetOffice->id,
            'status' => 'available',
        ]);
        $version = $document->files()->where('type', 'version')->latest('id')->firstOrFail();
        $this->assertSame('forwarded-version.pdf', $version->original_name);
        Storage::disk('document_private')->assertExists($version->file_path);
    }

    public function test_qr_scope_cannot_be_used_for_another_document(): void
    {
        [$user, $document] = $this->scenario(roleId: 3, suffix: 'ONE');
        [, $other] = $this->scenario(roleId: 3, suffix: 'TWO');
        $this->authenticateQrSession($user, $document);

        $this->post(route('documents.track.receive', $other->tracking_number))->assertForbidden();
    }

    public function test_five_wrong_codes_invalidate_the_challenge(): void
    {
        [$user, $document] = $this->scenario(roleId: 3, suffix: 'ATTEMPTS');
        $this->captureOtp();
        $this->post($this->signedOtpUrl($document), ['email' => $user->email])->assertRedirect();
        $verifyUrl = URL::temporarySignedRoute('documents.track.otp.verify', now()->addMinutes(10), [
            'trackingNumber' => $document->tracking_number,
        ]);

        foreach (range(1, 5) as $attempt) {
            $this->post($verifyUrl, ['code' => '000000'])->assertSessionHasErrors('code');
        }

        $challenge = DocumentAccessOtpChallenge::query()->firstOrFail();
        $this->assertSame(5, $challenge->attempts);
        $this->assertNotNull($challenge->invalidated_at);
    }

    public function test_new_code_has_a_server_enforced_sixty_second_cooldown(): void
    {
        [$user, $document] = $this->scenario(roleId: 3, suffix: 'RESEND-COOLDOWN');
        $mailer = Mockery::mock(EmailNotificationMailer::class);
        $mailer->shouldReceive('sendSecurityCode')->twice();
        $this->app->instance(EmailNotificationMailer::class, $mailer);
        $requestUrl = $this->signedOtpUrl($document);
        $resendUrl = URL::temporarySignedRoute('documents.track.otp.resend', now()->addMinutes(10), [
            'trackingNumber' => $document->tracking_number,
        ]);

        $this->post($requestUrl, ['email' => $user->email])->assertRedirect()->assertSessionHasNoErrors();
        $this->post($requestUrl, ['email' => $user->email])->assertSessionHasErrors('email');
        $this->post($resendUrl)->assertRedirect()->assertSessionHasErrors('code');
        $this->assertDatabaseCount('document_access_otp_challenges', 1);

        $this->travel(61)->seconds();
        $this->post($resendUrl)->assertRedirect()->assertSessionHasNoErrors();
        $this->assertDatabaseCount('document_access_otp_challenges', 2);
        $this->assertSame(1, DocumentAccessOtpChallenge::query()->whereNotNull('invalidated_at')->count());
    }

    private function authenticateQrSession(User $user, Document $document): void
    {
        $code = $this->captureOtp();
        $this->post($this->signedOtpUrl($document), ['email' => $user->email])->assertRedirect();
        $this->post(URL::temporarySignedRoute('documents.track.otp.verify', now()->addMinutes(10), [
            'trackingNumber' => $document->tracking_number,
        ]), ['code' => $code()])->assertRedirect()->assertSessionHasNoErrors();
    }

    /** @return \Closure(): string */
    private function captureOtp(): \Closure
    {
        $captured = null;
        $mailer = Mockery::mock(EmailNotificationMailer::class);
        $mailer->shouldReceive('sendSecurityCode')->once()
            ->andReturnUsing(function (string $email, string $name, string $code) use (&$captured): void {
                $captured = $code;
            });
        $this->app->instance(EmailNotificationMailer::class, $mailer);

        return function () use (&$captured): string {
            return (string) $captured;
        };
    }

    private function signedOtpUrl(Document $document): string
    {
        return URL::temporarySignedRoute('documents.track.otp.request', now()->addMinutes(10), [
            'trackingNumber' => $document->tracking_number,
        ]);
    }

    private function scenario(int $roleId, string $signatureStatus = 'not_required', string $suffix = 'BASE'): array
    {
        $range = Range::create(['name' => 'QR Range '.$suffix]);
        $origin = Office::create(['name' => 'Origin '.$suffix, 'range_id' => $range->id]);
        $receiving = Office::create(['name' => 'Receiving '.$suffix, 'range_id' => $range->id]);
        $creator = User::factory()->create(['office_id' => $origin->id, 'role_id' => 3, 'is_active' => true]);
        $user = User::factory()->create([
            'office_id' => $receiving->id,
            'role_id' => $roleId,
            'role' => $roleId === 14 ? 'Encoder' : 'Admin Staff',
            'is_active' => true,
            'is_locked' => false,
            'email_verified_at' => now(),
        ]);
        $document = Document::create([
            'title' => 'QR workflow '.$suffix,
            'tracking_number' => 'QR-WORKFLOW-'.$suffix,
            'office_id' => $origin->id,
            'created_by' => $creator->id,
            'status' => 'pending',
            'approval_status' => 'awaiting_approval',
            'signature_status' => $signatureStatus,
            'is_finalized' => true,
        ]);
        $route = $document->routes()->create([
            'created_by' => $creator->id,
            'from_office_id' => $origin->id,
            'mode' => 'sequential',
            'status' => 'pending',
            'started_at' => now(),
        ]);
        $trail = $document->trails()->create([
            'from_office_id' => $origin->id,
            'to_office_id' => $receiving->id,
            'created_by' => $creator->id,
            'status' => 'available',
            'action' => 'Routed for approval',
        ]);
        $step = $route->steps()->create([
            'office_id' => $receiving->id,
            'position' => 1,
            'status' => 'available',
            'dispatch_trail_id' => $trail->id,
        ]);

        return [$user, $document, $step];
    }
}
