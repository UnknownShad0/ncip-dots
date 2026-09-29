<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('offices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->foreignId('range_id')->nullable();
            $table->string('name');
            $table->string('short_name')->nullable();
            $table->string('code')->nullable();
            $table->string('email')->nullable();
            $table->string('location')->nullable();
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('offices');
    }
};
