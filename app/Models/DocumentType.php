<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'is_active',
        'created_by',
        'default_template_version_id',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function defaultTemplateVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplateVersion::class, 'default_template_version_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }
}
