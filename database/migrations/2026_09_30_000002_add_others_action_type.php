<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('action_types')->whereRaw('LOWER(name) = ?', ['others'])->exists();

        if (!$exists) {
            DB::table('action_types')->insert([
                'name' => 'Others',
                'code' => 'SYSTEM_OTHERS',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $id = DB::table('action_types')->where('code', 'SYSTEM_OTHERS')->value('id');

        if ($id && !DB::table('documents')->where('action_type_id', $id)->exists()) {
            DB::table('action_types')->where('id', $id)->delete();
        }
    }
};