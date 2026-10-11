<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ConnectedSystemsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['inertia.ssr.enabled' => false]);
    }

    public function test_directory_requires_authentication_and_does_not_fetch_external_data(): void
    {
        Http::preventStrayRequests();
        $this->get('/connected-systems')->assertRedirect('/login');
        $this->actingAs(User::factory()->create())
            ->get('/connected-systems')->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('ConnectedSystems/Index'));
        Http::assertNothingSent();
    }

    public function test_each_system_keeps_its_document_and_signer_details(): void
    {
        Http::preventStrayRequests();
        $this->actingAs(User::factory()->create());
        foreach (['pdmis', 'drip', 'ipluma'] as $service) {
            config(["services.$service.url" => "https://$service.example.test", "services.$service.key" => 'test-key']);
            Http::fake(["https://$service.example.test/dots-summary" => Http::response(['data' => [[
                'dotsId' => 'TEST-001', 'fileName' => 'Test.pdf', 'fileType' => 'PDF',
                'originator' => ['name' => 'Test Originator', 'email' => 'originator@example.test'],
                'signingTrails' => [[
                    'step' => 1, 'signer' => ['name' => 'Test Signer', 'email' => 'signer@example.test'],
                    'signedAt' => 'Pending', 'declineSigning' => true, 'remarks' => 'Please revise',
                ]],
            ]]])]);
            $this->get("/$service")->assertOk()->assertInertia(fn (Assert $page) => $page
                ->component($service === 'ipluma' ? 'Ipluma/Index' : 'Integrations/Index')
                ->has('documents', 1)->where('documents.0.dotsId', 'TEST-001')
                ->where('documents.0.status', 'DECLINED')
                ->where('documents.0.originatorEmail', 'originator@example.test')
                ->where('documents.0.signingTrails.0.email', 'signer@example.test')
                ->where('documents.0.signingTrails.0.remarks', 'Please revise'));
        }
    }
}
