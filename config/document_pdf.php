<?php

return [
    // Empty selects a locally installed Google Chrome / Chromium executable.
    'browser_binary' => env('DOCUMENT_PDF_BROWSER_BINARY'),
    'node_binary' => env('DOCUMENT_PDF_NODE_BINARY', 'node'),
    'timeout' => (int) env('DOCUMENT_PDF_TIMEOUT', 45),
    // Keep Chromium's process sandbox enabled. Disable only in an already
    // isolated container that cannot support the browser sandbox.
    'sandbox' => env('DOCUMENT_PDF_SANDBOX', true),
];
