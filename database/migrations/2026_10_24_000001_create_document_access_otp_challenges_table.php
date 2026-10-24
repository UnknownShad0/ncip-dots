<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_access_otp_challenges', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('document_route_step_id')->constrained('document_route_steps')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('office_id')->constrained()->cascadeOnDelete();
            $table->char('email_hash', 64);
            $table->char('code_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('sent_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('invalidated_at')->nullable();
            $table->char('request_ip_hash', 64)->nullable();
            $table->timestamps();

            $table->index(['document_id', 'user_id']);
            $table->index(['expires_at', 'invalidated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_access_otp_challenges');
    }
};
