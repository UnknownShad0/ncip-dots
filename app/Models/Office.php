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
        'parent_id',
        'range_id',
        'division_code',
        'name',
        'short_name',
        'code',
        'email',
        'location',
        'is_active',
        'directory_source_id',
        'long_name',
        'division_name',
        'office_address',
        'region_code',
        'province_code',
        'municipality_code',
        'status',
        'deleted_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
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

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
