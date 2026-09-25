<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ActionTypeLegacy extends Model
{
    use HasFactory;

    protected $connection = 'legacy';
    protected $table = 'action_type';
    protected $primaryKey = 'dtId';
    public $timestamps = false;

    protected $fillable = [
        'dtId',
        'name',
        'description',
        'createdBy',
        'dateCreated',
        'updatedBy',
        'dateUpdated',
        'status',
    ];

    protected $casts = [
        'dtId' => 'integer',
        'dateCreated' => 'datetime',
        'dateUpdated' => 'datetime',
    ];
}
