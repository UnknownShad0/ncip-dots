<?php

namespace App\Http\Controllers;

use Symfony\Component\HttpFoundation\BinaryFileResponse;

class DocumentFontController extends Controller
{
    private const FILES = [
        'regular' => 'Arial.ttf',
        'bold' => 'Arial-Bold.ttf',
        'italic' => 'Arial-Italic.ttf',
        'bold-italic' => 'Arial-BoldItalic.ttf',
    ];

    public function __invoke(string $face): BinaryFileResponse
    {
        abort_unless(isset(self::FILES[$face]), 404);
        $path = storage_path('app/private/fonts/arial/'.self::FILES[$face]);
        abort_unless(is_file($path) && is_readable($path), 404);

        return response()->file($path, [
            'Content-Type' => 'font/ttf',
            'Cache-Control' => 'private, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ])->setPrivate();
    }
}
