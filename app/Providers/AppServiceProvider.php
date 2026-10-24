<?php

namespace App\Providers;

use App\Services\DocumentTemplates;
use App\Services\EmailNotificationSettings;
use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
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

        Event::listen(MessageSending::class, function (): bool {
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
