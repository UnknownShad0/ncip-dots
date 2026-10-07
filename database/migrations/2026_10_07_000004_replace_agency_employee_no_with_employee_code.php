<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'agency_employee_no')) {
            if (Schema::hasColumn('users', 'employee_code')) {
                DB::table('users')
                    ->whereNull('employee_code')
                    ->update(['employee_code' => DB::raw('agency_employee_no')]);

                Schema::table('users', function (Blueprint $table) {
                    $table->dropUnique('users_agency_employee_no_unique');
                    $table->dropColumn('agency_employee_no');
                });
            } else {
                Schema::table('users', function (Blueprint $table) {
                    $table->renameColumn('agency_employee_no', 'employee_code');
                });
            }
        } elseif (! Schema::hasColumn('users', 'employee_code')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('employee_code', 100)->nullable()->unique();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'employee_code') && ! Schema::hasColumn('users', 'agency_employee_no')) {
            Schema::table('users', function (Blueprint $table) {
                $table->renameColumn('employee_code', 'agency_employee_no');
            });
        }
    }
};
