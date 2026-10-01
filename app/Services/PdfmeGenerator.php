<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use RuntimeException;

class PdfmeGenerator
{
    public function generate(array $template, array $inputs): string
    {
        $directory = storage_path('app/private/pdf-runs/'.Str::uuid());
        File::ensureDirectoryExists($directory, 0700, true);
        $templatePath = $directory.DIRECTORY_SEPARATOR.'template.json';
        $inputsPath = $directory.DIRECTORY_SEPARATOR.'inputs.json';
        $outputPath = $directory.DIRECTORY_SEPARATOR.'document.pdf';

        try {
            file_put_contents($templatePath, json_encode($template, JSON_THROW_ON_ERROR));
            file_put_contents($inputsPath, json_encode($inputs, JSON_THROW_ON_ERROR));
            $result = Process::path(base_path())->timeout(60)->run([
                'node', base_path('scripts/generate-pdfme.mjs'), $templatePath, $inputsPath, $outputPath,
            ]);

            if (!$result->successful() || !is_file($outputPath)) {
                throw new RuntimeException('pdfme generation failed: '.$result->errorOutput());
            }

            $pdf = file_get_contents($outputPath);
            if ($pdf === false) {
                throw new RuntimeException('The generated PDF could not be read.');
            }

            return $pdf;
        } finally {
            File::deleteDirectory($directory);
        }
    }
}
