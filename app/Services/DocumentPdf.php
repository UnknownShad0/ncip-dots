<?php

namespace App\Services;

use App\Models\DocumentCreationDraft;
use Barryvdh\DomPDF\Facade\Pdf;

class DocumentPdf
{
    public function approvedContent(DocumentCreationDraft $draft): array
    {
        return $draft->versions()->where('version_number', $draft->version_number)->first()?->content ?? $draft->content ?? [];
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

    public function response(string $title, array $content)
    {
        return Pdf::loadHTML($this->html($title, $content))->setPaper('letter')->stream('document.pdf');
    }
}
