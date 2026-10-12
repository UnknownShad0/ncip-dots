<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_trails', function (Blueprint $table) {
            $table->index(['status', 'document_id'], 'document_trails_status_document_index');
        });
    }

    public function down(): void
    {
        Schema::table('document_trails', function (Blueprint $table) {
            $table->dropIndex('document_trails_status_document_index');
        });
    }
};
