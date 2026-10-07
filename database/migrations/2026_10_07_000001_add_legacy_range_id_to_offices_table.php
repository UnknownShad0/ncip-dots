<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->unsignedBigInteger('legacy_range_id')->nullable()->after('range_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropIndex(['legacy_range_id']);
            $table->dropColumn('legacy_range_id');
        });
    }
};
