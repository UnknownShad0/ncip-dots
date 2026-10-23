<?php

namespace Tests\Feature;

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
            $mock->shouldReceive('isConfigured')->once()->andReturnTrue();
            $mock->shouldReceive('sendText')
                ->once()
                ->with('recipient@example.test', '[DOTS] Email notification test', \Mockery::type('string'));
        });

        $this->actingAs($admin)
            ->post('/admin/email/test', ['recipient' => 'recipient@example.test'])
            ->assertRedirect()
            ->assertSessionHas('status', 'Test email sent successfully.');
    }

    public function test_administrator_can_enable_and_pause_automated_emails(): void
    {
        $admin = User::factory()->create(['role_id' => 1, 'is_active' => true]);

        $this->actingAs($admin)
            ->patch('/admin/email/automation', ['enabled' => true])
            ->assertRedirect()
            ->assertSessionHas('status', 'Automated workflow emails are now enabled.');

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
            ->assertSessionHas('status', 'Automated workflow emails are paused. Manual test emails remain available.');

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
            ->assertSessionHas('status', 'Automated workflow emails are already paused.');

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
