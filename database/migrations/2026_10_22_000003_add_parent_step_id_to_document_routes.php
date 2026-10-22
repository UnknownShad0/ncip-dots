<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_routes', function (Blueprint $table) {
            $table->foreignId('parent_step_id')
                ->nullable()
                ->after('from_office_id')
                ->constrained('document_route_steps')
                ->nullOnDelete();
            $table->index(['parent_step_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('document_routes', function (Blueprint $table) {
            $table->dropIndex(['parent_step_id', 'status']);
            $table->dropConstrainedForeignId('parent_step_id');
        });
    }
};
