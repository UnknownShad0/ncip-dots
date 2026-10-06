<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The SQL dump may have already created this table.
        if (Schema::hasTable('office_lists')) {
            return;
        }

        Schema::create('office_lists', function (Blueprint $table) {
            $table->id();
            $table->string('division_code')->unique();
            $table->string('division_name');
            $table->string('long_name')->nullable();
            $table->string('office_address')->nullable();
            $table->string('region_code')->nullable();
            $table->string('province_code')->nullable();
            $table->string('municipality_code')->nullable();
            $table->string('short_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->nullable();
            $table->unsignedBigInteger('parent_office_id')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('office_lists');
    }
};
