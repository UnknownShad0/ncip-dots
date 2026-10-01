<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentCreationEvent extends Model
{
    protected $fillable = ['draft_id', 'user_id', 'event', 'remarks', 'metadata'];
    protected $casts = ['metadata' => 'array'];
    public function draft(): BelongsTo { return $this->belongsTo(DocumentCreationDraft::class, 'draft_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
