<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 50)->nullable()->unique()->after('name');
            $table->string('firstname', 100)->nullable()->after('username');
            $table->string('lastname', 100)->nullable()->after('firstname');
            $table->string('middlename', 100)->nullable()->after('lastname');
            $table->string('extensionname', 100)->nullable()->after('middlename');
            $table->unsignedInteger('role_id')->nullable()->index()->after('role');
            $table->unsignedInteger('legacy_bureau_id')->nullable()->index()->after('office_id');
            $table->boolean('is_locked')->default(false)->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['username']);
            $table->dropIndex(['role_id']);
            $table->dropIndex(['legacy_bureau_id']);
            $table->dropColumn([
                'username', 'firstname', 'lastname', 'middlename', 'extensionname',
                'role_id', 'legacy_bureau_id', 'is_locked',
            ]);
        });
    }
};
