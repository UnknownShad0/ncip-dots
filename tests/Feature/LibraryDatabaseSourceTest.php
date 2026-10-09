<?php

namespace Tests\Feature;

use App\Http\Controllers\ActionTypeController;
use App\Http\Controllers\DocumentCreationController;
use App\Http\Controllers\DocumentTypeController;
use App\Http\Controllers\PurposeTypeController;
use App\Models\DocumentType;
use App\Support\LegacyDocumentTypeMap;
use Database\Seeders\ActionTypeSeeder;
use Database\Seeders\DocumentTypeSeeder;
use Database\Seeders\PurposeTypeSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LibraryDatabaseSourceTest extends TestCase
{
    public function test_libraries_and_document_creation_use_only_the_new_type_tables(): void
    {
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        // The legacy connection deliberately has no tables, so any legacy type read fails.
        foreach (['document_types', 'action_types', 'purpose_types'] as $table) {
            Schema::create($table, function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('code')->nullable();
                $table->text('description')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        (new DocumentTypeSeeder)->run();
        (new ActionTypeSeeder)->run();
        (new PurposeTypeSeeder)->run();
        $request = Request::create('/');
        $request->headers->set('X-Inertia', 'true');

        foreach ([
            [new DocumentTypeController, 'index', 'documentTypes', 37],
            [new ActionTypeController, 'index', 'actionTypes', 8],
            [new PurposeTypeController, 'purposeTypes', 'purposeTypes', 17],
        ] as [$controller, $method, $key, $count]) {
            $rows = $controller->$method()->toResponse($request)->getData(true)['props'][$key];
            $this->assertCount($count, $rows);
            $this->assertSame(['New DB'], array_values(array_unique(array_column($rows, 'source'))));
        }

        $method = new \ReflectionMethod(DocumentCreationController::class, 'documentTypeOptions');
        $options = $method->invoke(new DocumentCreationController);
        $this->assertCount(37, $options);
        $this->assertSame(['New DB'], array_values(array_unique(array_column($options, 'source'))));
        $this->assertTrue(collect($options)->firstWhere('name', 'Purchase Request')['disabled']);

        // Legacy ID 4 means Letter; the new seeded ID 4 belongs to Purchase Order.
        $this->assertSame('Purchase Order', DocumentType::findOrFail(4)->name);
        $this->assertSame('Letter', LegacyDocumentTypeMap::typesByLegacyId()->get(4)->name);
    }
}
