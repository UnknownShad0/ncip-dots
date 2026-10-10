<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['document_types', 'action_types', 'purpose_types'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->unsignedInteger('legacy_type_id')->nullable()->unique();
                $table->json('legacy_payload')->nullable();
            });
        }
        Schema::table('documents', function (Blueprint $table) {
            $table->unsignedInteger('legacy_doc_id')->nullable()->unique();
            $table->json('legacy_payload')->nullable();
            $table->boolean('legacy_needs_review')->default(false)->index();
            $table->string('title', 500)->nullable()->change();
            $table->string('tracking_number')->nullable()->change();
        });
        Schema::table('document_trails', function (Blueprint $table) {
            $table->unsignedInteger('legacy_doc_trail_id')->nullable()->unique();
            $table->json('legacy_payload')->nullable();
            $table->foreignId('holder_office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->foreignId('legacy_receiving_office_id')->nullable()->constrained('offices')->nullOnDelete();
        });
        Schema::table('document_files', function (Blueprint $table) {
            $table->unsignedInteger('legacy_file_id')->nullable()->unique();
            $table->json('legacy_payload')->nullable();
            $table->boolean('is_available')->default(true);
        });
        Schema::create('legacy_document_exceptions', function (Blueprint $table) {
            $table->id();
            $table->string('source_table', 50);
            $table->unsignedInteger('source_id');
            $table->string('reason');
            $table->json('payload');
            $table->timestamps();
            $table->unique(['source_table', 'source_id']);
        });
    }

    public function down(): void
    {
        // Refuse a rollback that would erase provenance or truncate imported titles.
        if (DB::table('documents')->whereNotNull('legacy_doc_id')->exists()
            || DB::table('document_trails')->whereNotNull('legacy_doc_trail_id')->exists()
            || DB::table('document_files')->whereNotNull('legacy_file_id')->exists()
            || DB::table('legacy_document_exceptions')->exists()
            || DB::table('documents')->whereNull('title')->orWhereNull('tracking_number')->orWhereRaw('LENGTH(title) > 255')->exists()) {
            throw new RuntimeException('Restore a reviewed backup instead: rollback would lose imported document data.');
        }
        foreach (['document_types', 'action_types', 'purpose_types'] as $name) {
            if (DB::table($name)->whereNotNull('legacy_type_id')->exists()) {
                throw new RuntimeException('Cannot remove imported lookup identities.');
            }
        }
        Schema::dropIfExists('legacy_document_exceptions');
        Schema::table('document_files', function (Blueprint $table) {
            $table->dropUnique(['legacy_file_id']);
            $table->dropColumn(['legacy_file_id', 'legacy_payload', 'is_available']);
        });
        Schema::table('document_trails', function (Blueprint $table) {
            $table->dropConstrainedForeignId('holder_office_id');
            $table->dropConstrainedForeignId('legacy_receiving_office_id');
            $table->dropUnique(['legacy_doc_trail_id']);
            $table->dropColumn(['legacy_doc_trail_id', 'legacy_payload']);
        });
        Schema::table('documents', function (Blueprint $table) {
            $table->dropUnique(['legacy_doc_id']);
            $table->dropIndex(['legacy_needs_review']);
            $table->dropColumn(['legacy_doc_id', 'legacy_payload', 'legacy_needs_review']);
            $table->string('title')->nullable(false)->change();
            $table->string('tracking_number')->nullable(false)->change();
        });
        foreach (['document_types', 'action_types', 'purpose_types'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropUnique(['legacy_type_id']);
                $table->dropColumn(['legacy_type_id', 'legacy_payload']);
            });
        }
    }
};
