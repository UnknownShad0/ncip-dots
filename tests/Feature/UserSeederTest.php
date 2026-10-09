<?php

namespace Tests\Feature;

use App\Models\Division;
use App\Models\Office;
use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        config(['database.connections.legacy' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]]);
        \Illuminate\Support\Facades\DB::purge('legacy');
    }

    public function test_users_can_be_seeded_without_offices_or_divisions(): void
    {
        $this->seed(UserSeeder::class);
        $this->seed(UserSeeder::class);

        $this->assertSame(6, User::count());
        $this->assertSame(0, User::whereNotNull('office_id')->count());
        $this->assertSame(0, User::whereNotNull('division_id')->count());
        $this->assertSame(0, Office::count());
        $this->assertSame(0, Division::count());
    }

    public function test_users_are_assigned_to_matching_codes_instead_of_a_fixed_office_id(): void
    {
        Office::create(['name' => 'Unrelated office', 'code' => 'UNRELATED']);
        $central = Office::create(['name' => 'Central Office', 'code' => 'CENTRAL']);
        $records = Division::create(['office_id' => $central->id, 'name' => 'Records', 'code' => 'RM']);
        $office = Office::create(['name' => 'Baguio', 'code' => 'BSO-299']);
        $division = Division::create(['office_id' => $office->id, 'name' => 'Baguio division', 'code' => 'DIV-4954']);

        $this->seed(UserSeeder::class);

        $admin = User::where('username', 'system.admin')->firstOrFail();
        $employee = User::where('username', 'hsdelmas')->firstOrFail();
        $this->assertEquals($central->id, $admin->office_id);
        $this->assertEquals($records->id, $admin->division_id);
        $this->assertEquals($office->id, $employee->office_id);
        $this->assertEquals($division->id, $employee->division_id);
        $this->assertNull(User::where('username', 'jmbannunciado1')->firstOrFail()->division_id);
    }
}
