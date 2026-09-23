<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'title',
        'tracking_number',
        'document_type_id',
        'action_type_id',
        'purpose_type_id',
        'office_id',
        'division_id',
        'created_by',
        'status',
        'received_from',
        'received_at',
        'is_archived',
        'remarks',
    ];

    protected $casts = [
        'received_at' => 'datetime',
        'is_archived' => 'boolean',
    ];

    public function documentType(): BelongsTo
    {
        return $this->belongsTo(DocumentType::class);
    }

    public function actionType(): BelongsTo
    {
        return $this->belongsTo(ActionType::class);
    }

    public function purposeType(): BelongsTo
    {
        return $this->belongsTo(PurposeType::class);
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function trails(): HasMany
    {
        return $this->hasMany(DocumentTrail::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }
}
