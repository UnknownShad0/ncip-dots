<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->foreignId('approver_office_id')->nullable()->after('approver_id')->constrained('offices')->nullOnDelete();
            $table->foreignId('decided_by')->nullable()->after('approver_office_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('decided_by');
            $table->dropConstrainedForeignId('approver_office_id');
        });
    }
};
