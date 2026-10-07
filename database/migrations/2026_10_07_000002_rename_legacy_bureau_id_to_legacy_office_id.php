<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'legacy_bureau_id') && ! Schema::hasColumn('users', 'legacy_office_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('legacy_bureau_id', 'legacy_office_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'legacy_office_id') && ! Schema::hasColumn('users', 'legacy_bureau_id')) {
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('legacy_office_id', 'legacy_bureau_id');
            });
        }
    }
};
