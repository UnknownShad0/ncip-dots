<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentTypeLegacy extends Model
{
    use HasFactory;

    protected $connection = 'legacy';
    protected $table = 'document_type';
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
