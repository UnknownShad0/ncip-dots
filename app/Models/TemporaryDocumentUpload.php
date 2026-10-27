<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TemporaryDocumentUpload extends Model
{
    protected $fillable = [
        'token', 'user_id', 'document_id', 'purpose', 'file_path', 'original_name', 'mime_type', 'size_bytes', 'expires_at',
    ];

    protected $casts = ['expires_at' => 'datetime'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
