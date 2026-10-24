<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_id',
        'document_trail_id',
        'source_document_file_id',
        'route_step_id',
        'type',
        'signature_method',
        'file_name',
        'original_name',
        'file_path',
        'mime_type',
        'size_bytes',
        'sha256',
        'uploaded_by',
    ];

    protected $casts = ['is_available' => 'boolean'];

    public function downloadUrl(): ?string
    {
        return $this->is_available === false ? null : route('documents.files.download', [
            'document' => $this->document_id,
            'file' => $this->id,
        ], false);
    }

    public function previewUrl(): ?string
    {
        $extension = strtolower(pathinfo((string) ($this->original_name ?: $this->file_name), PATHINFO_EXTENSION));
        if ($this->is_available === false || ! in_array($extension, ['pdf', 'png', 'jpg', 'jpeg'], true)) {
            return null;
        }

        return route('documents.files.view', [
            'document' => $this->document_id,
            'file' => $this->id,
        ], false);
    }

    public function isPdf(): bool
    {
        return strtolower(pathinfo((string) ($this->original_name ?: $this->file_name), PATHINFO_EXTENSION)) === 'pdf';
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function trail(): BelongsTo
    {
        return $this->belongsTo(DocumentTrail::class, 'document_trail_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function sourceFile(): BelongsTo
    {
        return $this->belongsTo(self::class, 'source_document_file_id');
    }

    public function routeStep(): BelongsTo
    {
        return $this->belongsTo(DocumentRouteStep::class, 'route_step_id');
    }
}
