<?php

namespace App\Services;

use App\Models\DocumentCreationDraft;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;
use Throwable;

class DocumentPdf
{
    public function approvedContent(DocumentCreationDraft $draft): array
    {
        return DocumentMetadata::present(
            $draft->versions()->where('version_number', $draft->version_number)->first()?->content ?? $draft->content ?? [],
            $draft->creator,
        );
    }

    public function renderDraft(DocumentCreationDraft $draft, ?string $trackingNumber = null): RenderedDocumentPdf
    {
        $content = $this->approvedContent($draft);
        if ($trackingNumber !== null) {
            $content['tracking_number'] = $trackingNumber;
            $content['tracking_url'] = URL::signedRoute('documents.track', [
                'trackingNumber' => $trackingNumber,
            ]);
        }

        return $this->pdf($draft->title, $content);
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
        $node = $this->nodeBinary();
        if (! $node) {
            throw new \RuntimeException('Document PDF rendering requires Node.js. Set DOCUMENT_PDF_NODE_BINARY to its executable.');
        }
        $browserEnvironment = DIRECTORY_SEPARATOR === '\\' ? self::windowsBrowserEnvironment() : [];
        $environmentDiagnostics = self::environmentDiagnostics($browserEnvironment);
        if (DIRECTORY_SEPARATOR === '\\') {
            $invalidEnvironment = self::invalidWindowsBrowserEnvironment($environmentDiagnostics);
            if ($invalidEnvironment !== []) {
                $details = self::formatEnvironmentDiagnostics($environmentDiagnostics);
                $message = 'Document PDF rendering requires valid Windows user-profile paths. Browser: '.$browser.'; Node: '.$node
                    .'. Invalid environment: '.implode(', ', $invalidEnvironment)."\n".$details;
                Log::error('Document PDF rendering could not start: invalid Windows browser environment.', [
                    'browser' => $browser,
                    'node' => $node,
                    'environment' => $environmentDiagnostics,
                ]);
                throw new \RuntimeException($message);
            }
        }
        $directory = storage_path('app/private/document-renderer/'.bin2hex(random_bytes(16)));
        File::ensureDirectoryExists($directory, 0700, true);

        $process = null;
        try {
            $input = $directory.'/document.html';
            $output = $directory.'/document.pdf';
            File::put($input, $html);
            chmod($input, 0600);
            $options = [
                'html' => $input, 'output' => $output, 'profile' => $directory.'/profile',
                'crashDumps' => $directory.'/crash-dumps',
                'browser' => $browser, 'sandbox' => (bool) config('document_pdf.sandbox', true),
                'browserEnv' => $browserEnvironment,
                'timeout' => max(10, (int) config('document_pdf.timeout', 45)),
            ];
            $job = $directory.'/job.json';
            File::put($job, json_encode($options, JSON_THROW_ON_ERROR));
            $processEnv = $browserEnvironment;
            $process = new Process([$node, base_path('scripts/render-document-pdf.mjs'), $job], base_path(), $processEnv);
            // PHP's web request limit can be lower than the renderer's timeout.
            // Extend this request so Symfony can collect the renderer's error
            // and the Node process can close Chromium and remove its profile.
            if (function_exists('set_time_limit')) {
                set_time_limit($options['timeout'] + 20);
            }
            $process->setTimeout($options['timeout'] + 10)->run();
            if (! $process->isSuccessful()) {
                throw new \RuntimeException('The Node renderer exited unsuccessfully.');
            }
            $layout = json_decode($process->getOutput(), true, 512, JSON_THROW_ON_ERROR);
            if (! is_array($layout) || ! is_int($layout['pages'] ?? null) || $layout['pages'] < 1 || ! File::exists($output)) {
                throw new \RuntimeException('The document renderer returned an incomplete PDF.');
            }

            return new RenderedDocumentPdf(File::get($output), $layout);
        } catch (Throwable $error) {
            if (DIRECTORY_SEPARATOR === '\\' && $process instanceof Process && $process->getPid()) {
                $this->killProcessTree($process->getPid());
            }
            $stderr = $process instanceof Process ? self::lastLines($process->getErrorOutput(), 40) : '';
            $exitCode = $process instanceof Process ? $process->getExitCode() : null;
            preg_match('/Chromium exited \((-?\d+)\)/', $stderr, $browserExitMatch);
            $browserExitCode = isset($browserExitMatch[1]) ? (int) $browserExitMatch[1] : null;
            $message = sprintf(
                "Document PDF rendering failed. Browser: %s; Node: %s; Node exit code: %s; Chromium exit code: %s.%s%s",
                $browser,
                $node,
                $exitCode === null ? 'unavailable' : (string) $exitCode,
                $browserExitCode === null ? 'unavailable' : $browserExitCode.' (0x'.strtoupper(sprintf('%08X', $browserExitCode & 0xFFFFFFFF)).')',
                $stderr !== '' ? "\nChromium/Node stderr:\n".$stderr : '',
                DIRECTORY_SEPARATOR === '\\' ? "\nWindows environment:\n".self::formatEnvironmentDiagnostics($environmentDiagnostics) : '',
            );
            Log::error('Document PDF rendering failed.', [
                'browser' => $browser,
                'node' => $node,
                'node_exit_code' => $exitCode,
                'chromium_exit_code' => $browserExitCode,
                'stderr' => $stderr,
                'environment' => $environmentDiagnostics,
                'exception' => $error->getMessage(),
            ]);
            throw new \RuntimeException($message, previous: $error);
        } finally {
            $this->deleteDirectoryWithRetry($directory);
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

    public function browserBinary(): string
    {
        $configured = config('document_pdf.browser_binary');
        if ($configured) {
            $binary = $this->executable($configured);
            if ($binary) return $binary;
            throw new \RuntimeException('DOCUMENT_PDF_BROWSER_BINARY does not point to an executable Chrome, Chromium, Edge, or chrome-headless-shell browser.');
        }
        if (DIRECTORY_SEPARATOR === '\\' && config('document_pdf.prefer_headless_shell', true)) {
            foreach ($this->headlessShellCandidates() as $candidate) {
                $binary = $this->executable($candidate);
                if ($binary) return $binary;
            }
        }
        $candidates = DIRECTORY_SEPARATOR === '\\' ? $this->windowsBrowserCandidates() : [];
        $candidates = [...$candidates, ...[
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
        ]];
        foreach ($candidates as $candidate) {
            $binary = $this->executable($candidate);
            if ($binary) return $binary;
        }

        throw new \RuntimeException('Document PDF rendering requires Chrome, Chromium, Edge, or chrome-headless-shell. Install it and set DOCUMENT_PDF_BROWSER_BINARY.');
    }

    public function nodeBinary(): ?string
    {
        return $this->executable((string) config('document_pdf.node_binary', 'node'));
    }

    /** @return array<string, string> Environment explicitly inherited by Chromium on Windows. */
    public static function windowsBrowserEnvironment(?array $source = null): array
    {
        $environment = [];
        foreach ([
            'USERNAME', 'USERDOMAIN', 'SystemRoot', 'WINDIR', 'USERPROFILE',
            'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP',
            'PUPPETEER_CACHE_DIR',
        ] as $name) {
            $value = $source === null ? getenv($name) : ($source[$name] ?? null);
            if ($source === null && (! is_string($value) || trim($value) === '') && isset($_SERVER[$name])) {
                $value = $_SERVER[$name];
            }
            if (is_string($value) && trim($value) !== '') {
                $environment[$name] = trim($value);
            }
        }

        if (empty($environment['USERPROFILE']) && ! empty($environment['HOMEDRIVE']) && ! empty($environment['HOMEPATH'])) {
            $environment['USERPROFILE'] = rtrim($environment['HOMEDRIVE'], '\\/').$environment['HOMEPATH'];
        }
        if (empty($environment['SystemRoot']) && ! empty($environment['WINDIR'])) {
            $environment['SystemRoot'] = $environment['WINDIR'];
        }
        if (empty($environment['WINDIR']) && ! empty($environment['SystemRoot'])) {
            $environment['WINDIR'] = $environment['SystemRoot'];
        }

        $profile = $environment['USERPROFILE'] ?? null;
        if ($profile) {
            $environment['APPDATA'] ??= rtrim($profile, '\\/').'\\AppData\\Roaming';
            $environment['LOCALAPPDATA'] ??= rtrim($profile, '\\/').'\\AppData\\Local';
            $environment['TEMP'] ??= rtrim($profile, '\\/').'\\AppData\\Local\\Temp';
            $environment['TMP'] ??= $environment['TEMP'];
        }

        return $environment;
    }

    public static function environmentDiagnostics(?array $environment = null): array
    {
        $environment ??= DIRECTORY_SEPARATOR === '\\' ? self::windowsBrowserEnvironment() : [];
        $diagnostics = [
            'USERNAME' => $environment['USERNAME'] ?? '(missing)',
            'USERDOMAIN' => $environment['USERDOMAIN'] ?? '(missing)',
        ];
        foreach (['SystemRoot', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP'] as $name) {
            $path = $environment[$name] ?? '';
            $diagnostics[$name] = [
                'path' => $path !== '' ? $path : '(missing)',
                'exists' => $path !== '' && is_dir($path),
                'writable' => $path !== '' && is_dir($path) && is_writable($path),
            ];
        }

        return $diagnostics;
    }

    public static function invalidWindowsBrowserEnvironment(array $diagnostics): array
    {
        $invalid = [];
        foreach (['SystemRoot', 'WINDIR', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'TEMP', 'TMP'] as $name) {
            $item = $diagnostics[$name] ?? [];
            if (! ($item['exists'] ?? false)) $invalid[] = $name.' missing or not a directory';
        }

        return $invalid;
    }

    public static function formatEnvironmentDiagnostics(array $diagnostics): string
    {
        $lines = [];
        foreach ($diagnostics as $name => $value) {
            if (is_array($value)) {
                $lines[] = sprintf('%s=%s (exists: %s, writable: %s)', $name, $value['path'], $value['exists'] ? 'yes' : 'no', $value['writable'] ? 'yes' : 'no');
            } else {
                $lines[] = $name.'='.$value;
            }
        }

        return implode("\n", $lines);
    }

    public static function lastLines(string $text, int $limit = 40): string
    {
        $lines = preg_split('/\r?\n/', trim($text)) ?: [];

        return implode("\n", array_slice($lines, -$limit));
    }

    private function headlessShellCandidates(): array
    {
        $environment = self::windowsBrowserEnvironment();
        $roots = array_filter([
            config('document_pdf.puppeteer_cache_dir'),
            $environment['PUPPETEER_CACHE_DIR'] ?? null,
            isset($environment['USERPROFILE']) ? rtrim($environment['USERPROFILE'], '\\/').'\\.cache\\puppeteer' : null,
        ]);
        $candidates = [];
        foreach ($roots as $root) {
            $pattern = rtrim($root, '\\/').DIRECTORY_SEPARATOR.'chrome-headless-shell'.DIRECTORY_SEPARATOR.'*'.DIRECTORY_SEPARATOR.'chrome-headless-shell-win64'.DIRECTORY_SEPARATOR.'chrome-headless-shell.exe';
            $candidates = [...$candidates, ...glob($pattern) ?: []];
        }

        return array_reverse($candidates);
    }

    private function windowsBrowserCandidates(): array
    {
        $environment = self::windowsBrowserEnvironment();
        $programFiles = getenv('ProgramFiles') ?: ($_SERVER['ProgramFiles'] ?? 'C:\\Program Files');
        $programFilesX86 = getenv('ProgramFiles(x86)') ?: ($_SERVER['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)');
        $localAppData = $environment['LOCALAPPDATA'] ?? '';

        return array_filter([
            $localAppData !== '' ? $localAppData.'\\Google\\Chrome\\Application\\chrome.exe' : null,
            $programFiles.'\\Google\\Chrome\\Application\\chrome.exe',
            $programFilesX86.'\\Google\\Chrome\\Application\\chrome.exe',
            $localAppData !== '' ? $localAppData.'\\Microsoft\\Edge\\Application\\msedge.exe' : null,
            $programFiles.'\\Microsoft\\Edge\\Application\\msedge.exe',
            $programFilesX86.'\\Microsoft\\Edge\\Application\\msedge.exe',
        ]);
    }

    private function killProcessTree(?int $pid): void
    {
        if (! $pid || DIRECTORY_SEPARATOR !== '\\') return;
        try {
            (new Process(['taskkill.exe', '/PID', (string) $pid, '/T', '/F']))->setTimeout(5)->run();
        } catch (Throwable $error) {
            Log::warning('Could not terminate the document PDF process tree.', ['pid' => $pid, 'error' => $error->getMessage()]);
        }
    }

    private function deleteDirectoryWithRetry(string $directory): void
    {
        foreach ([0, 150000, 300000, 600000] as $delay) {
            if ($delay > 0) usleep($delay);
            try {
                File::deleteDirectory($directory);
                if (! File::exists($directory)) return;
            } catch (Throwable $error) {
                Log::debug('Retrying document PDF temporary directory cleanup.', ['directory' => $directory, 'error' => $error->getMessage()]);
            }
        }
        Log::warning('Could not completely remove a document PDF temporary directory.', ['directory' => $directory]);
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
