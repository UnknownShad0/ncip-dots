<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_signature_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('route_step_id')->constrained('document_route_steps')->cascadeOnDelete();
            $table->foreignId('claimed_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('source_document_file_id')->constrained('document_files')->restrictOnDelete();
            $table->timestamp('claimed_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_signature_claims');
    }
};
