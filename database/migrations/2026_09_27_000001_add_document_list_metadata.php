<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('origin_type')->nullable()->after('purpose_type_id');
        });

        Schema::table('document_trails', function (Blueprint $table) {
            $table->text('action')->nullable()->after('status');
            $table->foreignId('created_by')->nullable()->after('assigned_to_user_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_trails', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn('action');
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('origin_type');
        });
    }
};
