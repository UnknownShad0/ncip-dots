<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentLegacy extends Model
{
    use HasFactory;

    protected $connection = 'legacy';
    protected $table = 'document';
    protected $primaryKey = 'docId';
    public $timestamps = false;

    protected $fillable = [
        'docId',
        'trackingNo',
        'dtId',
        'otherDtype',
        'purpose',
        'originType',
        'title',
        'remarks',
        'urgent',
        'forNotification',
        'isFinalized',
        'Archived',
        'createdBy',
        'dateCreated',
        'status',
    ];

    protected $casts = [
        'docId' => 'integer',
        'dateCreated' => 'datetime',
    ];
}
