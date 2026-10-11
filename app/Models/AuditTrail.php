<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditTrail extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'actor_name',
        'actor_office_id',
        'actor_office_name',
        'action',
        'model_type',
        'model_id',
        'details',
        'result',
        'ip_address',
        'user_agent',
    ];

    protected $hidden = ['legacy_payload'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
