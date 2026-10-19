<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentCreationDraft extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    protected $fillable = ['archived_at', 'document_type_id', 'created_by', 'approver_id', 'approver_office_id', 'notify_approvers_by_email', 'decided_by', 'official_document_id', 'title', 'content', 'status', 'version_number', 'verified_file_path', 'verified_file_name', 'verified_by', 'verified_at', 'verification_notes', 'verification_result', 'submitted_at', 'decision_at', 'decision_remarks'];

    protected $casts = ['archived_at' => 'datetime', 'content' => 'array', 'notify_approvers_by_email' => 'boolean', 'verified_at' => 'datetime', 'submitted_at' => 'datetime', 'decision_at' => 'datetime'];

    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approver_id'); }
    public function approverOffice(): BelongsTo { return $this->belongsTo(Office::class, 'approver_office_id'); }
    public function decisionMaker(): BelongsTo { return $this->belongsTo(User::class, 'decided_by'); }
    public function documentType(): BelongsTo { return $this->belongsTo(DocumentType::class); }
    public function officialDocument(): BelongsTo { return $this->belongsTo(Document::class, 'official_document_id'); }
    public function versions(): HasMany { return $this->hasMany(DocumentCreationVersion::class, 'draft_id'); }
    public function events(): HasMany
    {
        return $this->hasMany(DocumentCreationEvent::class, 'draft_id')
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }
}
