<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class RecaptchaVerifier
{
    private const SITEVERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

    /**
     * Verify the login token. A low v3 score asks the user to complete v2.
     *
     * @throws ValidationException
     */
    public function verifyLogin(Request $request): void
    {
        if (! config('services.recaptcha.enabled')) {
            return;
        }

        $v3SiteKey = config('services.recaptcha.v3_site_key');
        $v3Secret = config('services.recaptcha.v3_secret_key');
        if (! is_string($v3SiteKey) || $v3SiteKey === '' || ! is_string($v3Secret) || $v3Secret === '') {
            $this->reject('recaptcha', 'Login security verification is not configured. Contact your administrator.');
        }

        $v2Token = $request->input('recaptcha_v2_token');
        if (is_string($v2Token) && $v2Token !== '') {
            $v2Secret = config('services.recaptcha.v2_secret_key');
            if (! is_string($v2Secret) || $v2Secret === '') {
                $this->reject('recaptcha_v2', 'The additional security check is unavailable. Contact your administrator.');
            }

            $result = $this->verifyToken($v2Secret, $v2Token);
            if (! $this->isSuccessfulForHost($result, $request)) {
                $this->logVerificationFailure('v2', $result, $request, $this->failureReason($result, $request));
                $this->reject('recaptcha_v2', 'The security check expired or could not be verified. Please complete it again.');
            }

            return;
        }

        $v3Token = $request->input('recaptcha_v3_token');
        if (! is_string($v3Token) || $v3Token === '') {
            $this->reject('recaptcha', 'Complete the security check and try again.');
        }

        $result = $this->verifyToken($v3Secret, $v3Token);
        if (! $this->isSuccessfulForHost($result, $request)) {
            $this->logVerificationFailure('v3', $result, $request, $this->failureReason($result, $request));
            $this->reject('recaptcha', 'The security check could not be verified. Please try again.');
        }

        if (($result['action'] ?? null) !== 'login') {
            $this->logVerificationFailure('v3', $result, $request, 'action_mismatch');
            $this->reject('recaptcha', 'The security check could not be verified. Please try again.');
        }

        if (! is_numeric($result['score'] ?? null)) {
            $this->logVerificationFailure('v3', $result, $request, 'missing_score');
            $this->reject('recaptcha', 'The security check could not be verified. Please try again.');
        }

        $threshold = (float) config('services.recaptcha.score_threshold', 0.5);
        if ((float) $result['score'] < $threshold) {
            $v2SiteKey = config('services.recaptcha.v2_site_key');
            $v2Secret = config('services.recaptcha.v2_secret_key');
            if (! is_string($v2SiteKey) || $v2SiteKey === '' || ! is_string($v2Secret) || $v2Secret === '') {
                $this->reject('recaptcha', 'Additional login verification is not configured. Contact your administrator.');
            }

            $this->reject('recaptcha_v2', 'Please complete the checkbox to continue.');
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function verifyToken(string $secret, string $token): ?array
    {
        try {
            $request = Http::asForm()
                ->acceptJson()
                ->timeout(5);

            // PHP's Windows cURL build may not have a CA bundle configured. Use
            // the Windows root certificate store while keeping TLS verification on.
            if (PHP_OS_FAMILY === 'Windows' && defined('CURLSSLOPT_NATIVE_CA')) {
                $request->withOptions([
                    'curl' => [CURLOPT_SSL_OPTIONS => CURLSSLOPT_NATIVE_CA],
                ]);
            }

            $response = $request->post(self::SITEVERIFY_URL, [
                'secret' => $secret,
                'response' => $token,
            ]);
        } catch (ConnectionException $exception) {
            Log::warning('Login reCAPTCHA siteverify connection failed.', [
                'exception_class' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('Login reCAPTCHA siteverify returned an unsuccessful HTTP response.', [
                'status' => $response->status(),
            ]);

            return null;
        }

        $result = $response->json();
        if (! is_array($result)) {
            Log::warning('Login reCAPTCHA siteverify returned invalid JSON.', [
                'content_type' => $response->header('Content-Type'),
            ]);

            return null;
        }

        return $result;
    }

    /**
     * @param array<string, mixed>|null $result
     */
    private function isSuccessfulForHost(?array $result, Request $request): bool
    {
        $hostname = $result['hostname'] ?? null;

        return ($result['success'] ?? false) === true
            && is_string($hostname)
            && strtolower($hostname) === strtolower($request->getHost());
    }

    /**
     * Log safe response metadata for troubleshooting without recording tokens or secrets.
     *
     * @param array<string, mixed>|null $result
     */
    private function logVerificationFailure(string $version, ?array $result, Request $request, string $reason): void
    {
        $errorCodes = $result['error-codes'] ?? [];

        Log::warning('Login reCAPTCHA verification rejected.', [
            'version' => $version,
            'reason' => $reason,
            'request_host' => $request->getHost(),
            'response_hostname' => $result['hostname'] ?? null,
            'action' => $result['action'] ?? null,
            'score' => $result['score'] ?? null,
            'error_codes' => is_array($errorCodes) ? array_values(array_filter($errorCodes, 'is_string')) : [],
        ]);
    }

    /**
     * @param array<string, mixed>|null $result
     */
    private function failureReason(?array $result, Request $request): string
    {
        if ($result === null) {
            return 'no_siteverify_response';
        }

        if (($result['success'] ?? false) !== true) {
            return 'siteverify_rejected';
        }

        $hostname = $result['hostname'] ?? null;
        if (! is_string($hostname) || strtolower($hostname) !== strtolower($request->getHost())) {
            return 'hostname_mismatch';
        }

        return 'verification_failed';
    }

    /**
     * @throws ValidationException
     */
    private function reject(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
