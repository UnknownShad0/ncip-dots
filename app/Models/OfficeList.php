<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class OfficeList extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'division_code', 'division_name', 'long_name', 'office_address',
        'region_code', 'province_code', 'municipality_code', 'short_name',
        'email', 'status', 'parent_office_id',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_office_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_office_id');
    }
}
