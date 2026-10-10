<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY_IDENTITIES = [
        'ranges' => 'legacy_range_id',
        'offices' => 'legacy_bureau_id',
        'divisions' => 'legacy_division_id',
        'users' => 'legacy_user_uuid',
        'document_types' => 'legacy_type_id',
        'action_types' => 'legacy_type_id',
        'purpose_types' => 'legacy_type_id',
        'documents' => 'legacy_doc_id',
        'document_trails' => 'legacy_doc_trail_id',
        'document_files' => 'legacy_file_id',
    ];

    public function up(): void
    {
        foreach (array_keys(self::LEGACY_IDENTITIES) as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->string('record_source', 32)->default('native');
            });
        }

        foreach (array_slice(self::LEGACY_IDENTITIES, 0, 7, true) as $tableName => $identity) {
            DB::table($tableName)->whereNotNull($identity)->update(['record_source' => 'legacy_unclassified']);
        }

        foreach (['documents' => 'legacy_doc_id', 'document_trails' => 'legacy_doc_trail_id', 'document_files' => 'legacy_file_id'] as $tableName => $identity) {
            DB::table($tableName)->whereNotNull($identity)->update(['record_source' => 'legacy_import']);
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::LEGACY_IDENTITIES) as $tableName) {
            if (DB::table($tableName)->where('record_source', '!=', 'native')->exists()) {
                throw new RuntimeException('Cannot remove record source values; preserve the import provenance.');
            }
        }

        foreach (array_keys(self::LEGACY_IDENTITIES) as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropColumn('record_source');
            });
        }
    }
};
