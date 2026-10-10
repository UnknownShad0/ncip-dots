<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentLegacy extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::addGlobalScope('not_migrated', function ($query) {
            if (\Illuminate\Support\Facades\Schema::hasColumn('documents', 'legacy_doc_id')) {
                // Integer literals avoid MySQL's bound-parameter limit on large imports.
                $ids = \Illuminate\Support\Facades\DB::table('documents')->whereNotNull('legacy_doc_id')->pluck('legacy_doc_id')->all();
                if ($ids) $query->whereIntegerNotInRaw('docId', $ids);
            }
        });
    }

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
