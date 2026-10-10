<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
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
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): ?RedirectResponse
    {
        $this->ensureIsNotRateLimited();

        $identifier = $this->string('username')->toString();
        $loginField = 'username';
        $credentials = [
            $loginField => $identifier,
            'password' => $this->input('password'),
            'is_active' => true,
            'is_locked' => false,
        ];

        $localUser = User::query()->where($loginField, $identifier)->first();
        if ($localUser && $localUser->password === null) {
            $verified = false;

            if ($localUser->is_active && ! $localUser->is_locked && filled($localUser->username)) {
                try {
                    $verified = app(\App\Services\HrisDirectory::class)->verifyCredentials(
                        $localUser->username,
                        (string) $this->input('password'),
                    );
                } catch (\Throwable $exception) {
                    Log::warning('HRIS credential verification unavailable.', [
                        'exception_class' => $exception::class,
                    ]);
                }
            }

            if ($verified) {
                $token = Password::broker()->createToken($localUser);

                RateLimiter::clear($this->throttleKey());

                return redirect()->route('password.reset', [
                    'token' => $token,
                    'username' => $localUser->username,
                ])->with('status', 'HRIS credentials verified. Choose a new password to continue.');
            }

            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'username' => trans('auth.failed'),
            ]);
        }

        if (! Auth::attempt($credentials, $this->boolean('remember'))) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'username' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());

        return null;
    }

    /**
     * Ensure the login request is not rate limited.
     *
     * @throws ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'username' => trans('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return Str::transliterate(Str::lower($this->string('username')).'|'.$this->ip());
    }
}
