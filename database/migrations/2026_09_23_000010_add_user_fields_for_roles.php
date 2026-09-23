<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role')->default('user')->after('email');
            $table->foreignId('office_id')->nullable()->after('role')->constrained()->nullOnDelete();
            $table->foreignId('division_id')->nullable()->after('office_id')->constrained()->nullOnDelete();
            $table->boolean('is_active')->default(true)->after('division_id');
            $table->timestamp('last_login_at')->nullable()->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('office_id');
            $table->dropConstrainedForeignId('division_id');
            $table->dropColumn(['role', 'is_active', 'last_login_at']);
        });
    }
};
