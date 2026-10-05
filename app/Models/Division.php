<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Division extends Model
{
    use HasFactory;

    protected $fillable = [
        'office_id',
        'name',
        'code',
        'directory_source_id',
        'long_name',
        'division_name',
        'office_address',
        'region_code',
        'province_code',
        'municipality_code',
        'short_name',
        'email',
        'status',
        'deleted_at',
    ];

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
