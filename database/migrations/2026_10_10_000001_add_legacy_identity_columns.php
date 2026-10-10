<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ranges', function (Blueprint $table) {
            $table->unsignedInteger('legacy_range_id')->nullable()->unique();
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->unsignedInteger('legacy_bureau_id')->nullable()->unique();
        });

        Schema::table('divisions', function (Blueprint $table) {
            $table->unsignedInteger('legacy_division_id')->nullable()->unique();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('legacy_user_uuid', 100)->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['legacy_user_uuid']);
            $table->dropColumn('legacy_user_uuid');
        });

        Schema::table('divisions', function (Blueprint $table) {
            $table->dropUnique(['legacy_division_id']);
            $table->dropColumn('legacy_division_id');
        });

        Schema::table('offices', function (Blueprint $table) {
            $table->dropUnique(['legacy_bureau_id']);
            $table->dropColumn('legacy_bureau_id');
        });

        Schema::table('ranges', function (Blueprint $table) {
            $table->dropUnique(['legacy_range_id']);
            $table->dropColumn('legacy_range_id');
        });
    }
};
