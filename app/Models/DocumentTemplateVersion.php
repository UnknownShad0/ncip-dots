<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentTemplateVersion extends Model
{
    protected $fillable = ['template_key', 'name', 'version', 'layout', 'sample_content', 'is_active'];

    protected $casts = ['layout' => 'array', 'sample_content' => 'array', 'is_active' => 'boolean'];
}
