<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Services\DashboardCharts;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DashboardChartsTest extends TestCase
{
    public function test_type_counts_include_imported_records_and_respect_scope_and_soft_deletes(): void
    {
        Schema::create('document_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->integer('document_type_id')->nullable();
            $table->integer('legacy_doc_id')->nullable();
            $table->softDeletes();
        });
        DB::table('document_types')->insert(['id' => 42, 'name' => 'Letter']);
        DB::table('documents')->insert([
            ['id' => 1, 'document_type_id' => 42, 'deleted_at' => null],
            ['id' => 2, 'document_type_id' => 42, 'deleted_at' => null],
            ['id' => 3, 'document_type_id' => 42, 'deleted_at' => '2026-10-01'],
            ['id' => 4, 'document_type_id' => null, 'deleted_at' => null],
        ]);
        DB::table('documents')->insert(['id' => 5, 'document_type_id' => 42, 'legacy_doc_id' => 100]);
        $service = app(DashboardCharts::class);
        $documents = Document::query()->whereIn('id', [1, 3, 4, 5]);
        $this->assertSame([
            ['name' => 'Letter', 'count' => 2],
            ['name' => 'Unspecified', 'count' => 1],
        ], $service->documentTypes($documents));
        $this->assertSame(3, $documents->count());
        $this->assertSame([], $service->documentTypes(Document::query()->whereRaw('1 = 0')));
    }
}
