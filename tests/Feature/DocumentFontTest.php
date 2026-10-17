<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class DocumentFontTest extends TestCase
{
    private string $originalStoragePath;
    private string $fontStoragePath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalStoragePath = storage_path();
        $this->fontStoragePath = sys_get_temp_dir().'/dots-document-fonts-'.bin2hex(random_bytes(8));
        File::makeDirectory($this->fontStoragePath.'/app/private/fonts/arial', 0755, true);
        $this->app->useStoragePath($this->fontStoragePath);
    }

    protected function tearDown(): void
    {
        $this->app->useStoragePath($this->originalStoragePath);
        File::deleteDirectory($this->fontStoragePath);
        parent::tearDown();
    }

    public function test_document_fonts_require_authentication(): void
    {
        $this->get('/document-fonts/regular')->assertRedirect('/login');
        $this->getJson('/document-fonts/regular')->assertUnauthorized();
    }

    public function test_authenticated_users_receive_only_the_requested_font_face(): void
    {
        $this->actingAs(User::factory()->make());
        foreach ([
            'regular' => 'Arial.ttf',
            'bold' => 'Arial-Bold.ttf',
            'italic' => 'Arial-Italic.ttf',
            'bold-italic' => 'Arial-BoldItalic.ttf',
        ] as $face => $filename) {
            $path = storage_path('app/private/fonts/arial/'.$filename);
            File::put($path, 'Font fixture '.$face);
            $response = $this->get('/document-fonts/'.$face)
                ->assertOk()
                ->assertHeader('Content-Type', 'font/ttf')
                ->assertHeader('X-Content-Type-Options', 'nosniff');
            $this->assertSame(realpath($path), $response->baseResponse->getFile()->getRealPath());
            $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
            $this->assertStringNotContainsString('public', $response->headers->get('Cache-Control'));
        }
    }

    public function test_unknown_faces_and_path_traversal_are_rejected(): void
    {
        $this->actingAs(User::factory()->make());
        foreach (['Arial.ttf', 'LICENSE.txt', 'regular.ttf', '..%2F..%2F.env', 'regular%2F..%2FArial.ttf'] as $face) {
            $this->get('/document-fonts/'.$face)->assertNotFound();
        }
    }

    public function test_a_missing_font_returns_not_found_instead_of_a_different_font(): void
    {
        $this->actingAs(User::factory()->make())->get('/document-fonts/regular')->assertNotFound();
    }
}
