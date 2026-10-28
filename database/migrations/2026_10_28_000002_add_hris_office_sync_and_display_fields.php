<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('hris_office_syncs')) {
            Schema::create('hris_office_syncs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('started_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('status', 20)->default('running')->index();
                $table->unsignedInteger('records_received')->default(0);
                $table->unsignedInteger('records_created')->default(0);
                $table->unsignedInteger('records_updated')->default(0);
                $table->text('error_summary')->nullable();
                $table->timestamp('started_at');
                $table->timestamp('finished_at')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('office_lists', function (Blueprint $table) {
            if (! Schema::hasColumn('office_lists', 'hris_office_code')) {
                $table->string('hris_office_code', 100)->nullable()->index();
            }
            if (! Schema::hasColumn('office_lists', 'hris_office_name')) {
                $table->string('hris_office_name')->nullable();
            }
            if (! Schema::hasColumn('office_lists', 'last_synced_at')) {
                $table->timestamp('last_synced_at')->nullable();
            }
            if (! Schema::hasColumn('office_lists', 'is_current')) {
                $table->boolean('is_current')->default(false)->index();
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'assigned_office_list_code')) {
                $table->string('assigned_office_list_code', 100)->nullable()->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'assigned_office_list_code')) {
                $table->dropColumn('assigned_office_list_code');
            }
        });

        Schema::table('office_lists', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['hris_office_code', 'hris_office_name', 'last_synced_at', 'is_current'],
                fn (string $column) => Schema::hasColumn('office_lists', $column),
            ));
            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });

        Schema::dropIfExists('hris_office_syncs');
    }
};
