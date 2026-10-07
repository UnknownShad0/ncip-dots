<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('documents', 'other_document_type')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->string('other_document_type')->nullable()->after('document_type_id');
            });
        }

        if (! Schema::hasColumn('documents', 'other_purpose')) {
            Schema::table('documents', function (Blueprint $table) {
                $table->string('other_purpose')->nullable()->after('purpose_type_id');
            });
        }

        $this->addOthersOption('document_types', 'SYSTEM_OTHERS_DOCUMENT_TYPE');
        $this->addOthersOption('purpose_types', 'SYSTEM_OTHERS_PURPOSE');
    }

    public function down(): void
    {
        $columnsToDrop = array_values(array_filter(
            ['other_document_type', 'other_purpose'],
            fn (string $column) => Schema::hasColumn('documents', $column),
        ));

        if ($columnsToDrop !== []) {
            Schema::table('documents', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }

        $this->removeUnusedOthersOption('document_types', 'SYSTEM_OTHERS_DOCUMENT_TYPE', 'document_type_id');
        $this->removeUnusedOthersOption('purpose_types', 'SYSTEM_OTHERS_PURPOSE', 'purpose_type_id');
    }

    private function addOthersOption(string $table, string $code): void
    {
        if (DB::table($table)->whereRaw('LOWER(name) = ?', ['others'])->exists()) {
            return;
        }

        DB::table($table)->insert([
            'name' => 'Others',
            'code' => $code,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function removeUnusedOthersOption(string $table, string $code, string $foreignKey): void
    {
        $id = DB::table($table)->where('code', $code)->value('id');

        if ($id && !DB::table('documents')->where($foreignKey, $id)->exists()) {
            DB::table($table)->where('id', $id)->delete();
        }
    }
};
