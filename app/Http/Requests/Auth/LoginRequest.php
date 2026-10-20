<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Services\AuditTrailWriter;
use App\Services\HrisDirectory;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'username' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'recaptcha_v3_token' => ['nullable', 'string', 'max:8192'],
            'recaptcha_v2_token' => ['nullable', 'string', 'max:8192'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): ?RedirectResponse
    {
        app(\App\Services\RecaptchaVerifier::class)->verifyLogin($this);

        $identifier = $this->string('username')->toString();
        $user = User::query()->where('username', $identifier)->first();

        if ($user?->is_locked) {
            $this->recordLoginFailure($user, $identifier, 'account_locked');
            $this->reject('Your account is locked after repeated failed login attempts. Contact an administrator to unlock it.');
        }

        if ($user && ! $user->is_active) {
            $this->recordLoginFailure($user, $identifier, 'account_inactive');
            $this->reject('Your account is inactive. Contact an administrator to reactivate it.');
        }

        if ($user && $user->login_locked_until?->isFuture()) {
            $seconds = max(1, $user->login_locked_until->getTimestamp() - now()->getTimestamp());
            $this->recordCooldown($user, $identifier, $seconds);
            $this->reject("Too many failed login attempts. Try again in {$seconds} seconds.");
        }

        if ($user && $user->password === null) {
            $verified = false;
            $verificationUnavailable = false;

            if (filled($user->username)) {
                try {
                    $verified = app(HrisDirectory::class)->verifyCredentials(
                        $user->username,
                        (string) $this->input('password'),
                    );
                } catch (\Throwable $exception) {
                    $verificationUnavailable = true;
                    Log::warning('HRIS credential verification unavailable.', [
                        'exception_class' => $exception::class,
                    ]);
                }
            }

            if ($verified) {
                $this->clearFailedLoginState($user);
                $token = Password::broker()->createToken($user);
                app(AuditTrailWriter::class)->record('login.hris_verified', $user, [
                    'result' => 'Password setup required',
                ]);

                return redirect()->route('password.reset', [
                    'token' => $token,
                    'username' => $user->username,
                ])->with('status', 'HRIS credentials verified. Choose a new password to continue.');
            }

            if ($verificationUnavailable) {
                $this->recordLoginFailure($user, $identifier, 'hris_unavailable');
                $this->reject('The username or password is incorrect.');
            }

            $this->rejectAfterCredentialFailure($user, $identifier);
        }

        $credentials = [
            'username' => $identifier,
            'password' => $this->input('password'),
            'is_active' => true,
            'is_locked' => false,
        ];

        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            if ($user) {
                $this->rejectAfterCredentialFailure($user, $identifier);
            }

            $this->recordLoginFailure(null, $identifier, 'credentials_rejected');
            $this->reject('The username or password is incorrect.');
        }

        $this->clearFailedLoginState($this->user());

        return null;
    }

    private function rejectAfterCredentialFailure(User $user, string $identifier): never
    {
        $result = $this->registerFailedLogin($user);

        if ($result['status'] === 'cooldown') {
            $this->recordCooldown($user, $identifier, $result['seconds']);
            $this->reject("Too many failed login attempts. Try again in {$result['seconds']} seconds.");
        }

        $reason = match ($result['status']) {
            'locked' => $result['newly_locked'] ? 'credentials_rejected' : 'account_locked',
            'inactive' => 'account_inactive',
            default => 'credentials_rejected',
        };
        $details = ['identifier' => $identifier, 'reason' => $reason];
        if ($result['failed_attempts'] !== null) {
            $details['failed_attempts'] = $result['failed_attempts'];
        }
        $this->recordLoginFailure($user, $identifier, $reason, $details);

        if ($result['newly_locked']) {
            app(AuditTrailWriter::class)->record('login.locked', $user, [
                'identifier' => $identifier,
                'reason' => 'repeated_failed_login_attempts',
                'failed_attempts' => $result['failed_attempts'],
            ], 'failure');
        }

        if ($result['status'] === 'locked') {
            $this->reject('Your account is locked after repeated failed login attempts. Contact an administrator to unlock it.');
        }

        if ($result['status'] === 'inactive') {
            $this->reject('Your account is inactive. Contact an administrator to reactivate it.');
        }

        $this->reject('The username or password is incorrect.');
    }

    /**
     * Increment a failed credential check while serializing updates for this account.
     *
     * @return array{status: string, seconds: int, failed_attempts: ?int, newly_locked: bool}
     */
    private function registerFailedLogin(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $account = User::query()->lockForUpdate()->find($user->id);
            if (! $account) {
                return ['status' => 'missing', 'seconds' => 0, 'failed_attempts' => null, 'newly_locked' => false];
            }

            if ($account->is_locked) {
                return ['status' => 'locked', 'seconds' => 0, 'failed_attempts' => null, 'newly_locked' => false];
            }

            if (! $account->is_active) {
                return ['status' => 'inactive', 'seconds' => 0, 'failed_attempts' => null, 'newly_locked' => false];
            }

            $now = now();
            if ($account->login_locked_until?->isFuture()) {
                return [
                    'status' => 'cooldown',
                    'seconds' => max(1, $account->login_locked_until->getTimestamp() - $now->getTimestamp()),
                    'failed_attempts' => null,
                    'newly_locked' => false,
                ];
            }

            $failureWindowExpired = ! $account->last_failed_login_at
                || $account->last_failed_login_at->lte($now->copy()->subHours(24));
            $failedAttempts = ($failureWindowExpired ? 0 : (int) $account->failed_login_attempts) + 1;
            $newlyLocked = $failedAttempts >= 5;
            $cooldownSeconds = match ($failedAttempts) {
                3 => 60,
                4 => 120,
                default => 0,
            };

            $account->forceFill([
                'failed_login_attempts' => $failedAttempts,
                'last_failed_login_at' => $now,
                'login_locked_until' => $cooldownSeconds > 0 ? $now->copy()->addSeconds($cooldownSeconds) : null,
                'is_locked' => $newlyLocked ? true : $account->is_locked,
            ])->saveQuietly();

            return [
                'status' => $newlyLocked ? 'locked' : 'failed',
                'seconds' => 0,
                'failed_attempts' => $failedAttempts,
                'newly_locked' => $newlyLocked,
            ];
        });
    }

    private function clearFailedLoginState(?User $user): void
    {
        $user?->forceFill([
            'failed_login_attempts' => 0,
            'last_failed_login_at' => null,
            'login_locked_until' => null,
        ])->saveQuietly();
    }

    private function recordLoginFailure(?User $user, string $identifier, string $reason, array $details = []): void
    {
        app(AuditTrailWriter::class)->record('login.failed', $user, $details ?: [
            'identifier' => $identifier,
            'reason' => $reason,
        ], 'failure');
    }

    private function recordCooldown(User $user, string $identifier, int $seconds): void
    {
        app(AuditTrailWriter::class)->record('login.rate_limited', $user, [
            'identifier' => $identifier,
            'reason' => 'cooldown_active',
            'seconds' => $seconds,
        ], 'failure');
    }

    private function reject(string $message): never
    {
        throw ValidationException::withMessages(['username' => $message]);
    }
}
