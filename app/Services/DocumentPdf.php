<?php

namespace App\Services;

use App\Models\DocumentCreationDraft;
use Barryvdh\DomPDF\Facade\Pdf;

class DocumentPdf
{
    public function approvedContent(DocumentCreationDraft $draft): array
    {
        return DocumentMetadata::present(
            $draft->versions()->where('version_number', $draft->version_number)->first()?->content ?? $draft->content ?? [],
            $draft->creator,
        );
    }

    public function html(string $title, array $content): string
    {
        return view('documents.generated', [
            'title' => $content['document_title'] ?? $title,
            'content' => $content,
            'template' => isset($content['template_snapshot']) ? app(DocumentTemplates::class)->presentation($content['template_snapshot'], true) : null,
            'header' => 'data:image/png;base64,'.base64_encode(file_get_contents(public_path('images/header.png'))),
        ])->render();
    }

    public function pdf(string $title, array $content): \Barryvdh\DomPDF\PDF
    {
        $pdf = Pdf::loadHTML($this->html($title, $content))->setPaper('letter');
        $dompdf = $pdf->getDomPDF();
        // Dompdf multiplies CSS line-height by the font's ascent/descent and
        // fontHeightRatio. Browsers use font-size instead. Normalize after
        // @font-face has loaded, but before the first page is laid out.
        $pdf->setCallbacks([['event' => 'begin_page_reflow', 'f' => function () use ($dompdf): void {
            $metrics = $dompdf->getFontMetrics();
            $font = $metrics->getFont('Arial', 'normal');
            if ($font !== null) {
                $options = $dompdf->getOptions();
                $height = $metrics->getFontHeight($font, 1);
                if ($height > 0) {
                    $options->setFontHeightRatio($options->getFontHeightRatio() / $height);
                }
            }
        }]]);

        return $pdf;
    }

    public function response(string $title, array $content)
    {
        return $this->pdf($title, $content)->stream('document.pdf');
    }
}
