<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->string('actor_name')->nullable()->after('user_id');
            $table->unsignedBigInteger('actor_office_id')->nullable()->after('actor_name');
            $table->string('actor_office_name')->nullable()->after('actor_office_id');
            $table->string('result', 16)->nullable()->after('details');
            $table->index(['actor_office_id', 'created_at', 'id'], 'audit_trails_actor_office_chronology_index');
        });
    }

    public function down(): void
    {
        Schema::table('audit_trails', function (Blueprint $table) {
            $table->dropIndex('audit_trails_actor_office_chronology_index');
            $table->dropColumn(['actor_name', 'actor_office_id', 'actor_office_name', 'result']);
        });
    }
};
