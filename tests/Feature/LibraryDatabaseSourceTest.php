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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LibraryDatabaseSourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_libraries_and_document_creation_use_only_the_new_type_tables(): void
    {
        Storage::fake('local');
        config(['database.connections.legacy' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('legacy');
        // The legacy connection deliberately has no tables, so any legacy type read fails.

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

        // Migrations create Others before seeding, so its new ID differs from legacy ID 19.
        $others = DocumentType::where('name', 'Others')->firstOrFail();
        $legacyTypes = LegacyDocumentTypeMap::typesByLegacyId();
        $this->assertNotSame(19, $others->id);
        $this->assertSame($others->id, $legacyTypes->get(19)->id);
        $this->assertSame('Letter', $legacyTypes->get(4)->name);
    }
}
