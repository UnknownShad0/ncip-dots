<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UserAccountCreated extends Notification
{
    public function __construct(private readonly string $password) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your DOTS account')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('Your DOTS account has been created.')
            ->line('Username: '.$notifiable->username)
            ->line('Password: '.$this->password)
            ->action('Sign in', url('/login'))
            ->line('Please change your password after signing in.');
    }
}
