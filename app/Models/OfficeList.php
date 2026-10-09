<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
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

    public function scopeInRegionCode(Builder $query, string $regionCode): Builder
    {
        $regionCodes = self::regionCodeVariants($regionCode);
        if ($regionCodes === []) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('region_code', $regionCodes);
    }

    public static function regionCodeVariants(string $regionCode): array
    {
        $regionCode = trim($regionCode);
        if ($regionCode === '') {
            return [];
        }

        if (preg_match('/^\d{1,2}$/', $regionCode) === 1) {
            $shortCode = str_pad($regionCode, 2, '0', STR_PAD_LEFT);
            $variants = [$regionCode, $shortCode, $shortCode.'00000000'];
        } elseif (preg_match('/^(\d{2})0{8}$/', $regionCode, $matches) === 1) {
            $variants = [$regionCode, $matches[1]];
        } else {
            $variants = [$regionCode];
        }

        return array_values(array_unique($variants));
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_office_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_office_id');
    }
}
