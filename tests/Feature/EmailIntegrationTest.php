<?php

namespace Tests\Feature;

use App\Jobs\SendDocumentApprovalRequestEmail;
use App\Jobs\SendDocumentRouteNotification;
use App\Jobs\SendDocumentStatusEmail;
use App\Jobs\SendDocumentTrackingReceivedEmail;
use App\Models\AuditTrail;
use App\Models\User;
use App\Services\EmailNotificationMailer;
use App\Services\EmailNotificationSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Mockery\MockInterface;
use Tests\TestCase;

class EmailIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_can_view_smtp_configuration_status(): void
    {
        $this->configureSmtp();
        $admin = User::factory()->create(['role_id' => 1, 'is_active' => true]);

        $this->actingAs($admin)
            ->get('/admin/email')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('EmailIntegration/Index')
                ->where('configured', true)
                ->where('automatedEnabled', false)
                ->where('mailer', 'smtp')
                ->where('host', 'smtp.office365.com')
                ->where('port', 587)
                ->where('sender', 'dots@example.test')
                ->where('missingSettings', [])
            );
    }

    public function test_administrator_can_send_a_test_email(): void
    {
        $admin = User::factory()->create(['role_id' => 1, 'is_active' => true]);
        $this->mock(EmailNotificationMailer::class, function (MockInterface $mock): void {
            $mock->shouldReceive('automatedDeliveryIssue')->once()->andReturnNull();
            $mock->shouldReceive('isConfigured')->once()->andReturnTrue();
            $mock->shouldReceive('senderAddress')->once()->andReturn('dots@example.test');
            $mock->shouldReceive('sendDocumentNotification')
                ->once()
                ->with('recipient@example.test', '[DOTS] Email delivery test successful', \Mockery::on(
                    fn (array $content): bool => $content['heading'] === 'Email delivery is working'
                        && $content['label'] === 'System test',
                ));
        });

        $this->actingAs($admin)
            ->post('/admin/email/test', ['recipient' => 'recipient@example.test'])
            ->assertRedirect()
            ->assertSessionHas('status', 'The test email was sent successfully with its HTML and plain-text content.');
    }

    public function test_administrator_cannot_send_a_test_email_while_notifications_are_paused(): void
    {
        $admin = User::factory()->create(['role_id' => 1, 'is_active' => true]);
        $this->mock(EmailNotificationMailer::class, function (MockInterface $mock): void {
            $mock->shouldReceive('automatedDeliveryIssue')->once()->andReturn('notifications_paused');
            $mock->shouldNotReceive('isConfigured');
            $mock->shouldNotReceive('sendDocumentNotification');
        });

        $this->actingAs($admin)
            ->post('/admin/email/test', ['recipient' => 'recipient@example.test'])
            ->assertRedirect()
            ->assertSessionHas('error', 'Email delivery is paused. DOTS blocked the test message, so no email was sent.');
    }

    public function test_test_email_contains_branded_html_and_plain_text_content(): void
    {
        config([
            'mail.default' => 'array',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
        Mail::purge('array');
        app(EmailNotificationSettings::class)->setAutomatedEnabled(true, null);
        $admin = User::factory()->create([
            'role_id' => 1,
            'is_active' => true,
            'firstname' => 'Test',
            'lastname' => 'Administrator',
        ]);

        $this->actingAs($admin)
            ->post('/admin/email/test', ['recipient' => 'recipient@example.test'])
            ->assertRedirect()
            ->assertSessionHas('status', 'The test email was sent successfully with its HTML and plain-text content.');

        $transport = Mail::mailer('array')->getSymfonyTransport();
        $this->assertInstanceOf(ArrayTransport::class, $transport);
        $this->assertCount(1, $transport->messages());

        $message = $transport->messages()->first()->getOriginalMessage();
        $this->assertSame('[DOTS] Email delivery test successful', $message->getSubject());
        $this->assertStringContainsString('Document Tracking System', $message->getHtmlBody());
        $this->assertStringContainsString('Email delivery is working', $message->getHtmlBody());
        $this->assertStringContainsString('Delivery status', $message->getHtmlBody());
        $this->assertStringContainsString('Email delivery is working', $message->getTextBody());
        $this->assertStringContainsString('Delivery status: Successful', $message->getTextBody());
    }

    public function test_administrator_can_enable_and_pause_automated_emails(): void
    {
        $admin = User::factory()->create(['role_id' => 1, 'is_active' => true]);

        $this->actingAs($admin)
            ->patch('/admin/email/automation', ['enabled' => true])
            ->assertRedirect()
            ->assertSessionHas('status', 'Email delivery is now enabled.');

        $this->assertDatabaseHas('email_notification_settings', [
            'id' => 1,
            'automated_enabled' => true,
            'updated_by' => $admin->id,
        ]);
        $enabledAudit = AuditTrail::query()->where('action', 'email_notifications.enabled')->sole();
        $this->assertSame($admin->id, $enabledAudit->user_id);
        $this->assertSame([
            'changes' => [
                'automated_emails' => [
                    'before' => 'paused',
                    'after' => 'enabled',
                ],
            ],
        ], json_decode($enabledAudit->details, true, flags: JSON_THROW_ON_ERROR));

        $this->actingAs($admin)
            ->patch('/admin/email/automation', ['enabled' => false])
            ->assertRedirect()
            ->assertSessionHas('status', 'Email delivery is paused. All outgoing emails are blocked.');

        $this->assertDatabaseHas('email_notification_settings', [
            'id' => 1,
            'automated_enabled' => false,
            'updated_by' => $admin->id,
        ]);
        $pausedAudit = AuditTrail::query()->where('action', 'email_notifications.paused')->sole();
        $this->assertSame($admin->id, $pausedAudit->user_id);
        $this->assertSame([
            'changes' => [
                'automated_emails' => [
                    'before' => 'enabled',
                    'after' => 'paused',
                ],
            ],
        ], json_decode($pausedAudit->details, true, flags: JSON_THROW_ON_ERROR));

        $this->actingAs($admin)
            ->patch('/admin/email/automation', ['enabled' => false])
            ->assertSessionHas('status', 'Email delivery is already paused.');

        $this->assertSame(2, AuditTrail::query()->whereIn('action', [
            'email_notifications.enabled',
            'email_notifications.paused',
        ])->count());
    }

    public function test_notification_mailer_sends_plain_text_through_laravel_mail(): void
    {
        config([
            'mail.default' => 'array',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
        Mail::purge('array');
        app(EmailNotificationSettings::class)->setAutomatedEnabled(true, null);

        app(EmailNotificationMailer::class)->sendText(
            'recipient@example.test',
            'SMTP test subject',
            'SMTP test body',
        );

        $transport = Mail::mailer('array')->getSymfonyTransport();
        $this->assertInstanceOf(ArrayTransport::class, $transport);
        $this->assertCount(1, $transport->messages());

        $message = $transport->messages()->first()->getOriginalMessage();
        $this->assertSame('SMTP test subject', $message->getSubject());
        $this->assertSame('recipient@example.test', $message->getTo()[0]->getAddress());
        $this->assertStringContainsString('SMTP test body', $message->getTextBody());
    }

    public function test_notification_mailer_rejects_direct_sends_while_paused(): void
    {
        config([
            'mail.default' => 'array',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
        Mail::purge('array');

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Email notifications are paused.');

        app(EmailNotificationMailer::class)->sendText(
            'recipient@example.test',
            'Blocked subject',
            'Blocked body',
        );
    }

    public function test_global_pause_blocks_mail_sent_outside_the_document_mailer(): void
    {
        config([
            'mail.default' => 'array',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
        Mail::purge('array');

        Mail::raw('Blocked body', fn ($message) => $message
            ->to('recipient@example.test')
            ->subject('Blocked subject'));

        $transport = Mail::mailer('array')->getSymfonyTransport();
        $this->assertInstanceOf(ArrayTransport::class, $transport);
        $this->assertCount(0, $transport->messages());

        app(EmailNotificationSettings::class)->setAutomatedEnabled(true, null);
        Mail::raw('Allowed body', fn ($message) => $message
            ->to('recipient@example.test')
            ->subject('Allowed subject'));

        $this->assertCount(1, $transport->messages());
        $this->assertSame('Allowed subject', $transport->messages()->first()->getOriginalMessage()->getSubject());
    }

    public function test_queued_workflow_email_is_skipped_while_paused_and_sent_when_enabled(): void
    {
        config([
            'mail.default' => 'array',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
        Mail::purge('array');

        $job = new SendDocumentTrackingReceivedEmail(
            recipientEmail: 'recipient@example.test',
            recipientName: 'Test User',
            documentTitle: 'Safe test document',
            trackingNumber: 'DOTS-TEST-001',
            receivingOfficeName: 'Test Office',
        );
        $job->handle(app(EmailNotificationMailer::class));

        $transport = Mail::mailer('array')->getSymfonyTransport();
        $this->assertInstanceOf(ArrayTransport::class, $transport);
        $this->assertCount(0, $transport->messages());

        app(EmailNotificationSettings::class)->setAutomatedEnabled(true, null);
        $job->handle(app(EmailNotificationMailer::class));

        $this->assertCount(1, $transport->messages());
        $message = $transport->messages()->first()->getOriginalMessage();
        $this->assertSame('[DOTS] Document received by Test Office: DOTS-TEST-001', $message->getSubject());
        $this->assertStringContainsString('Document Tracking System', $message->getHtmlBody());
        $this->assertStringContainsString('Your document was received', $message->getHtmlBody());
        $this->assertStringContainsString('DOTS No.', $message->getHtmlBody());
        $this->assertStringContainsString('Safe test document', $message->getHtmlBody());
        $this->assertStringContainsString('Track document', $message->getHtmlBody());
        $this->assertStringContainsString('Your document was received', $message->getTextBody());
        $this->assertStringContainsString('DOTS No.: DOTS-TEST-001', $message->getTextBody());
        $this->assertStringContainsString('/track/DOTS-TEST-001', $message->getTextBody());
    }

    public function test_workflow_email_variants_use_the_reviewed_subjects_and_copy(): void
    {
        config([
            'mail.default' => 'array',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
        Mail::purge('array');
        app(EmailNotificationSettings::class)->setAutomatedEnabled(true, null);
        $mailer = app(EmailNotificationMailer::class);

        (new SendDocumentApprovalRequestEmail(
            recipientEmail: 'approver@example.test',
            recipientName: 'Approver',
            submitterName: 'Submitter',
            documentTitle: 'Sample Document',
            versionNumber: 3,
        ))->handle($mailer);

        foreach (['approved', 'revision_requested', 'rejected', 'registered'] as $status) {
            (new SendDocumentStatusEmail(
                recipientEmail: 'creator@example.test',
                recipientName: 'Creator',
                documentTitle: 'Sample Document',
                status: $status,
                versionNumber: 3,
                remarks: $status === 'revision_requested' ? 'Update the attachment.' : null,
                trackingNumber: $status === 'registered' ? 'DOTS-001' : null,
            ))->handle($mailer);
        }

        foreach (['approval_required', 'approved', 'changes_requested', 'rejected'] as $event) {
            (new SendDocumentRouteNotification(
                recipientEmail: 'recipient@example.test',
                recipientName: 'Recipient',
                documentId: 42,
                documentTitle: 'Sample Document',
                trackingNumber: 'DOTS-001',
                officeName: 'Records Office',
                event: $event,
                routingMode: 'sequential',
                remarks: $event === 'changes_requested' ? 'Attach the signed copy.' : null,
            ))->handle($mailer);
        }

        $transport = Mail::mailer('array')->getSymfonyTransport();
        $this->assertInstanceOf(ArrayTransport::class, $transport);
        $this->assertCount(9, $transport->messages());

        $messages = $transport->messages()
            ->map(fn ($sent) => $sent->getOriginalMessage());
        $subjects = $messages->map(fn ($message) => $message->getSubject())->all();
        $html = $messages->map(fn ($message) => $message->getHtmlBody())->implode("\n");
        $text = $messages->map(fn ($message) => $message->getTextBody())->implode("\n");

        $this->assertContains('[DOTS] Approval needed: Sample Document', $subjects);
        $this->assertContains('[DOTS] Approved: Sample Document', $subjects);
        $this->assertContains('[DOTS] Changes requested: Sample Document', $subjects);
        $this->assertContains('[DOTS] Rejected: Sample Document', $subjects);
        $this->assertContains('[DOTS] Document registered: DOTS-001', $subjects);
        $this->assertContains('[DOTS] Office review needed: DOTS-001', $subjects);
        $this->assertContains('[DOTS] Route approved by Records Office: DOTS-001', $subjects);
        $this->assertContains('[DOTS] Route changes requested: DOTS-001', $subjects);
        $this->assertContains('[DOTS] Route rejected by Records Office: DOTS-001', $subjects);
        $this->assertStringContainsString('Reviewer remarks', $html);
        $this->assertStringContainsString('Update the attachment.', $html);
        $this->assertStringContainsString('Attach the signed copy.', $html);
        $this->assertStringContainsString('DOTS No.: DOTS-001', $text);
        $this->assertStringNotContainsString('Tracking number', $html);
        $this->assertStringNotContainsString('Document Online Tracking System', $html);
    }

    public function test_legacy_gmail_page_redirects_to_email_page(): void
    {
        $admin = User::factory()->create(['role_id' => 1, 'is_active' => true]);

        $this->actingAs($admin)
            ->get('/admin/gmail')
            ->assertRedirect('/admin/email');
    }

    public function test_non_administrator_cannot_manage_email_settings(): void
    {
        $user = User::factory()->create(['role_id' => 14, 'is_active' => true]);

        $this->actingAs($user)->get('/admin/email')->assertForbidden();
        $this->actingAs($user)
            ->post('/admin/email/test', ['recipient' => 'recipient@example.test'])
            ->assertForbidden();
        $this->actingAs($user)
            ->patch('/admin/email/automation', ['enabled' => true])
            ->assertForbidden();
    }

    private function configureSmtp(): void
    {
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => 'smtp.office365.com',
            'mail.mailers.smtp.port' => 587,
            'mail.mailers.smtp.username' => 'dots@example.test',
            'mail.mailers.smtp.password' => 'test-password',
            'mail.from.address' => 'dots@example.test',
            'mail.from.name' => 'DOTS',
        ]);
    }
}
