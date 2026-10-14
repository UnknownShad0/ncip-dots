<?php

namespace App\Services;

use App\Models\DocumentAsset;
use App\Models\DocumentTemplateVersion;
use App\Models\DocumentType;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class DocumentTemplates
{
    private ?array $default = null;
    public function import(string $file, string $name, string $kind = 'logo'): DocumentAsset
    {
        $this->check(in_array($kind, ['logo', 'full_header', 'footer'], true), 'Invalid asset kind.');
        $this->check(is_file($file) && filesize($file) <= 2 * 1024 * 1024, 'Choose a PNG or JPEG no larger than 2 MB.');
        $bytes = file_get_contents($file);
        $info = @getimagesizefromstring($bytes);
        $mime = $info['mime'] ?? '';
        $this->check(in_array($mime, ['image/png', 'image/jpeg'], true), 'Only PNG and JPEG images are supported.');
        $this->check(($info[0] ?? 0) <= 6000 && ($info[1] ?? 0) <= 6000, 'Images must be at most 6000 × 6000 pixels.');
        $path = 'document-assets/'.hash('sha256', $bytes).($mime === 'image/png' ? '.png' : '.jpg');
        if (! Storage::disk('local')->exists($path)) {
            $this->check(Storage::disk('local')->put($path, $bytes), 'Could not store the document image.');
        }

        return DocumentAsset::firstOrCreate(['path' => $path], ['name' => $name, 'kind' => $kind, 'mime_type' => $mime, 'is_active' => true]);
    }

    public function defaultSnapshot(): array
    {
        if ($this->default !== null) return $this->default;

        return $this->default = [
            'version_id' => null, 'name' => 'NCIP Standard', 'version' => 1,
            'header_mode' => 'image', 'header_text' => [], 'repeat_header' => false,
            'header_images' => [$this->asset($this->import(public_path('images/header.png'), 'NCIP Standard header', 'full_header'))],
            'footer_seal' => $this->asset($this->import(public_path('images/bagong-pilipinas.png'), 'Bagong Pilipinas', 'footer')),
            'footer_tagline' => $this->asset($this->import(public_path('images/ncip-footer.png'), 'NCIP tagline', 'footer')),
        ];
    }

    public function forType(DocumentType $type): array
    {
        $template = $type->defaultTemplateVersion;
        if (! $template) {
            return ['snapshot' => $this->defaultSnapshot(), 'sample_content' => null];
        }
        $this->check($template->is_active, 'The assigned document template is inactive. Ask an administrator to update the document type.');

        return ['snapshot' => $this->snapshot($template), 'sample_content' => $template->sample_content];
    }

    public function snapshot(DocumentTemplateVersion $template): array
    {
        $layout = $template->layout;
        $mode = $layout['header_mode'] ?? 'image';
        $this->check(in_array($mode, ['image', 'logos'], true), 'Invalid header mode.');
        $ids = $layout['header_asset_ids'] ?? [];
        $this->check(is_array($ids) && count($ids) >= 1 && count($ids) <= ($mode === 'image' ? 1 : 2), 'Assign one header image or one to two logos.');
        $images = [];
        foreach ($ids as $id) {
            $asset = DocumentAsset::find($id);
            $this->check($asset && $asset->is_active, 'An assigned header image is missing or inactive.');
            $images[] = $this->asset($asset);
        }
        $lines = $layout['header_text'] ?? [];
        $this->check(is_array($lines) && count($lines) <= 3, 'Use at most three header text lines.');
        foreach ($lines as $line) {
            $this->check(is_string($line) && mb_strlen($line) <= 120, 'Header lines must be at most 120 characters.');
        }
        $base = $this->defaultSnapshot();

        return [...$base, 'version_id' => $template->id, 'name' => $template->name, 'version' => $template->version,
            'header_mode' => $mode, 'header_images' => $images, 'header_text' => $lines,
            'repeat_header' => (bool) ($layout['repeat_header'] ?? false)];
    }

    private function asset(DocumentAsset $asset): array
    {
        $image = ['path' => $asset->path, 'alt' => $asset->name, 'mime_type' => $asset->mime_type];
        $this->imageBytes($image);

        return $image;
    }

    public function imageBytes(array $asset): string
    {
        $path = $asset['path'] ?? '';
        $this->check((bool) preg_match('~^document-assets/([a-f0-9]{64})\.(png|jpg)$~D', $path, $match), 'Invalid document image path.');
        $bytes = Storage::disk('local')->get($path);
        $this->check(is_string($bytes) && hash('sha256', $bytes) === $match[1], 'A document image is missing or has changed. Restore the original file before exporting.');

        return $bytes;
    }

    public function presentation(array $snapshot, bool $pdf = false): array
    {
        $image = function (array $asset) use ($pdf): array {
            $bytes = $this->imageBytes($asset);

            return ['alt' => $asset['alt'], 'src' => $pdf
                ? 'data:'.$asset['mime_type'].';base64,'.base64_encode($bytes)
                : route('document-assets.show', ['filename' => basename($asset['path'])], false)];
        };

        return [...$snapshot, 'header_images' => array_map($image, $snapshot['header_images']),
            'footer_seal' => $image($snapshot['footer_seal']), 'footer_tagline' => $image($snapshot['footer_tagline'])];
    }

    public function presentContent(array $content): array
    {
        if (isset($content['template_snapshot'])) {
            $content['template'] = $this->presentation($content['template_snapshot']);
        }

        return $content;
    }

    public function show(string $filename)
    {
        abort_unless(preg_match('/^[a-f0-9]{64}\.(png|jpg)$/D', $filename), 404);
        $path = 'document-assets/'.$filename;
        abort_unless(Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), ['Cache-Control' => 'private, max-age=31536000, immutable']);
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['content.template' => $message]);
        }
    }
}
