<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrisOfficeSync extends Model
{
    protected $fillable = [
        'started_by', 'status', 'records_received', 'records_created',
        'records_updated', 'error_summary', 'started_at', 'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'records_received' => 'integer',
            'records_created' => 'integer',
            'records_updated' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }
}
