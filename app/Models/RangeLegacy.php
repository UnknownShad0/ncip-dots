<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RangeLegacy extends Model
{
    use HasFactory;

    protected $connection = 'legacy';
    protected $table = 'rangeregion';
    public $timestamps = false;

    protected $fillable = [
        'id',
        'name',
        'status',
    ];
}
