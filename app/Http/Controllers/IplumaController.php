<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class IplumaController extends Controller
{
    public function index()
    {
        return Inertia::render('Ipluma/Index', [
            'documents' => $this->fetchDocuments(),
        ]);
    }

    private function fetchDocuments(): array
    {
        $baseUrl = rtrim(config('services.ipluma.url', env('IPLUMA_API_URL')), '/');
        $apiKey = config('services.ipluma.key', env('IPLUMA_API_KEY'));
        $appName = config('services.ipluma.app_name', env('IPLUMA_APP_NAME', 'IPluma'));
        $requestUrl = $baseUrl ? $baseUrl . '/dots-summary' : null;

        if (! $requestUrl || ! $apiKey) {
            return [];
        }

        try {
            $verifySsl = filter_var(env('IPLUMA_VERIFY_SSL', false), FILTER_VALIDATE_BOOLEAN);

            $response = Http::withOptions([
                'verify' => $verifySsl,
            ])
                ->withHeaders([
                    'x-api-key' => $apiKey,
                    'x-app-name' => $appName,
                    'Accept' => 'application/json',
                ])
                ->timeout(30)
                ->get($requestUrl);

            if (! $response->successful()) {
                return [];
            }

            $payload = $response->json();
            $items = $payload;

            if (is_array($payload) && isset($payload['data']) && is_array($payload['data'])) {
                $items = $payload['data'];
            }

            return array_map(fn (array $item) => $this->normalizeDocument($item), array_values($items));
        } catch (\Throwable $e) {
            return [];
        }
    }

    private function normalizeDocument(array $item): array
    {
        $trails = array_map(function ($trail) {
            $signer = $trail['signer'] ?? [];

            return [
                'step' => (int) ($trail['step'] ?? 0),
                'parallel' => (bool) ($trail['parallel'] ?? false),
                'declineSigning' => (bool) ($trail['declineSigning'] ?? false),
                'remarks' => $trail['remarks'] ?? null,
                'signedAt' => $trail['signedAt'] ?? 'Pending',
                'name' => $signer['name'] ?? 'N/A',
                'email' => $signer['email'] ?? '',
                'declined' => (bool) ($trail['declineSigning'] ?? false),
            ];
        }, $item['signingTrails'] ?? []);

        $originator = $item['originator'] ?? [];
        $status = $this->determineStatus($trails);

        return [
            'dotsId' => $item['dotsId'] ?? 'N/A',
            'fileName' => $item['fileName'] ?? 'N/A',
            'fileType' => $item['fileType'] ?? 'N/A',
            'originatorName' => $originator['name'] ?? 'N/A',
            'originatorEmail' => $originator['email'] ?? '',
            'uploadedAt' => $this->formatDate($item['uploadedAt'] ?? null),
            'sharedAt' => $this->formatDate($item['sharedAt'] ?? null),
            'signers' => implode(', ', array_filter(array_map(fn ($trail) => $trail['name'] ?? null, $trails))),
            'status' => $status,
            'signingTrails' => $trails,
        ];
    }

    private function determineStatus(array $trails): string
    {
        if ($trails === []) {
            return 'UPLOADED';
        }

        $declined = false;
        $allSigned = true;

        foreach ($trails as $trail) {
            if (($trail['declined'] ?? false) || ($trail['declineSigning'] ?? false)) {
                $declined = true;
            }

            if (($trail['signedAt'] ?? 'Pending') === 'Pending' || empty($trail['signedAt'])) {
                $allSigned = false;
            }
        }

        if ($declined) {
            return 'DECLINED';
        }

        if ($allSigned) {
            return 'SIGNED';
        }

        return 'IN PROGRESS';
    }

    private function formatDate(?string $value): string
    {
        if (! $value) {
            return 'N/A';
        }

        try {
            return \Illuminate\Support\Carbon::parse($value)->format('M d, Y g:i A');
        } catch (\Throwable $e) {
            return $value;
        }
    }
}
