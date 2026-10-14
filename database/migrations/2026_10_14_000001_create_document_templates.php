<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_assets', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('kind', 30)->default('logo');
            $table->string('path')->unique();
            $table->string('mime_type', 50);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
        Schema::create('document_template_versions', function (Blueprint $table) {
            $table->id();
            $table->string('template_key', 100);
            $table->string('name');
            $table->unsignedInteger('version')->default(1);
            $table->json('layout');
            $table->json('sample_content')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['template_key', 'version']);
        });
        Schema::table('document_types', function (Blueprint $table) {
            $table->foreignId('default_template_version_id')->nullable()
                ->constrained('document_template_versions')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_types', function (Blueprint $table) {
            $table->dropConstrainedForeignId('default_template_version_id');
        });
        Schema::dropIfExists('document_template_versions');
        Schema::dropIfExists('document_assets');
    }
};
