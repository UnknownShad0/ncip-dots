<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DivisionLegacy extends Model
{
    protected $connection = 'legacy';
    protected $table = 'division';
    protected $primaryKey = 'divisionId';
    public $timestamps = false;
}
