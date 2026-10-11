<?php

namespace Tests\Feature;

use App\Models\AuditTrail;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuditTrailAuthLoggingTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_login_and_logout_record_the_actor_and_bureau(): void
    {
        $office = Office::create(['name' => 'Bureau A']);
        $user = User::factory()->create([
            'username' => 'audit.actor',
            'office_id' => $office->id,
            'is_active' => true,
            'is_locked' => false,
        ]);

        $this->post('/login', ['username' => $user->username, 'password' => 'password'])
            ->assertRedirect(route('dashboard', absolute: false));
        $this->assertDatabaseHas('audit_trails', [
            'user_id' => $user->id,
            'actor_name' => $user->name,
            'actor_office_id' => $office->id,
            'actor_office_name' => $office->name,
            'action' => 'login.succeeded',
            'result' => 'success',
        ]);

        $this->post('/logout')->assertRedirect('/');
        $this->assertDatabaseHas('audit_trails', [
            'user_id' => $user->id,
            'action' => 'logout.succeeded',
            'actor_office_id' => $office->id,
        ]);
    }

    public function test_failed_login_records_failure_without_logging_the_password(): void
    {
        $user = User::factory()->create(['username' => 'audit.actor']);

        $this->post('/login', ['username' => $user->username, 'password' => 'never-log-this'])
            ->assertSessionHasErrors('username');

        $entry = AuditTrail::query()->where('action', 'login.failed')->firstOrFail();
        $this->assertSame('failure', $entry->result);
        $this->assertNull($entry->actor_name);
        $this->assertStringNotContainsString('never-log-this', $entry->details);
    }

    public function test_password_reset_request_logs_delivery_status_without_claiming_an_authenticated_actor(): void
    {
        config(['mail.default' => 'array', 'mail.mailers.array.transport' => 'array']);
        Notification::fake();
        $user = User::factory()->create(['username' => 'audit.actor']);

        $this->post('/forgot-password', ['username' => $user->username])
            ->assertSessionHas('status');

        $entry = AuditTrail::query()->where('action', 'password.reset_requested')->firstOrFail();
        $this->assertSame('success', $entry->result);
        $this->assertNull($entry->user_id);
        $this->assertSame($user->id, $entry->model_id);
    }

    public function test_completed_password_reset_is_attributed_to_the_reset_account(): void
    {
        $user = User::factory()->create(['username' => 'audit.actor']);
        $token = Password::broker()->createToken($user);

        $this->post('/reset-password', [
            'username' => $user->username,
            'token' => $token,
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ])->assertSessionHasNoErrors();

        $entry = AuditTrail::query()->where('action', 'password.reset')->firstOrFail();
        $this->assertSame($user->id, $entry->user_id);
        $this->assertSame('success', $entry->result);
        $this->assertStringNotContainsString($token, $entry->details);
    }
}
