<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable()->index();
            $table->softDeletes();
        });
        Schema::table('documents', function (Blueprint $table) {
            $table->timestamp('archived_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('document_creation_drafts', function (Blueprint $table) {
            $table->dropColumn(['archived_at', 'deleted_at']);
        });
        Schema::table('documents', fn (Blueprint $table) => $table->dropColumn('archived_at'));
    }
};
