<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->boolean('notify_approvers_by_email')->default(false)->after('approver_office_id');
        });
    }

    public function down(): void
    {
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->dropColumn('notify_approvers_by_email');
        });
    }
};
