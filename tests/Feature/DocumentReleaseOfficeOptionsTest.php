<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Range;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class DocumentReleaseOfficeOptionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->configureLegacyConnection();
    }

    public function test_legacy_bureau_dropdown_includes_only_active_bureaus_in_the_same_range(): void
    {
        $range = Range::query()->create(['name' => 'North Range', 'is_active' => true]);
        $southRange = Range::query()->create(['name' => 'South Range', 'is_active' => true]);
        $this->addLegacyRange(10, 'North Range', 'active');
        $this->addLegacyRange(20, 'South Range', 'active');

        $userOffice = $this->addOffice('Alpha Bureau', $range);
        $targetOffice = $this->addOffice('Beta Bureau', $range);
        $this->addOffice('South Bureau', $southRange);
        $this->addOffice('Inactive Bureau', $range);
        $newOffice = $this->addOffice('New Range Office', $range);

        $this->addLegacyBureau(101, 'Alpha Bureau', '10', 'active');
        $this->addLegacyBureau(102, 'Beta Bureau', 'North Range', 'Y');
        $this->addLegacyBureau(103, 'South Bureau', '20', 'active');
        $this->addLegacyBureau(104, 'Inactive Bureau', '10', 'inactive');
        $this->addLegacyBureau(105, 'Gamma Bureau', '10', 'active');

        $user = $this->makeUser($userOffice, 101);

        $this->actingAs($user)->get(route('documents.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Index')
                ->has('receivingOffices', 4)
                ->where('receivingOffices.0.id', '101')
                ->where('receivingOffices.0.office_id', (string) $userOffice->id)
                ->where('receivingOffices.0.name', 'Alpha Bureau')
                ->where('receivingOffices.1.id', '102')
                ->where('receivingOffices.1.office_id', (string) $targetOffice->id)
                ->where('receivingOffices.1.name', 'Beta Bureau')
                ->where('receivingOffices.2.id', '105')
                ->where('receivingOffices.2.office_id', null)
                ->where('receivingOffices.2.name', 'Gamma Bureau')
                ->where('receivingOffices.2.is_selectable', false)
                ->where('receivingOffices.3.id', 'new-office:'.$newOffice->id)
                ->where('receivingOffices.3.name', 'New Range Office'));
    }

    public function test_unrecognized_legacy_bureau_range_returns_no_office_options(): void
    {
        $range = Range::query()->create(['name' => 'North Range', 'is_active' => true]);
        $userOffice = $this->addOffice('Unconfigured Bureau', $range);
        $this->addLegacyBureau(201, 'Unconfigured Bureau', 'unknown-range', 'active');
        $user = $this->makeUser($userOffice, 201);

        $this->actingAs($user)->get(route('documents.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Index')
                ->has('receivingOffices', 0));
    }

    public function test_modern_user_gets_options_from_their_active_range(): void
    {
        $range = Range::query()->create(['name' => 'Central Range', 'is_active' => true]);
        $userOffice = $this->addOffice('Modern Origin', $range);
        $targetOffice = $this->addOffice('Modern Target', $range);
        $this->addOffice('Other Range Office', Range::query()->create(['name' => 'West Range', 'is_active' => true]));
        $user = $this->makeUser($userOffice);

        $this->actingAs($user)->get(route('documents.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Index')
                ->has('receivingOffices', 2)
                ->where('receivingOffices.0.office_id', (string) $userOffice->id)
                ->where('receivingOffices.1.office_id', (string) $targetOffice->id));
    }

    public function test_matching_legacy_user_bureau_id_determines_the_dropdown_range(): void
    {
        $northRange = Range::query()->create(['name' => 'North Range', 'is_active' => true]);
        $southRange = Range::query()->create(['name' => 'South Range', 'is_active' => true]);
        $this->addLegacyRange(10, 'North Range', 'active');
        $this->addLegacyRange(20, 'South Range', 'active');

        $localFallbackOffice = $this->addOffice('Local Fallback Bureau', $northRange);
        $legacyUserOffice = $this->addOffice('Legacy User Bureau', $southRange);
        $this->addLegacyBureau(301, 'Local Fallback Bureau', '10', 'active');
        $this->addLegacyBureau(302, 'Legacy User Bureau', '20', 'active');

        $user = $this->makeUser($localFallbackOffice, 301);
        DB::connection('legacy')->table('user')->insert([
            'userUuid' => 'legacy-email-collision',
            'username' => 'different-legacy-user',
            'emailAddress' => $user->email,
            'bureauId' => 301,
        ]);
        DB::connection('legacy')->table('user')->insert([
            'userUuid' => 'legacy-user-1',
            'username' => $user->username,
            'emailAddress' => $user->email,
            'bureauId' => 302,
        ]);

        $this->actingAs($user)->get(route('documents.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Index')
                ->has('receivingOffices', 1)
                ->where('receivingOffices.0.id', '302')
                ->where('receivingOffices.0.office_id', (string) $legacyUserOffice->id)
                ->where('receivingOffices.0.name', 'Legacy User Bureau'));
    }

    public function test_legacy_user_without_current_office_mapping_still_gets_range_options(): void
    {
        $this->addLegacyRange(30, 'Coastal Range', 'active');
        $this->addLegacyBureau(401, 'Legacy Login Bureau', '30', 'active');
        $this->addLegacyBureau(402, 'Other Coastal Bureau', 'Coastal Range', 'active');
        $user = User::factory()->create([
            'username' => 'legacy-login-user',
            'email' => 'legacy-login@example.test',
            'role' => 'Encoder',
            'role_id' => 14,
            'office_id' => null,
            'legacy_bureau_id' => null,
            'email_verified_at' => now(),
        ]);
        DB::connection('legacy')->table('user')->insert([
            'userUuid' => 'legacy-login-user-id',
            'username' => 'legacy-login-user',
            'emailAddress' => 'legacy-login@example.test',
            'bureauId' => 401,
        ]);

        $this->actingAs($user)->get(route('documents.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Documents/Index')
                ->has('receivingOffices', 2)
                ->where('receivingOffices.0.id', '401')
                ->where('receivingOffices.1.id', '402'));
    }

    private function makeUser(Office $office, ?int $legacyBureauId = null): User
    {
        return User::factory()->create([
            'role' => 'Encoder',
            'role_id' => 14,
            'username' => 'office-'.$office->id.'-'.bin2hex(random_bytes(4)),
            'office_id' => $office->id,
            'legacy_bureau_id' => $legacyBureauId,
            'email_verified_at' => now(),
        ]);
    }

    private function addOffice(string $name, Range $range): Office
    {
        return Office::query()->create(['name' => $name, 'range_id' => $range->id]);
    }

    private function addLegacyRange(int $id, string $name, string $status): void
    {
        DB::connection('legacy')->table('rangeregion')->insert(compact('id', 'name', 'status'));
    }

    private function addLegacyBureau(int $bureauId, string $longName, string $range, string $status): void
    {
        DB::connection('legacy')->table('bureau')->insert(compact('bureauId', 'longName', 'range', 'status'));
    }

    private function configureLegacyConnection(): void
    {
        config(['database.connections.legacy' => [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]]);
        DB::purge('legacy');

        Schema::connection('legacy')->create('document', function (Blueprint $table) {
            $table->integer('docId')->primary();
            $table->string('trackingNo');
            $table->integer('dtId')->nullable();
            $table->string('otherDtype')->nullable();
            $table->string('purpose')->nullable();
            $table->string('originType')->nullable();
            $table->string('title')->nullable();
            $table->text('remarks')->nullable();
            $table->string('Archived')->nullable();
            $table->string('createdBy')->nullable();
            $table->dateTime('dateCreated')->nullable();
            $table->string('isFinalized')->nullable();
            $table->string('urgent')->nullable();
        });
        Schema::connection('legacy')->create('document_trail', function (Blueprint $table) {
            $table->integer('docTrailId')->primary();
            $table->string('trackingNo');
            $table->string('status')->nullable();
            $table->string('action')->nullable();
            $table->text('remarks')->nullable();
            $table->string('createdBy')->nullable();
            $table->dateTime('dateCreated')->nullable();
            $table->integer('originating')->nullable();
            $table->integer('receiving')->nullable();
            $table->integer('holder')->nullable();
        });
        Schema::connection('legacy')->create('user', function (Blueprint $table) {
            $table->string('userUuid')->primary();
            $table->string('username')->nullable();
            $table->string('emailAddress')->nullable();
            $table->integer('bureauId')->nullable();
            $table->string('firstname')->nullable();
            $table->string('middlename')->nullable();
            $table->string('lastname')->nullable();
            $table->string('extensionname')->nullable();
        });
        Schema::connection('legacy')->create('bureau', function (Blueprint $table) {
            $table->integer('bureauId')->primary();
            $table->integer('parentbureauId')->nullable();
            $table->string('officeCode')->nullable();
            $table->string('officeEmail')->nullable();
            $table->string('longName');
            $table->string('shortName')->nullable();
            $table->string('status')->nullable();
            $table->string('range')->nullable();
            $table->dateTime('dateAdded')->nullable();
            $table->string('addedBy')->nullable();
        });
        Schema::connection('legacy')->create('rangeregion', function (Blueprint $table) {
            $table->integer('id')->primary();
            $table->string('name');
            $table->string('status')->nullable();
        });
        Schema::connection('legacy')->create('document_type', function (Blueprint $table) {
            $table->integer('dtId')->primary();
            $table->string('name');
        });
    }
}