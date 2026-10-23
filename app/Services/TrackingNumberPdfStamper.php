<?php

namespace App\Services;

use RuntimeException;
use setasign\Fpdi\Fpdi;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class TrackingNumberPdfStamper
{
    private const QR_PANEL_SIZE_MM = 32;

    private const QR_SIZE_MM = 24;

    private const QR_TOP_MARGIN_MM = 10;

    private const QR_RIGHT_MARGIN_MM = 10;

    // Matches the generated document's existing .65in footer-left position.
    private const DOTS_NUMBER_LEFT_MM = 16.51;

    // Matches the generated document's existing 8px bottom offset and line box.
    private const DOTS_NUMBER_BOTTOM_MM = 2.12;

    public function stamp(string $sourcePath, string $trackingNumber, string $trackingUrl): string
    {
        $matrix = $this->qrMatrix($trackingUrl);
        $pdf = new Fpdi;
        $pageCount = $pdf->setSourceFile($sourcePath);
        if ($pageCount < 1) {
            throw new RuntimeException('The uploaded PDF has no pages.');
        }

        $pdf->SetAutoPageBreak(false);

        for ($pageNumber = 1; $pageNumber <= $pageCount; $pageNumber++) {
            $template = $pdf->importPage($pageNumber);
            $size = $pdf->getTemplateSize($template);
            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
            $pdf->useTemplate($template);

            if ($pageNumber === 1) {
                $this->addQrCode($pdf, $size['width'], $matrix);
                $this->addTrackingNumber($pdf, $size['width'], $size['height'], $trackingNumber);
            }
        }

        return $pdf->Output('S');
    }

    public function stampBytes(string $sourcePdf, string $trackingNumber, string $trackingUrl): string
    {
        $temporaryPath = tempnam(sys_get_temp_dir(), 'dots-pdf-source-');
        if (! is_string($temporaryPath)) {
            throw new RuntimeException('Could not prepare the PDF for tracking marks.');
        }

        try {
            if (file_put_contents($temporaryPath, $sourcePdf, LOCK_EX) !== strlen($sourcePdf)) {
                throw new RuntimeException('Could not prepare the PDF for tracking marks.');
            }
            chmod($temporaryPath, 0600);

            return $this->stamp($temporaryPath, $trackingNumber, $trackingUrl);
        } finally {
            if (is_file($temporaryPath)) {
                @unlink($temporaryPath);
            }
        }
    }

    /** @param array{size: int, rows: list<string>} $matrix */
    private function addQrCode(Fpdi $pdf, float $pageWidth, array $matrix): void
    {
        $panelX = max(0.0, $pageWidth - self::QR_RIGHT_MARGIN_MM - self::QR_PANEL_SIZE_MM);
        $panelY = self::QR_TOP_MARGIN_MM;
        $qrInset = (self::QR_PANEL_SIZE_MM - self::QR_SIZE_MM) / 2;
        $qrX = $panelX + $qrInset;
        $qrY = $panelY + $qrInset;
        $moduleSize = self::QR_SIZE_MM / $matrix['size'];

        $pdf->SetFillColor(255, 255, 255);
        $pdf->Rect($panelX, $panelY, self::QR_PANEL_SIZE_MM, self::QR_PANEL_SIZE_MM, 'F');
        $pdf->SetFillColor(0, 0, 0);

        foreach ($matrix['rows'] as $rowIndex => $row) {
            $runStart = null;
            for ($column = 0; $column <= $matrix['size']; $column++) {
                $dark = $column < $matrix['size'] && $row[$column] === '1';
                if ($dark && $runStart === null) {
                    $runStart = $column;
                }
                if (! $dark && $runStart !== null) {
                    $pdf->Rect(
                        $qrX + ($runStart * $moduleSize),
                        $qrY + ($rowIndex * $moduleSize),
                        ($column - $runStart) * $moduleSize,
                        $moduleSize,
                        'F',
                    );
                    $runStart = null;
                }
            }
        }
    }

    private function addTrackingNumber(Fpdi $pdf, float $pageWidth, float $pageHeight, string $trackingNumber): void
    {
        $label = $this->pdfText('DOTS No.: '.$trackingNumber);
        $fontSize = 9;
        $availableWidth = max(1, $pageWidth - self::DOTS_NUMBER_LEFT_MM - self::QR_RIGHT_MARGIN_MM);

        do {
            $pdf->SetFont('Arial', 'B', $fontSize);
            $textWidth = $pdf->GetStringWidth($label);
            if ($textWidth <= $availableWidth || $fontSize <= 6) {
                break;
            }
            $fontSize--;
        } while (true);

        $lineHeight = 4;
        $textY = max(0, $pageHeight - self::DOTS_NUMBER_BOTTOM_MM - $lineHeight);
        $backgroundPadding = 1.5;
        $pdf->SetFillColor(255, 255, 255);
        $pdf->Rect(
            max(0, self::DOTS_NUMBER_LEFT_MM - $backgroundPadding),
            max(0, $textY - $backgroundPadding),
            min($pageWidth - self::DOTS_NUMBER_LEFT_MM + $backgroundPadding, $textWidth + ($backgroundPadding * 2)),
            $lineHeight + ($backgroundPadding * 2),
            'F',
        );
        $pdf->SetTextColor(17, 17, 17);
        $pdf->SetXY(self::DOTS_NUMBER_LEFT_MM, $textY);
        $pdf->Cell($textWidth, $lineHeight, $label, 0, 0, 'L');
    }

    /** @return array{size: int, rows: list<string>} */
    private function qrMatrix(string $trackingUrl): array
    {
        if ($trackingUrl === '') {
            throw new RuntimeException('The public tracking URL is required.');
        }

        $configuredNode = (string) config('document_pdf.node_binary', 'node');
        $node = is_file($configuredNode) && is_executable($configuredNode)
            ? $configuredNode
            : (new ExecutableFinder)->find($configuredNode);
        if (! $node) {
            throw new RuntimeException('PDF tracking stamps require Node.js. Set DOCUMENT_PDF_NODE_BINARY to its executable.');
        }

        $process = new Process([$node, base_path('scripts/generate-qr-matrix.mjs')], base_path());
        $process->setInput(json_encode(['value' => $trackingUrl], JSON_THROW_ON_ERROR));
        $process->setTimeout(10)->run();
        if (! $process->isSuccessful()) {
            throw new RuntimeException('Could not generate the PDF tracking QR code: '.trim($process->getErrorOutput()));
        }

        $matrix = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
        $size = $matrix['size'] ?? null;
        $rows = $matrix['rows'] ?? null;
        if (! is_int($size) || $size < 21 || $size > 177 || ! is_array($rows) || count($rows) !== $size) {
            throw new RuntimeException('The PDF tracking QR generator returned an invalid matrix.');
        }
        foreach ($rows as $row) {
            if (! is_string($row) || strlen($row) !== $size || preg_match('/[^01]/', $row)) {
                throw new RuntimeException('The PDF tracking QR generator returned an invalid matrix.');
            }
        }

        return ['size' => $size, 'rows' => array_values($rows)];
    }

    private function pdfText(string $value): string
    {
        if (function_exists('iconv')) {
            $converted = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value);
            if ($converted !== false) {
                return $converted;
            }
        }

        return preg_replace('/[^\x20-\x7E]/', '?', $value) ?? $value;
    }
}
