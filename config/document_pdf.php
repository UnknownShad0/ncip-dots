<?php

return [
    // Set this explicitly on Windows to the installed chrome-headless-shell.exe.
    'browser_binary' => env('DOCUMENT_PDF_BROWSER_BINARY'),
    'node_binary' => env('DOCUMENT_PDF_NODE_BINARY', 'node'),
    'timeout' => (int) env('DOCUMENT_PDF_TIMEOUT', 45),
    'prefer_headless_shell' => env('DOCUMENT_PDF_PREFER_HEADLESS_SHELL', DIRECTORY_SEPARATOR === '\\'),
    'puppeteer_cache_dir' => env('PUPPETEER_CACHE_DIR'),
    // Keep Chromium's process sandbox enabled. Disable only in an already
    // isolated container that cannot support the browser sandbox.
    'sandbox' => env('DOCUMENT_PDF_SANDBOX', true),
];
