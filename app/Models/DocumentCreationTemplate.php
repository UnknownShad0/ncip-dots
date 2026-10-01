<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentCreationTemplate extends Model
{
    protected $fillable = ['document_type_id', 'name', 'version', 'template_json', 'is_active', 'created_by'];
    protected $casts = ['template_json' => 'array', 'is_active' => 'boolean'];

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }
}
