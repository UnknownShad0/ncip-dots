<?php

use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\AuditTrailController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\IntegrationController;
use App\Http\Controllers\IplumaController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\UserAccountController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/welcome', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
    Route::get('/documents/incoming', [DocumentController::class, 'incoming'])->name('documents.incoming');
    Route::get('/documents/outgoing', [DocumentController::class, 'outgoing'])->name('documents.outgoing');
    Route::post('/documents', [DocumentController::class, 'store'])->name('documents.store');

    Route::get('/archives', [ArchiveController::class, 'index'])->name('archives.index');
    Route::get('/archives/categories', [ArchiveController::class, 'categories'])->name('archives.categories');

    Route::get('/audit-trail', [AuditTrailController::class, 'index'])->name('audit-trail.index');

    Route::get('/setup', [SetupController::class, 'index'])->name('setup.index');
    Route::get('/libraries', [SetupController::class, 'libraries'])->name('libraries.index');
    Route::get('/libraries/agencies', [SetupController::class, 'agencies'])->name('libraries.agencies');
    Route::get('/libraries/offices', [SetupController::class, 'offices'])->name('libraries.offices');
    Route::get('/libraries/document-types', [SetupController::class, 'documentTypes'])->name('libraries.document-types');
    Route::get('/libraries/action-types', [SetupController::class, 'actionTypes'])->name('libraries.action-types');
    Route::get('/libraries/purpose-types', [SetupController::class, 'purposeTypes'])->name('libraries.purpose-types');
    Route::get('/libraries/categories', [SetupController::class, 'categories'])->name('libraries.categories');

    Route::get('/drip', [IntegrationController::class, 'drip'])->name('drip.index');
    Route::get('/ipluma', [IplumaController::class, 'index'])->name('ipluma.index');
    Route::get('/pdmis', [IntegrationController::class, 'pdmis'])->name('pdmis.index');

    Route::get('/user-accounts', [UserAccountController::class, 'index'])->name('user-accounts.index');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
