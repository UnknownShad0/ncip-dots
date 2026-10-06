<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'agency_employee_no')) {
                $table->string('agency_employee_no', 100)->nullable()->unique();
            }
            if (! Schema::hasColumn('users', 'division_code')) {
                $table->string('division_code', 100)->nullable();
            }
            if (! Schema::hasColumn('users', 'division')) {
                $table->string('division')->nullable();
            }
            if (! Schema::hasColumn('users', 'region_code')) {
                $table->string('region_code', 100)->nullable();
            }
            if (! Schema::hasColumn('users', 'office_code')) {
                $table->string('office_code', 100)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['agency_employee_no']);
            $table->dropIndex(['office_code']);
            $table->dropColumn(['agency_employee_no', 'division_code', 'division', 'region_code', 'office_code']);
        });
    }
};
