<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\OfficeList;
use Tests\TestCase;

class OfficeShortNameTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();

        foreach ([
            '2026_09_23_000001_create_offices_table.php',
            '2026_10_07_000001_add_legacy_range_id_to_offices_table.php',
            '2026_10_06_000002_create_office_lists_table.php',
        ] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }

        OfficeList::create([
            'division_code' => 'TEST',
            'division_name' => 'Test Office',
            'short_name' => 'DEFAULT',
        ]);
    }

    public function test_create_saves_the_submitted_short_name(): void
    {
        $this->post('/offices', [
            'operation' => 'create',
            'division_code' => 'TEST',
            'short_name' => 'CUSTOM',
        ])->assertSessionHasNoErrors()->assertRedirect(route('offices.index'));

        $this->assertDatabaseHas('offices', ['code' => 'TEST', 'short_name' => 'CUSTOM']);
        $this->assertDatabaseHas('office_lists', ['division_code' => 'TEST', 'short_name' => 'DEFAULT']);
    }

    public function test_update_saves_and_can_clear_the_short_name(): void
    {
        $office = Office::create(['name' => 'Test Office', 'code' => 'TEST', 'short_name' => 'OLD']);

        foreach (['EDITED', null] as $shortName) {
            $this->put('/offices/'.$office->id, [
                'operation' => 'update',
                'division_code' => 'TEST',
                'short_name' => $shortName,
            ])->assertSessionHasNoErrors()->assertRedirect(route('offices.index'));

            $this->assertSame($shortName, $office->fresh()->short_name);
        }
    }

    public function test_create_and_update_reject_short_names_longer_than_the_column(): void
    {
        $this->post('/offices', [
            'operation' => 'create',
            'division_code' => 'TEST',
            'short_name' => str_repeat('A', 256),
        ])->assertSessionHasErrors('short_name');
        $this->assertDatabaseCount('offices', 0);

        $office = Office::create(['name' => 'Test Office', 'code' => 'TEST', 'short_name' => 'OLD']);
        $this->put('/offices/'.$office->id, [
            'operation' => 'update',
            'division_code' => 'TEST',
            'short_name' => str_repeat('A', 256),
        ])->assertSessionHasErrors('short_name');
        $this->assertSame('OLD', $office->fresh()->short_name);
    }
}
