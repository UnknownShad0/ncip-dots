<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_files', function (Blueprint $table) {
            $table->foreignId('source_document_file_id')->nullable()->after('document_trail_id')->constrained('document_files')->nullOnDelete();
            $table->foreignId('route_step_id')->nullable()->after('source_document_file_id')->constrained('document_route_steps')->nullOnDelete();
            $table->string('signature_method', 30)->nullable()->after('type');
            $table->char('sha256', 64)->nullable()->after('size_bytes')->index();
        });

        Schema::table('document_route_steps', function (Blueprint $table) {
            $table->foreignId('approved_document_file_id')->nullable()->constrained('document_files')->nullOnDelete();
            $table->foreignId('signed_document_file_id')->nullable()->constrained('document_files')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_route_steps', function (Blueprint $table) {
            $table->dropForeign(['approved_document_file_id']);
            $table->dropForeign(['signed_document_file_id']);
            $table->dropColumn(['approved_document_file_id', 'signed_document_file_id']);
        });

        Schema::table('document_files', function (Blueprint $table) {
            $table->dropForeign(['source_document_file_id']);
            $table->dropForeign(['route_step_id']);
            $table->dropIndex(['sha256']);
            $table->dropColumn(['source_document_file_id', 'route_step_id', 'signature_method', 'sha256']);
        });
    }
};
