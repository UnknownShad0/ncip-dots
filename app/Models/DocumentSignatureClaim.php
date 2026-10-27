<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentSignatureClaim extends Model
{
    protected $fillable = [
        'document_id',
        'route_step_id',
        'claimed_by',
        'source_document_file_id',
        'claimed_at',
    ];

    protected function casts(): array
    {
        return ['claimed_at' => 'datetime'];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function routeStep(): BelongsTo
    {
        return $this->belongsTo(DocumentRouteStep::class, 'route_step_id');
    }

    public function claimant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'claimed_by');
    }

    public function sourceFile(): BelongsTo
    {
        return $this->belongsTo(DocumentFile::class, 'source_document_file_id');
    }

    public function canBeReleasedBy(User $user): bool
    {
        if ((int) $this->claimed_by === (int) $user->id || $user->isSuperAdmin()) {
            return true;
        }

        $step = $this->relationLoaded('routeStep') ? $this->getRelation('routeStep') : $this->routeStep()->first();

        return $user->isAdministrator()
            && $step !== null
            && (int) $user->office_id === (int) $step->office_id;
    }
}
