<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Keep this migration safe when the column was added manually or by a
        // partially completed deployment before the migration was recorded.
        if (Schema::hasColumn('documents', 'other_action')) {
            return;
        }

        Schema::table('documents', function (Blueprint $table) {
            $table->string('other_action')->nullable()->after('action_type_id');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('documents', 'other_action')) {
            return;
        }

        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('other_action');
        });
    }
};
