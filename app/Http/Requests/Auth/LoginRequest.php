<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use App\Models\UserLegacy;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
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
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        $this->ensureIsNotRateLimited();

        $identifier = $this->string('email')->toString();
        $loginField = filter_var($identifier, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $credentials = [
            $loginField => $identifier,
            'password' => $this->input('password'),
            'is_active' => true,
            'is_locked' => false,
        ];

        if (! Auth::attempt($credentials, $this->boolean('remember')) && ! $this->authenticateLegacy($identifier, $loginField)) {
            RateLimiter::hit($this->throttleKey());

            throw ValidationException::withMessages([
                'email' => trans('auth.failed'),
            ]);
        }

        RateLimiter::clear($this->throttleKey());
    }

    /** Authenticate a legacy account and provision it locally for the web guard. */
    private function authenticateLegacy(string $identifier, string $loginField): bool
    {
        try {
            $legacy = UserLegacy::query()
                ->where($loginField === 'email' ? 'emailAddress' : 'username', $identifier)
                ->first();
        } catch (\Throwable) {
            return false;
        }

        if (! $legacy || ! $this->legacyAccountIsUsable($legacy) || ! $this->legacyPasswordMatches((string) $legacy->password)) {
            return false;
        }

        $email = trim((string) $legacy->emailAddress);
        if ($email === '') {
            $email = strtolower((string) $legacy->username).'@legacy.local';
        }

        $user = User::query()->where('username', $legacy->username)->first();
        if (! $user) {
            $user = User::query()->where('email', $email)->first();
        }

        if ($user && (! $user->is_active || $user->is_locked)) {
            return false;
        }

        if (! $user) {
            $user = new User;
        }

        $roleId = is_numeric($legacy->role) ? (int) $legacy->role : null;
        $roleName = (string) ($legacy->role ?: 'user');
        if ($roleId) {
            try {
                $roleName = \Illuminate\Support\Facades\DB::connection('legacy')->table('role')->where('roleId', $roleId)->value('rolename') ?: $roleName;
            } catch (\Throwable) {
                // The legacy role lookup is optional for authentication.
            }
        }
        $name = collect([$legacy->firstname, $legacy->lastname])->filter(fn ($part) => filled($part))->implode(' ');

        $user->fill([
            'name' => $name ?: (string) $legacy->username,
            'username' => $legacy->username,
            'firstname' => $legacy->firstname,
            'lastname' => $legacy->lastname,
            'middlename' => $legacy->middlename,
            'extensionname' => $legacy->extensionname,
            'email' => $email,
            'role' => $roleName ?: 'user',
            'role_id' => $roleId,
            'legacy_office_id' => $legacy->bureauId,
            'division_id' => $legacy->divisionId,
            'is_active' => true,
            'is_locked' => false,
            'last_login_at' => now(),
            'password' => $this->input('password'),
        ]);
        $user->save();

        Auth::login($user, $this->boolean('remember'));

        return true;
    }

    private function legacyAccountIsUsable(UserLegacy $user): bool
    {
        $active = in_array(strtolower(trim((string) $user->status)), ['1', 'active', 'y', 'enabled'], true);
        $locked = in_array(strtoupper(trim((string) $user->isLocked)), ['1', 'Y', 'LOCKED', 'TRUE'], true);

        return $active && ! $locked;
    }

    private function legacyPasswordMatches(string $stored): bool
    {
        if ($stored === '') {
            return false;
        }

        try {
            return Hash::check($this->input('password'), $stored);
        } catch (\Throwable) {
            return false;
        }
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
            'email' => trans('auth.throttle', [
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
        return Str::transliterate(Str::lower($this->string('email')).'|'.$this->ip());
    }
}
