<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_files', function (Blueprint $table) {
            $table->foreignId('document_trail_id')->nullable()->after('document_id')->constrained('document_trails')->nullOnDelete();
            $table->string('type')->default('original')->after('document_trail_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('document_files', function (Blueprint $table) {
            $table->dropForeign(['document_trail_id']);
            $table->dropIndex(['type']);
            $table->dropColumn(['document_trail_id', 'type']);
        });
    }
};
