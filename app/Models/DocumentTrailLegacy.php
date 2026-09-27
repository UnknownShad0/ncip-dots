<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentTrailLegacy extends Model
{
    protected $connection = 'legacy';
    protected $table = 'document_trail';
    protected $primaryKey = 'docTrailId';
    public $timestamps = false;

    protected $casts = [
        'docTrailId' => 'integer',
        'originating' => 'integer',
        'holder' => 'integer',
        'receiving' => 'integer',
        'initialRelease' => 'integer',
        'dateCreated' => 'datetime',
    ];
}
