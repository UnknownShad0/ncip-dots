<?php

namespace App\Services;

use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\HeaderUtils;

/** A PDF and the geometry produced by the shared browser document renderer. */
class RenderedDocumentPdf
{
    public function __construct(private string $bytes, private array $metadata) {}

    public function output(): string
    {
        return $this->bytes;
    }

    public function render(): self
    {
        return $this;
    }

    public function stream(string $filename = 'document.pdf'): Response
    {
        return response($this->bytes, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => HeaderUtils::makeDisposition('inline', $filename, 'document.pdf'),
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function pageCount(): int
    {
        return (int) $this->metadata['pages'];
    }

    public function layout(): array
    {
        return $this->metadata;
    }
}
