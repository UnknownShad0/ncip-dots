<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->renameNavigationKey('gmail_notifications', 'email_notifications');
    }

    public function down(): void
    {
        $this->renameNavigationKey('email_notifications', 'gmail_notifications');
    }

    private function renameNavigationKey(string $from, string $to): void
    {
        if (! Schema::hasTable('role_navigation_visibility')) {
            return;
        }

        DB::table('role_navigation_visibility')
            ->where('navigation_key', $from)
            ->orderBy('id')
            ->get()
            ->each(function (object $row) use ($from, $to): void {
                $targetExists = DB::table('role_navigation_visibility')
                    ->where('role_id', $row->role_id)
                    ->where('navigation_key', $to)
                    ->exists();

                if ($targetExists) {
                    DB::table('role_navigation_visibility')->where('id', $row->id)->delete();

                    return;
                }

                DB::table('role_navigation_visibility')
                    ->where('id', $row->id)
                    ->where('navigation_key', $from)
                    ->update(['navigation_key' => $to]);
            });
    }
};
