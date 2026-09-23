<?php

namespace App\Http\Controllers;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class IntegrationController extends Controller
{
    public function drip()
    {
        return Inertia::render('Integrations/Index', [
            'system' => 'DRIP',
            'documents' => $this->fetchDocuments('drip'),
        ]);
    }

    public function ipluma()
    {
        return Inertia::render('Integrations/Index', [
            'system' => 'iPLuma',
            'documents' => $this->fetchDocuments('ipluma'),
        ]);
    }

    public function pdmis()
    {
        return Inertia::render('Integrations/Index', [
            'system' => 'PDMIS',
            'documents' => $this->fetchDocuments('pdmis'),
        ]);
    }

    private function fetchDocuments(string $service): array
    {
        $config = config("services.{$service}", []);
        $baseUrl = rtrim($config['url'] ?? env(strtoupper($service) . '_API_URL'), '/');
        $apiKey = $config['key'] ?? env(strtoupper($service) . '_API_KEY', env(strtoupper($service) . '_API_TOKEN'));
        $appName = $config['app_name'] ?? env(strtoupper($service) . '_APP_NAME', ucfirst($service));
        $authHeader = $config['auth_header'] ?? 'x-api-key';
        $requestUrl = $baseUrl ? $baseUrl . '/dots-summary' : null;

        if (! $requestUrl || ! $apiKey) {
            return [];
        }

        try {
            $verifySsl = filter_var(env(strtoupper($service) . '_VERIFY_SSL', false), FILTER_VALIDATE_BOOLEAN);

            $headers = [
                'Accept' => 'application/json',
                'x-app-name' => $appName,
            ];

            if ($authHeader === 'Authorization') {
                $headers['Authorization'] = 'Bearer ' . $apiKey;
            } else {
                $headers['x-api-key'] = $apiKey;
            }

            $response = Http::withOptions([
                'verify' => $verifySsl,
            ])
                ->withHeaders($headers)
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
                'name' => $signer['name'] ?? 'N/A',
                'email' => $signer['email'] ?? '',
                'signedAt' => $trail['signedAt'] ?? 'Pending',
                'declined' => (bool) ($trail['declineSigning'] ?? false),
                'remarks' => $trail['remarks'] ?? null,
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
            return Carbon::parse($value)->format('M d, Y g:i A');
        } catch (\Throwable $e) {
            return $value;
        }
    }
}
