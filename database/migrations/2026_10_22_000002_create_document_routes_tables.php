<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('from_office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->foreignId('action_type_id')->nullable()->constrained('action_types')->nullOnDelete();
            $table->string('mode', 20);
            $table->string('status', 30)->default('pending');
            $table->string('other_action')->nullable();
            $table->string('remarks', 250)->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['document_id', 'id']);
            $table->index(['from_office_id', 'status']);
        });

        Schema::create('document_route_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_route_id')->constrained('document_routes')->cascadeOnDelete();
            $table->foreignId('office_id')->constrained('offices')->restrictOnDelete();
            $table->unsignedInteger('position');
            $table->string('status', 30)->default('waiting');
            $table->foreignId('dispatch_trail_id')->nullable()->constrained('document_trails')->nullOnDelete();
            $table->foreignId('decision_trail_id')->nullable()->constrained('document_trails')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('received_at')->nullable();
            $table->string('decision', 30)->nullable();
            $table->text('decision_remarks')->nullable();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();

            $table->unique(['document_route_id', 'office_id']);
            $table->unique(['document_route_id', 'position']);
            $table->index(['office_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_route_steps');
        Schema::dropIfExists('document_routes');
    }
};
