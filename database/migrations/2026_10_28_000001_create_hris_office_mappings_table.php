<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('hris_office_mappings')) {
            return;
        }

        Schema::create('hris_office_mappings', function (Blueprint $table) {
            $table->id();
            $table->string('division_code', 100)->unique();
            $table->foreignId('office_id')->constrained('offices')->restrictOnDelete();
            $table->string('match_method', 40)->default('manual');
            $table->string('status', 30)->default('pending_review')->index();
            $table->foreignId('mapped_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('mapped_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hris_office_mappings');
    }
};
