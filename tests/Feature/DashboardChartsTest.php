<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentLegacy;
use App\Services\DashboardCharts;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DashboardChartsTest extends TestCase
{
    public function test_type_counts_respect_scope_soft_deletes_and_legacy_id_mapping(): void
    {
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        Schema::create('document_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->integer('document_type_id')->nullable();
            $table->softDeletes();
        });
        Schema::connection('legacy')->create('document', function (Blueprint $table) {
            $table->integer('docId');
            $table->integer('dtId');
        });
        DB::table('document_types')->insert(['id' => 42, 'name' => 'Letter']);
        DB::table('documents')->insert([
            ['id' => 1, 'document_type_id' => 42, 'deleted_at' => null],
            ['id' => 2, 'document_type_id' => 42, 'deleted_at' => null],
            ['id' => 3, 'document_type_id' => 42, 'deleted_at' => '2026-10-01'],
            ['id' => 4, 'document_type_id' => null, 'deleted_at' => null],
        ]);
        DB::connection('legacy')->table('document')->insert([
            ['docId' => 1, 'dtId' => 4],
            ['docId' => 2, 'dtId' => 4],
        ]);
        $service = app(DashboardCharts::class);
        $documents = Document::query()->whereIn('id', [1, 3, 4]);
        $legacy = DocumentLegacy::query()->where('docId', 1);
        $this->assertSame([
            ['name' => 'Letter', 'count' => 2],
            ['name' => 'Unspecified', 'count' => 1],
        ], $service->documentTypes($documents, $legacy));
        $this->assertSame(2, $documents->count());
        $this->assertSame(1, $legacy->count());
        $this->assertSame([], $service->documentTypes(Document::query()->whereRaw('1 = 0'), DocumentLegacy::query()->whereRaw('1 = 0')));
    }
}
