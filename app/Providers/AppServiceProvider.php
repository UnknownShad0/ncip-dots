<?php

namespace App\Providers;

use App\Services\DocumentTemplates;
use App\Services\EmailNotificationSettings;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(DocumentTemplates::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Password::defaults(fn () => Password::min(8)->mixedCase()->numbers()->symbols());

        RateLimiter::for('qr-tracking', fn (Request $request) => Limit::perMinute(120)
            ->by('qr-tracking:'.$request->ip()));

        RateLimiter::for('qr-otp-request', function (Request $request): array {
            $response = fn (Request $request, array $headers) => back()
                ->withErrors(['email' => 'Too many verification-code requests. Please wait about one minute, then try again.'])
                ->withHeaders($headers);
            $email = mb_strtolower(trim((string) $request->input('email')));
            $tracking = (string) $request->route('trackingNumber');

            return [
                Limit::perMinute(20)->by('qr-otp-ip:'.$request->ip())->response($response),
                Limit::perMinute(5)->by('qr-otp-email:'.hash('sha256', $tracking.'|'.$email))->response($response),
            ];
        });

        RateLimiter::for('qr-otp-verify', fn (Request $request) => Limit::perMinute(15)
            ->by('qr-verify:'.$request->session()->getId().'|'.$request->route('trackingNumber'))
            ->response(fn (Request $request, array $headers) => back()
                ->withErrors(['code' => 'Too many verification attempts. Request a new code or wait about one minute.'])
                ->withHeaders($headers)));

        RateLimiter::for('qr-otp-resend', fn (Request $request) => Limit::perMinute(5)
            ->by('qr-resend:'.$request->session()->getId().'|'.$request->route('trackingNumber'))
            ->response(fn (Request $request, array $headers) => back()
                ->withErrors(['code' => 'Too many resend requests. Please wait about one minute.'])
                ->withHeaders($headers)));

        RateLimiter::for('qr-document-actions', fn (Request $request) => Limit::perMinute(60)
            ->by('qr-action:'.$request->session()->getId().'|'.$request->route('trackingNumber')));

        Event::listen(MessageSending::class, function (MessageSending $event): bool {
            if (app(EmailNotificationSettings::class)->automatedEnabled()) {
                return true;
            }

            Log::notice('Outgoing email was blocked because email notifications are paused.');

            return false;
        });

        Vite::prefetch(concurrency: 3);

        ResetPasswordNotification::createUrlUsing(fn ($user, string $token): string => url(route(
            'password.reset',
            ['token' => $token, 'username' => $user->username],
            false,
        )));
    }
}
