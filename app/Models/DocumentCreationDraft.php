<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentCreationDraft extends Model
{
    protected $fillable = ['document_type_id', 'created_by', 'approver_id', 'official_document_id', 'title', 'content', 'status', 'version_number', 'verified_file_path', 'verified_file_name', 'verified_by', 'verified_at', 'verification_notes', 'verification_result', 'submitted_at', 'decision_at', 'decision_remarks'];

    protected $casts = ['content' => 'array', 'verified_at' => 'datetime', 'submitted_at' => 'datetime', 'decision_at' => 'datetime'];

    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approver_id'); }
    public function documentType(): BelongsTo { return $this->belongsTo(DocumentType::class); }
    public function officialDocument(): BelongsTo { return $this->belongsTo(Document::class, 'official_document_id'); }
    public function versions(): HasMany { return $this->hasMany(DocumentCreationVersion::class, 'draft_id'); }
    public function events(): HasMany { return $this->hasMany(DocumentCreationEvent::class, 'draft_id'); }
}
