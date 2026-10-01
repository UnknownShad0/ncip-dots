<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentCreationVersion extends Model
{
    protected $fillable = ['draft_id', 'version_number', 'content', 'file_path', 'file_name', 'sha256', 'created_by'];
    protected $casts = ['content' => 'array'];
    public function draft(): BelongsTo { return $this->belongsTo(DocumentCreationDraft::class, 'draft_id'); }
}
