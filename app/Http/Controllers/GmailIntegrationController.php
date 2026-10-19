<?php

namespace App\Http\Controllers;

use App\Models\GmailConnection;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class GmailIntegrationController extends Controller
{
    private const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    public function index(): Response
    {
        $connection = GmailConnection::query()->whereKey('system')->first();

        return Inertia::render('GmailIntegration/Index', [
            'oauthConfigured' => filled(config('services.gmail.client_id'))
                && filled(config('services.gmail.client_secret')),
            'redirectUri' => $this->redirectUri(),
            'connected' => $connection !== null,
            'connectedEmail' => $connection?->email,
            'statusMessage' => session('status'),
            'errorMessage' => session('error'),
        ]);
    }

    public function connect(Request $request): RedirectResponse
    {
        if (! $this->oauthConfigured()) {
            Log::warning('Gmail OAuth connection could not start because client credentials are not configured.', [
                'user_id' => $request->user()->id,
                'client_id_configured' => filled(config('services.gmail.client_id')),
                'client_secret_configured' => filled(config('services.gmail.client_secret')),
            ]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to .env, then clear the config cache.');
        }

        Log::info('Gmail OAuth connection started.', [
            'user_id' => $request->user()->id,
            'request_host' => $request->getHost(),
            'redirect_host' => parse_url($this->redirectUri(), PHP_URL_HOST),
        ]);

        $state = Str::random(64);
        $request->session()->put('gmail_oauth_state', $state);

        $query = http_build_query([
            'client_id' => config('services.gmail.client_id'),
            'redirect_uri' => $this->redirectUri(),
            'response_type' => 'code',
            'scope' => 'openid email https://www.googleapis.com/auth/gmail.send',
            'access_type' => 'offline',
            'include_granted_scopes' => 'true',
            'prompt' => 'consent',
            'state' => $state,
        ]);

        return redirect()->away(self::AUTHORIZATION_URL.'?'.$query);
    }

    public function callback(Request $request): RedirectResponse
    {
        $expectedState = $request->session()->pull('gmail_oauth_state');
        $returnedState = (string) $request->query('state', '');

        Log::info('Gmail OAuth callback received.', [
            'user_id' => $request->user()->id,
            'request_host' => $request->getHost(),
            'has_code' => $request->filled('code'),
            'has_error' => $request->filled('error'),
            'expected_state_present' => is_string($expectedState) && $expectedState !== '',
            'returned_state_present' => $returnedState !== '',
        ]);

        if (! is_string($expectedState) || $expectedState === '' || ! hash_equals($expectedState, $returnedState)) {
            Log::warning('Gmail OAuth callback state validation failed.', [
                'user_id' => $request->user()->id,
                'request_host' => $request->getHost(),
                'expected_state_present' => is_string($expectedState) && $expectedState !== '',
                'returned_state_present' => $returnedState !== '',
            ]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Google connection could not be confirmed. Please start the connection again.');
        }

        if ($request->filled('error')) {
            Log::warning('Gmail OAuth authorization was denied or cancelled.', [
                'user_id' => $request->user()->id,
                'oauth_error' => (string) $request->query('error'),
            ]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Google authorization was cancelled or denied.');
        }

        $code = $request->query('code');
        if (! is_string($code) || $code === '') {
            Log::warning('Gmail OAuth callback did not include an authorization code.', [
                'user_id' => $request->user()->id,
            ]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Google did not return an authorization code. Please try again.');
        }

        try {
            $tokenResponse = $this->googleRequest()->asForm()->acceptJson()->timeout(20)->post(self::TOKEN_URL, [
                'code' => $code,
                'client_id' => config('services.gmail.client_id'),
                'client_secret' => config('services.gmail.client_secret'),
                'redirect_uri' => $this->redirectUri(),
                'grant_type' => 'authorization_code',
            ]);
        } catch (\Throwable $exception) {
            Log::warning('Gmail OAuth token exchange could not reach Google.', ['exception' => $exception::class]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Could not reach Google to complete the connection. Please try again.');
        }

        $token = $tokenResponse->json();
        if (! $tokenResponse->successful() || ! is_array($token) || ! filled($token['access_token'] ?? null)) {
            Log::warning('Gmail OAuth token exchange was rejected.', ['http_status' => $tokenResponse->status()]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Google rejected the connection. Check the OAuth client and redirect URI, then try again.');
        }

        $grantedScopes = preg_split('/\s+/', trim((string) ($token['scope'] ?? '')), flags: PREG_SPLIT_NO_EMPTY) ?: [];
        $gmailSendScope = 'https://www.googleapis.com/auth/gmail.send';
        if (! in_array($gmailSendScope, $grantedScopes, true)) {
            Log::warning('Gmail OAuth token is missing the Gmail send scope.', [
                'user_id' => $request->user()->id,
                'token_scope_present' => filled($token['scope'] ?? null),
                'gmail_send_scope_granted' => false,
                'granted_scopes' => $grantedScopes,
            ]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Google connected the account without Gmail send permission. In Google Cloud Console, enable the Gmail API and add the Gmail API scope https://www.googleapis.com/auth/gmail.send under Data Access. Then remove this app from the sender account’s Google connections and connect again.');
        }

        $connection = GmailConnection::query()->whereKey('system')->first();
        $refreshToken = $token['refresh_token'] ?? $connection?->refresh_token;

        if (! is_string($refreshToken) || $refreshToken === '') {
            Log::warning('Gmail OAuth response did not include a refresh token.', [
                'user_id' => $request->user()->id,
                'sender_connection_exists' => $connection !== null,
            ]);

            return redirect()->route('gmail-integration.index')
                ->with('error', "Google did not provide a refresh token. Revoke this app in the sender account's Google permissions and connect again.");
        }

        try {
            $profileResponse = $this->googleRequest()->withToken($token['access_token'])->acceptJson()->timeout(20)
                ->get('https://openidconnect.googleapis.com/v1/userinfo');
        } catch (\Throwable $exception) {
            Log::warning('Gmail sender profile lookup could not reach Google.', ['exception' => $exception::class]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Could not confirm the Gmail account with Google. Please try again.');
        }

        $profile = $profileResponse->json();
        $email = is_array($profile) ? ($profile['email'] ?? null) : null;

        if (! $profileResponse->successful()
            || ! is_string($email)
            || ! filter_var($email, FILTER_VALIDATE_EMAIL)
            || ($profile['email_verified'] ?? false) !== true) {
            Log::warning('Gmail sender profile lookup was rejected.', ['http_status' => $profileResponse->status()]);

            return redirect()->route('gmail-integration.index')
                ->with('error', 'Google did not return a valid sender email address. Please try again.');
        }

        GmailConnection::query()->updateOrCreate(
            ['key' => 'system'],
            [
                'email' => $email,
                'access_token' => $token['access_token'],
                'refresh_token' => $refreshToken,
                'expires_at' => now()->addSeconds(max(60, (int) ($token['expires_in'] ?? 3600))),
                'connected_by' => $request->user()->id,
            ],
        );

        $emailParts = explode('@', $email, 2);
        Log::info('Gmail OAuth connection saved.', [
            'user_id' => $request->user()->id,
            'sender_hint' => count($emailParts) === 2 ? substr($emailParts[0], 0, 1).'***@'.$emailParts[1] : 'invalid',
            'gmail_send_scope_granted' => true,
        ]);

        return redirect()->route('gmail-integration.index')
            ->with('status', 'Gmail notifications are connected as '.$email.'.');
    }

    public function disconnect(): RedirectResponse
    {
        $connection = GmailConnection::query()->whereKey('system')->first();

        if ($connection) {
            try {
                $this->googleRequest()->asForm()->timeout(10)->post('https://oauth2.googleapis.com/revoke', [
                    'token' => $connection->refresh_token,
                ]);
            } catch (\Throwable $exception) {
                Log::notice('Could not revoke the Gmail grant during disconnect.', ['exception' => $exception::class]);
            }

            $connection->delete();
        }

        return redirect()->route('gmail-integration.index')->with('status', 'The Gmail sender has been disconnected.');
    }

    private function oauthConfigured(): bool
    {
        return filled(config('services.gmail.client_id')) && filled(config('services.gmail.client_secret'));
    }

    private function redirectUri(): string
    {
        return (string) (config('services.gmail.redirect_uri') ?: route('gmail-integration.callback'));
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
