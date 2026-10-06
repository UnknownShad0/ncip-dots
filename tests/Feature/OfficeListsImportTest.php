<?php

namespace Tests\Feature;

use App\Models\OfficeList;
use Database\Seeders\OfficeListsSqlSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class OfficeListsImportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        (require database_path('migrations/2026_10_06_000002_create_office_lists_table.php'))->up();
    }

    public function test_import_preserves_dump_values_and_can_be_repeated(): void
    {
        $this->seed(OfficeListsSqlSeeder::class);
        $this->assertCount(15, Schema::getColumnListing('office_lists'));
        $this->assertSame(269, OfficeList::withTrashed()->count());
        $this->assertSame('0100000000', OfficeList::findOrFail(10)->region_code);
        $this->assertSame("XII - COMMUNITY SERVICE CENTER, T'BOLI", OfficeList::findOrFail(196)->division_name);
        $this->assertSame(2, OfficeList::findOrFail(3)->parent->id);

        $this->seed(OfficeListsSqlSeeder::class);
        $this->assertSame(269, OfficeList::withTrashed()->count());
        $office = OfficeList::create(['division_code' => 'NEW-CODE', 'division_name' => 'New office']);
        $this->assertSame(270, $office->id);
    }

    public function test_division_codes_must_be_unique(): void
    {
        DB::table('office_lists')->insert(['division_code' => 'CODE', 'division_name' => 'Office']);
        $this->expectException(QueryException::class);
        DB::table('office_lists')->insert(['division_code' => 'CODE', 'division_name' => 'Another office']);
    }
}
