<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRouteStep extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_route_id',
        'office_id',
        'position',
        'status',
        'dispatch_trail_id',
        'decision_trail_id',
        'received_by',
        'received_at',
        'decision',
        'decision_remarks',
        'decided_by',
        'decided_at',
        'approved_document_file_id',
        'signed_document_file_id',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'received_at' => 'datetime',
            'decided_at' => 'datetime',
        ];
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(DocumentRoute::class, 'document_route_id');
    }

    public function childRoutes(): HasMany
    {
        return $this->hasMany(DocumentRoute::class, 'parent_step_id')->orderBy('id');
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function dispatchTrail(): BelongsTo
    {
        return $this->belongsTo(DocumentTrail::class, 'dispatch_trail_id');
    }

    public function decisionTrail(): BelongsTo
    {
        return $this->belongsTo(DocumentTrail::class, 'decision_trail_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }

    public function approvedFile(): BelongsTo
    {
        return $this->belongsTo(DocumentFile::class, 'approved_document_file_id');
    }

    public function signedFile(): BelongsTo
    {
        return $this->belongsTo(DocumentFile::class, 'signed_document_file_id');
    }
}
