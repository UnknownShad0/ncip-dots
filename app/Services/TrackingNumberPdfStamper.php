<?php

namespace App\Services;

use RuntimeException;
use setasign\Fpdi\Fpdi;

class TrackingNumberPdfStamper
{
    private const PAGE_MARGIN_MM = 10;

    public function stamp(string $sourcePath, string $trackingNumber): string
    {
        $pdf = new Fpdi();
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
                $this->addTrackingNumber($pdf, $size['width'], $trackingNumber);
            }
        }

        return $pdf->Output('S');
    }

    private function addTrackingNumber(Fpdi $pdf, float $pageWidth, string $trackingNumber): void
    {
        $label = $this->pdfText('DOTS Tracking No.: '.$trackingNumber);
        $fontSize = 9;
        $availableWidth = max(1, $pageWidth - (self::PAGE_MARGIN_MM * 2));

        do {
            $pdf->SetFont('Arial', 'B', $fontSize);
            $textWidth = $pdf->GetStringWidth($label);
            if ($textWidth <= $availableWidth || $fontSize <= 6) {
                break;
            }
            $fontSize--;
        } while (true);

        $x = max(self::PAGE_MARGIN_MM, $pageWidth - self::PAGE_MARGIN_MM - $textWidth);
        $pdf->SetTextColor(17, 17, 17);
        $pdf->SetXY($x, self::PAGE_MARGIN_MM);
        $pdf->Cell($textWidth, 5, $label, 0, 0, 'R');
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
