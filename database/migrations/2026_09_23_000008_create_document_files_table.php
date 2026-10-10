<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->string('file_name');
            $table->string('original_name');
            $table->string('file_path');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // $legacySchema = Schema::connection('legacy');

        // if (!$legacySchema->hasTable('file')) {
        //     $legacySchema->create('file', function (Blueprint $table) {
        //         $table->increments('fileId');
        //         $table->unsignedInteger('docId')->nullable()->index();
        //         $table->unsignedInteger('docTrailId')->nullable();
        //         $table->string('fileName', 100);
        //         $table->string('origName', 100);
        //         $table->string('filePath', 250)->nullable();
        //         $table->string('attachmentFileName', 100)->nullable();
        //         $table->string('attachmentOrigName', 100)->nullable();
        //         $table->string('attachmentPath', 100)->nullable();
        //         $table->enum('type', ['original', 'version', 'terminal'])->nullable();
        //         $table->string('uploadedBy', 100)->nullable();
        //         $table->dateTime('dateUploaded')->nullable();
        //     });
        // }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_files');

        // Preserve the legacy table and its data when rolling back the new app schema.
    }
};
