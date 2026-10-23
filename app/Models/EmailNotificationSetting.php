<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailNotificationSetting extends Model
{
    protected $fillable = [
        'automated_enabled',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'automated_enabled' => 'boolean',
            'updated_by' => 'integer',
        ];
    }
}
