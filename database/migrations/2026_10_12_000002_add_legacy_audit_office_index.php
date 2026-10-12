<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->index(
                ['record_source', 'actor_office_id', 'user_id', 'created_at', 'id'],
                'audit_trails_legacy_office_user_chronology_index',
            );
        });
    }

    public function down(): void
    {
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->dropIndex('audit_trails_legacy_office_user_chronology_index');
        });
    }
};
