<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentAsset extends Model
{
    protected $fillable = ['name', 'kind', 'path', 'mime_type', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
