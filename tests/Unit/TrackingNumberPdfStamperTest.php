<?php

namespace Tests\Unit;

use App\Services\TrackingNumberPdfStamper;
use setasign\Fpdi\Fpdi;
use Tests\TestCase;

class TrackingNumberPdfStamperTest extends TestCase
{
    public function test_it_adds_one_qr_panel_and_footer_left_dots_number_to_the_first_page(): void
    {
        $source = new Fpdi;
        $source->AddPage('P', 'Letter');
        $source->SetFont('Arial', '', 12);
        $source->Text(20, 20, 'First page source content');
        $source->AddPage('L', 'A4');
        $source->Text(20, 20, 'Second page source content');

        $result = app(TrackingNumberPdfStamper::class)->stampBytes(
            $source->Output('S'),
            'DOTS-26-10-0001',
            'http://127.0.0.1:8000/track/DOTS-26-10-0001?signature=test-signature',
        );

        $this->assertStringStartsWith('%PDF-', $result);
        $streams = $this->decompressedStreams($result);
        $this->assertSame(1, substr_count($streams, 'DOTS No.: DOTS-26-10-0001'));
        $this->assertStringNotContainsString('DOTS Tracking No.', $streams);
        $this->assertStringNotContainsString('Scan to track this document', $streams);
        $this->assertGreaterThan(100, substr_count($streams, ' re f'), 'The first page should contain the vector QR modules and white panel.');
        $this->assertGreaterThanOrEqual(2, substr_count($streams, '1.000 1.000 1.000 rg'), 'Both the QR and footer number should have opaque white backing.');

        $path = tempnam(sys_get_temp_dir(), 'dots-stamped-test-');
        $this->assertIsString($path);
        try {
            file_put_contents($path, $result);
            $verification = new Fpdi;
            $this->assertSame(2, $verification->setSourceFile($path));
        } finally {
            if (is_string($path) && is_file($path)) {
                unlink($path);
            }
        }
    }

    private function decompressedStreams(string $pdf): string
    {
        preg_match_all('/stream\r?\n(.*?)\r?\nendstream/s', $pdf, $matches);

        return collect($matches[1] ?? [])
            ->map(fn (string $stream) => gzuncompress($stream))
            ->filter(fn ($stream) => is_string($stream))
            ->implode("\n");
    }
}
