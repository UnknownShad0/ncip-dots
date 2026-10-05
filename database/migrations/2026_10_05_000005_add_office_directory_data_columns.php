<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->unsignedBigInteger('directory_source_id')->nullable()->unique();
            $table->string('long_name')->nullable();
            $table->string('office_address')->nullable();
            $table->string('region_code')->nullable();
            $table->string('province_code')->nullable();
            $table->string('municipality_code')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::table('divisions', function (Blueprint $table) {
            $table->unsignedBigInteger('directory_source_id')->nullable()->unique();
            $table->string('long_name')->nullable();
            $table->string('office_address')->nullable();
            $table->string('region_code')->nullable();
            $table->string('province_code')->nullable();
            $table->string('municipality_code')->nullable();
            $table->string('short_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->unsignedBigInteger('office_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('divisions', function (Blueprint $table) {
            $table->dropUnique(['directory_source_id']);
            $table->dropColumn([
                'directory_source_id', 'long_name', 'office_address', 'region_code',
                'province_code', 'municipality_code', 'short_name', 'email', 'status', 'deleted_at',
            ]);
            $table->unsignedBigInteger('office_id')->nullable(false)->change();
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->dropUnique(['directory_source_id']);
            $table->dropColumn([
                'directory_source_id', 'long_name', 'office_address', 'region_code',
                'province_code', 'municipality_code', 'status', 'deleted_at',
            ]);
        });
    }
};
