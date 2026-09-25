<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BureauLegacy extends Model
{
    use HasFactory;

    protected $connection = 'legacy';
    protected $table = 'bureau';
    protected $primaryKey = 'bureauId';
    public $timestamps = false;

    protected $fillable = [
        'bureauId',
        'parentbureauId',
        'officeCode',
        'officeEmail',
        'longName',
        'shortName',
        'status',
        'range',
        'dateAdded',
        'addedBy',
    ];

    protected $casts = [
        'bureauId' => 'integer',
        'parentbureauId' => 'integer',
        'dateAdded' => 'datetime',
    ];
}
