<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword as ResetPasswordNotification;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        ResetPasswordNotification::createUrlUsing(fn ($user, string $token): string => url(route(
            'password.reset',
            ['token' => $token, 'username' => $user->username],
            false,
        )));
    }
}
