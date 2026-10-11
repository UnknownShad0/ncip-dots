<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->string('legacy_trail_uuid', 100)->nullable()->unique();
            $table->string('legacy_user_uuid', 100)->nullable();
            $table->string('legacy_module', 100)->nullable();
            $table->json('legacy_payload')->nullable();
            $table->string('record_source', 32)->default('native');
            $table->string('action')->nullable()->change();
            $table->index(['created_at', 'id'], 'audit_trails_chronology_index');
        });
    }

    public function down(): void
    {
        if (DB::table('audit_trails')->whereNotNull('legacy_trail_uuid')->orWhereNull('action')->exists()) {
            throw new RuntimeException('Cannot remove imported audit provenance. Restore a reviewed backup instead.');
        }
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->dropUnique(['legacy_trail_uuid']);
            $table->dropIndex('audit_trails_chronology_index');
            $table->dropColumn(['legacy_trail_uuid', 'legacy_user_uuid', 'legacy_module', 'legacy_payload', 'record_source']);
            $table->string('action')->nullable(false)->change();
        });
    }
};
