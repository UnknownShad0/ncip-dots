<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_creation_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_type_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('approver_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('official_document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->string('title');
            $table->json('content');
            $table->string('status')->default('draft');
            $table->unsignedInteger('version_number')->default(0);
            $table->string('verified_file_path')->nullable();
            $table->string('verified_file_name')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('verification_notes')->nullable();
            $table->string('verification_result')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('decision_at')->nullable();
            $table->text('decision_remarks')->nullable();
            $table->timestamps();
        });

        Schema::create('document_creation_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('draft_id')->constrained('document_creation_drafts')->cascadeOnDelete();
            $table->unsignedInteger('version_number');
            $table->json('content');
            $table->string('file_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('sha256', 64)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['draft_id', 'version_number']);
        });

        Schema::create('document_creation_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('draft_id')->constrained('document_creation_drafts')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event');
            $table->text('remarks')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_creation_events');
        Schema::dropIfExists('document_creation_versions');
        Schema::dropIfExists('document_creation_drafts');
    }
};
