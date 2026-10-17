<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ArchivePaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_archives_are_bounded_and_pages_do_not_overlap(): void
    {
        $office = Office::create(['name' => 'Archive Office']);
        $admin = User::factory()->create(['office_id' => $office->id, 'role_id' => 1]);
        for ($i = 0; $i < 30; $i++) {
            Document::create(['title' => 'Archive '.$i, 'tracking_number' => 'ARC-'.$i,
                'office_id' => $office->id, 'created_by' => $admin->id, 'is_archived' => true]);
        }
        Document::create(['title' => 'Active', 'tracking_number' => 'ACTIVE', 'created_by' => $admin->id, 'office_id' => $office->id]);
        $first = $this->actingAs($admin)->get('/archives')->assertInertia(fn (Assert $page) => $page
            ->component('Archives/Index')->has('documents.data', 10)->where('documents.total', 30)
            ->where('documents.current_page', 1)->where('documents.last_page', 3)
            ->missing('documents.data.0.creator')->missing('documents.data.0.transactions'));
        $second = $this->get('/archives?page=2')->assertInertia(fn (Assert $page) => $page
            ->has('documents.data', 10)->where('documents.current_page', 2));
        $ids = fn ($response) => array_column($response->viewData('page')['props']['documents']['data'], 'id');
        $this->assertSame([], array_intersect($ids($first), $ids($second)));
    }

    public function test_archive_pagination_preserves_office_access_and_empty_categories(): void
    {
        $office = Office::create(['name' => 'Own']);
        $other = Office::create(['name' => 'Other']);
        $staff = User::factory()->create(['office_id' => $office->id, 'role_id' => 3]);
        foreach ([$office, $other] as $location) {
            Document::create(['title' => $location->name, 'tracking_number' => 'OFF-'.$location->id,
                'office_id' => $location->id, 'created_by' => $staff->id, 'is_archived' => true,
                'status' => 'terminal', 'is_finalized' => true]);
        }
        $this->actingAs($staff)->get('/archives')->assertInertia(fn (Assert $page) => $page
            ->where('documents.total', 1)->where('documents.data.0.title', 'Own'));
        $this->get('/archives/categories')->assertInertia(fn (Assert $page) => $page
            ->component('Archives/Index')->missing('documents'));
    }

    public function test_bureau_filter_sorting_and_validation(): void
    {
        $a = Office::create(['name' => 'Alpha']);
        $z = Office::create(['name' => 'Zulu']);
        $admin = User::factory()->create(['role_id' => 2, 'office_id' => $a->id]);
        foreach ([$z, $a] as $office) {
            for ($i = 0; $i < 26; $i++) {
                Document::create(['title' => $office->name, 'tracking_number' => $office->id.'-'.$i,
                    'office_id' => $office->id, 'created_by' => $admin->id, 'is_archived' => true]);
            }
        }
        $this->actingAs($admin)->get('/archives?sort=bureau_asc')->assertInertia(fn (Assert $page) => $page
            ->where('documents.data.0.office.name', 'Alpha')->where('documents.total', 52));
        $this->get('/archives?sort=bureau_desc')->assertInertia(fn (Assert $page) => $page
            ->where('documents.data.0.office.name', 'Zulu'));
        $response = $this->get('/archives?office_id='.$a->id.'&sort=bureau_desc')->assertInertia(fn (Assert $page) => $page
            ->where('documents.total', 26)->where('documents.data.0.office.name', 'Alpha'));
        $next = $response->viewData('page')['props']['documents']['next_page_url'];
        $this->assertStringContainsString('office_id='.$a->id, $next);
        $this->assertStringContainsString('sort=bureau_desc', $next);
        $this->get($next)->assertInertia(fn (Assert $page) => $page->has('documents.data', 10));
        $this->getJson('/archives?sort=invalid')->assertUnprocessable();
        $this->getJson('/archives?office_id=999999')->assertUnprocessable();
        $staff = User::factory()->create(['role_id' => 3, 'office_id' => $a->id]);
        $this->actingAs($staff)->get('/archives?office_id='.$z->id)->assertForbidden();
        $this->get('/archives?sort=bureau_asc')->assertInertia(fn (Assert $page) => $page
            ->where('canFilterOffices', false)->has('offices', 0)->where('documents.total', 26));
    }
}
