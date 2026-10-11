<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditTrailWriter;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class NewPasswordController extends Controller
{
    /**
     * Display the password reset view.
     */
    public function create(Request $request): Response
    {
        $username = $request->query('username');
        if (! filled($username) && filled($request->query('email'))) {
            $username = User::query()->where('email', $request->query('email'))->value('username');
        }

        return Inertia::render('Auth/ResetPassword', [
            'username' => $username ?? '',
            'token' => $request->route('token'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming new password request.
     *
     * @throws ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => 'required',
            'username' => 'required|string|max:255',
            'password' => ['required', 'confirmed', Rules\Password::min(8)],
        ]);

        $user = User::query()->where('username', $request->input('username'))->first();
        if (! $user) {
            app(AuditTrailWriter::class)->record('password.reset_failed', details: [
                'identifier' => $request->input('username'),
                'reason' => 'account_not_found',
            ], result: 'failure');
            throw ValidationException::withMessages([
                'username' => [trans('passwords.token')],
            ]);
        }

        // Here we will attempt to reset the user's password. If it is successful we
        // will update the password on an actual user model and persist it to the
        // database. Otherwise we will parse the error and return the response.
        $status = Password::reset(
            [
                'email' => $user->email,
                'password' => $request->input('password'),
                'password_confirmation' => $request->input('password_confirmation'),
                'token' => $request->input('token'),
            ],
            function ($user) use ($request) {
                $user->forceFill([
                    'password' => Hash::make($request->password),
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        // If the password was successfully reset, we will redirect the user back to
        // the application's home authenticated view. If there is an error we can
        // redirect them back to where they came from with their error message.
        if ($status == Password::PASSWORD_RESET) {
            app(AuditTrailWriter::class)->record('password.reset', $user, [
                'method' => 'reset_link',
            ], actor: $user);

            return redirect()->route('login')->with('status', __($status));
        }

        app(AuditTrailWriter::class)->record('password.reset_failed', $user, [
            'reason' => $status,
        ], 'failure');
        throw ValidationException::withMessages([
            'username' => [trans($status)],
        ]);
    }
}
