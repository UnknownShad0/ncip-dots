<?php

namespace App\Services;

use App\Models\GmailConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class GmailApiMailer
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

    public function sendText(string $recipient, string $subject, string $body): void
    {
        if (! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('The notification recipient email address is invalid.');
        }

        $connection = GmailConnection::query()->whereKey('system')->first();
        if (! $connection) {
            throw new RuntimeException('The Gmail notification sender is not connected.');
        }

        $email = (new Email())
            ->from(new Address($connection->email, (string) config('mail.from.name', config('app.name'))))
            ->to(new Address($recipient))
            ->subject($subject)
            ->text($body, 'utf-8');
        $rawMessage = rtrim(strtr(base64_encode($email->toString()), '+/', '-_'), '=');

        $response = $this->googleRequest()->withToken($this->accessToken($connection))
            ->acceptJson()
            ->timeout(30)
            ->post(self::SEND_URL, ['raw' => $rawMessage]);

        $response->throw();
    }

    private function accessToken(GmailConnection $connection): string
    {
        if (is_string($connection->access_token)
            && $connection->access_token !== ''
            && $connection->expires_at?->isAfter(now()->addMinute())) {
            return $connection->access_token;
        }

        try {
            $response = $this->googleRequest()->asForm()->acceptJson()->timeout(20)->post(self::TOKEN_URL, [
                'client_id' => config('services.gmail.client_id'),
                'client_secret' => config('services.gmail.client_secret'),
                'refresh_token' => $connection->refresh_token,
                'grant_type' => 'refresh_token',
            ]);
        } catch (\Throwable $exception) {
            throw new RuntimeException('Could not reach Google to refresh the Gmail sender token.', previous: $exception);
        }

        $token = $response->json();
        if (! $response->successful() || ! is_array($token) || ! filled($token['access_token'] ?? null)) {
            throw new RuntimeException('Google rejected the Gmail sender refresh token (HTTP '.$response->status().').');
        }

        $tokenAttributes = [
            'access_token' => $token['access_token'],
            'expires_at' => now()->addSeconds(max(60, (int) ($token['expires_in'] ?? 3600))),
        ];

        if (is_string($token['refresh_token'] ?? null) && $token['refresh_token'] !== '') {
            $tokenAttributes['refresh_token'] = $token['refresh_token'];
        }

        $connection->forceFill($tokenAttributes)->save();

        return $token['access_token'];
    }

    private function googleRequest(): PendingRequest
    {
        $request = Http::withOptions(['verify' => true]);

        // Use Windows' trusted root store when PHP cURL has no configured CA bundle.
        if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
            $request->withOptions([
                'curl' => [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA],
            ]);
        }

        return $request;
    }
}
