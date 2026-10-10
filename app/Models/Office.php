<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Office extends Model
{
    use HasFactory;

    protected $fillable = [
        'legacy_bureau_id',
        'parent_id',
        'range_id',
        'legacy_range_id',
        'name',
        'short_name',
        'code',
        'email',
        'location',
    ];

    protected $casts = [
        'legacy_bureau_id' => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function range(): BelongsTo
    {
        return $this->belongsTo(Range::class);
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function divisions(): HasMany
    {
        return $this->hasMany(Division::class);
    }
//
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
