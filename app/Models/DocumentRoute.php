<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentRoute extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_id',
        'created_by',
        'from_office_id',
        'parent_step_id',
        'action_type_id',
        'mode',
        'status',
        'other_action',
        'remarks',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function fromOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'from_office_id');
    }

    public function parentStep(): BelongsTo
    {
        return $this->belongsTo(DocumentRouteStep::class, 'parent_step_id');
    }

    public function actionType(): BelongsTo
    {
        return $this->belongsTo(ActionType::class);
    }

    public function steps(): HasMany
    {
        return $this->hasMany(DocumentRouteStep::class)->orderBy('position');
    }
}
