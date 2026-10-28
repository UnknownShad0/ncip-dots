<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrisOfficeMapping extends Model
{
    protected $fillable = [
        'division_code', 'office_id', 'match_method', 'status', 'mapped_by',
        'mapped_at', 'reviewed_by', 'reviewed_at', 'review_note',
    ];

    protected function casts(): array
    {
        return [
            'office_id' => 'integer',
            'mapped_by' => 'integer',
            'reviewed_by' => 'integer',
            'mapped_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function mapper(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mapped_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
