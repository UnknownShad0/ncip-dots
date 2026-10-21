<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hris_employees', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hris_employee_id')->nullable()->index();
            $table->string('employee_code', 100)->unique();
            $table->string('username', 100)->nullable()->index();
            $table->string('email_address')->nullable();
            $table->string('first_name', 100)->nullable()->index();
            $table->string('middle_name', 100)->nullable();
            $table->string('last_name', 100)->nullable()->index();
            $table->string('ext_name', 50)->nullable();
            $table->string('division_code', 100)->nullable()->index();
            $table->string('division')->nullable();
            $table->string('position')->nullable();
            $table->string('designation')->nullable();
            $table->string('employment_status', 100)->nullable()->index();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('signatory_name')->nullable();
            $table->string('signatory_designation')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hris_employees');
    }
};
