<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Range extends Model
{
    use HasFactory;

    protected $table = 'ranges';

    protected $fillable = [
        'legacy_range_id',
        'name',
        'description',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'legacy_range_id' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
