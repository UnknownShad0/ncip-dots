<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserLegacy extends Model
{
    protected $connection = 'legacy';
    protected $table = 'user';
    protected $primaryKey = 'userUuid';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'userUuid', 'username', 'password', 'firstname', 'lastname', 'middlename',
        'extensionname', 'role', 'emailAddress', 'status', 'isLocked', 'loggedInStatus',
        'loginTries', 'lastLoggedInTime', 'bureauId', 'divisionId', 'officeCode', 'dateCreated',
    ];

    protected $casts = [
        'bureauId' => 'integer',
        'divisionId' => 'integer',
        'lastLoggedInTime' => 'datetime',
        'dateCreated' => 'datetime',
    ];
}
