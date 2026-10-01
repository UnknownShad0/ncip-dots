<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_creation_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_type_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedInteger('version')->default(1);
            $table->json('template_json');
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->foreignId('template_id')->nullable()->after('document_type_id')->constrained('document_creation_templates')->nullOnDelete();
        });

        Schema::table('document_creation_versions', function (Blueprint $table) {
            $table->unsignedInteger('template_version')->default(1)->after('version_number');
            $table->json('template_json')->nullable()->after('content');
        });
    }

    public function down(): void
    {
        Schema::table('document_creation_versions', function (Blueprint $table) {
            $table->dropColumn(['template_version', 'template_json']);
        });
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('template_id');
        });
        Schema::dropIfExists('document_creation_templates');
    }
};
