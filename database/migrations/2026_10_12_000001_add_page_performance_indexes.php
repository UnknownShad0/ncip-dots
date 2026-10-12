<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_trails', function (Blueprint $table) {
            $table->index(['document_id', 'id'], 'document_trails_document_id_id_index');
            $table->index(['to_office_id', 'status', 'document_id'], 'document_trails_to_status_document_index');
            $table->index(['from_office_id', 'status', 'document_id'], 'document_trails_from_status_document_index');
            $table->index(['holder_office_id', 'document_id'], 'document_trails_holder_document_index');
            $table->index(['legacy_receiving_office_id', 'document_id'], 'document_trails_legacy_receiving_document_index');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->index(['is_archived', 'created_at', 'id'], 'documents_archive_created_index');
            $table->index(['office_id', 'is_archived', 'created_at', 'id'], 'documents_office_archive_created_index');
        });

        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->index(['approver_id', 'status'], 'drafts_approver_status_index');
            $table->index(['created_by', 'status'], 'drafts_creator_status_index');
        });

        Schema::table('document_creation_events', function (Blueprint $table) {
            $table->index(['draft_id', 'id'], 'draft_events_draft_id_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('document_creation_events', function (Blueprint $table) {
            $table->dropIndex('draft_events_draft_id_id_index');
        });

        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->dropIndex('drafts_approver_status_index');
            $table->dropIndex('drafts_creator_status_index');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropIndex('documents_archive_created_index');
            $table->dropIndex('documents_office_archive_created_index');
        });

        Schema::table('document_trails', function (Blueprint $table) {
            $table->dropIndex('document_trails_document_id_id_index');
            $table->dropIndex('document_trails_to_status_document_index');
            $table->dropIndex('document_trails_from_status_document_index');
            $table->dropIndex('document_trails_holder_document_index');
            $table->dropIndex('document_trails_legacy_receiving_document_index');
        });
    }
};
