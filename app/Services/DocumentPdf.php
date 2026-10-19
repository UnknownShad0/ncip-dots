<?php

namespace App\Services;

use App\Models\DocumentCreationDraft;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

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

    public function pdf(string $title, array $content, bool $measureEditor = false): RenderedDocumentPdf
    {
        $html = $this->browserHtml($title, $content, $measureEditor);
        $browser = $this->browserBinary();
        $node = $this->executable((string) config('document_pdf.node_binary', 'node'));
        if (! $node) {
            throw new \RuntimeException('Document PDF rendering requires Node.js. Set DOCUMENT_PDF_NODE_BINARY to its executable.');
        }
        $directory = storage_path('app/private/document-renderer/'.bin2hex(random_bytes(16)));
        File::ensureDirectoryExists($directory, 0700, true);

        try {
            $input = $directory.'/document.html';
            $output = $directory.'/document.pdf';
            File::put($input, $html);
            chmod($input, 0600);
            $options = [
                'html' => $input, 'output' => $output, 'profile' => $directory.'/profile',
                'browser' => $browser, 'sandbox' => (bool) config('document_pdf.sandbox', true),
                'timeout' => max(10, (int) config('document_pdf.timeout', 45)),
            ];
            $job = $directory.'/job.json';
            File::put($job, json_encode($options, JSON_THROW_ON_ERROR));
            $processEnv = [];
            if (DIRECTORY_SEPARATOR === '\\') {
                // Symfony filters inherited environment variables for web SAPIs.
                // Node on Windows needs SystemRoot during startup, even when the
                // parent PHP process can still read it with getenv().
                $systemRoot = getenv('SystemRoot') ?: getenv('WINDIR') ?: ($_SERVER['SystemRoot'] ?? $_SERVER['WINDIR'] ?? null);
                if (is_string($systemRoot) && $systemRoot !== '') {
                    $processEnv['SystemRoot'] = $systemRoot;
                }
            }
            $process = new Process([$node, base_path('scripts/render-document-pdf.mjs'), $job], base_path(), $processEnv);
            $process->setTimeout($options['timeout'] + 10)->run();
            if (! $process->isSuccessful()) {
                throw new \RuntimeException('Document PDF rendering failed: '.trim($process->getErrorOutput()));
            }
            $layout = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($layout) || ! is_int($layout['pages'] ?? null) || $layout['pages'] < 1 || ! File::exists($output)) {
                throw new \RuntimeException('The document renderer returned an incomplete PDF.');
            }

            return new RenderedDocumentPdf(File::get($output), $layout);
        } finally {
            File::deleteDirectory($directory);
        }
    }

    /** Self-contained renderer input: no account cookies or network access needed. */
    public function browserHtml(string $title, array $content, bool $measureEditor = false): string
    {
        $bundle = public_path('build/document-renderer.js');
        $stylesheet = public_path('build/document-renderer.css');
        if (! is_file($bundle) || ! is_file($stylesheet)) {
            throw new \RuntimeException('The shared document renderer has not been built. Run npm run build before generating PDFs.');
        }
        $content = DocumentMetadata::present($content, null);
        $content['document_title'] ??= $title;
        // Resolve only a server-validated snapshot; never trust supplied image URLs.
        $content['template'] = isset($content['template_snapshot'])
            ? app(DocumentTemplates::class)->presentation($content['template_snapshot'], true)
            : $this->defaultBrowserTemplate();
        unset($content['template_snapshot']);
        $encoded = json_encode($content, JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
        $styles = File::get($stylesheet).$this->embeddedFonts();
        // Bundle code is trusted build output. JSON document content is escaped
        // separately so strings such as </script> cannot escape their container.
        $script = str_ireplace('</script', '<\\/script', File::get($bundle));
        $documentTitle = htmlspecialchars((string) $content['document_title'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return '<!doctype html><html><head><meta charset="utf-8">'
            .'<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; font-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\';">'
            .'<title>'.$documentTitle.'</title><style>'.$styles.'</style></head><body>'
            .'<div id="document-renderer-root"></div><script>window.__DOCUMENT_CONTENT__='.$encoded
            .';window.__DOCUMENT_TEST_EDIT__='.($measureEditor ? 'true' : 'false').';</script>'
            .'<script>'.$script.'</script></body></html>';
    }

    private function embeddedFonts(): string
    {
        $styles = '';
        foreach ([
            ['Arial.ttf', 'normal', 400], ['Arial-Bold.ttf', 'normal', 700],
            ['Arial-Italic.ttf', 'italic', 400], ['Arial-BoldItalic.ttf', 'italic', 700],
        ] as [$filename, $style, $weight]) {
            $path = storage_path('app/private/fonts/arial/'.$filename);
            if (! is_file($path)) {
                throw new \RuntimeException('Document font '.$filename.' is missing. Run scripts/install-document-fonts.php with the licensed font directory.');
            }
            $styles .= '@font-face{font-family:"Document Arial";font-style:'.$style.';font-weight:'.$weight
                .';src:url("data:font/ttf;base64,'.base64_encode(File::get($path)).'") format("truetype");font-display:block;}';
        }

        return $styles;
    }

    private function defaultBrowserTemplate(): array
    {
        $image = fn (string $filename, string $alt) => [
            'src' => 'data:image/png;base64,'.base64_encode(File::get(public_path('images/'.$filename))),
            'alt' => $alt,
        ];

        return [
            'name' => 'NCIP Standard', 'version' => 1, 'version_id' => null,
            'header_mode' => 'image', 'header_text' => [], 'repeat_header' => true,
            'header_images' => [$image('header.png', 'National Commission on Indigenous Peoples')],
            'footer_seal' => $image('bagong-pilipinas.png', 'Bagong Pilipinas'),
            'footer_tagline' => $image('ncip-footer.png', 'Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran'),
        ];
    }

    private function browserBinary(): string
    {
        $configured = config('document_pdf.browser_binary');
        if ($configured) {
            $binary = $this->executable($configured);
            if ($binary) return $binary;
            throw new \RuntimeException('DOCUMENT_PDF_BROWSER_BINARY does not point to an executable Chrome or Chromium browser.');
        }
        foreach ([
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
        ] as $candidate) {
            $binary = $this->executable($candidate);
            if ($binary) return $binary;
        }

        throw new \RuntimeException('Document PDF rendering requires Google Chrome or Chromium. Install it and set DOCUMENT_PDF_BROWSER_BINARY.');
    }

    private function executable(string $candidate): ?string
    {
        return is_file($candidate) && is_executable($candidate)
            ? $candidate : (new ExecutableFinder)->find($candidate);
    }

    public function response(string $title, array $content)
    {
        return $this->pdf($title, $content)->stream('document.pdf');
    }
}
