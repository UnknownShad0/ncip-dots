<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('role_navigation_visibility', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('role_id');
            $table->string('navigation_key', 64);
            $table->boolean('is_visible');
            $table->timestamps();

            $table->unique(['role_id', 'navigation_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('role_navigation_visibility');
    }
};
