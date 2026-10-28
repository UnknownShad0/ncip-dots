<?php

use App\Http\Controllers\ActionTypeController;
use App\Http\Controllers\ArchiveController;
use App\Http\Controllers\AuditTrailController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\DocumentCreationController;
use App\Http\Controllers\DocumentFontController;
use App\Http\Controllers\DocumentTypeController;
use App\Http\Controllers\DocumentWorkflowController;
use App\Http\Controllers\DraftsController;
use App\Http\Controllers\EmailIntegrationController;
use App\Http\Controllers\HrisEmployeeController;
use App\Http\Controllers\IntegrationController;
use App\Http\Controllers\IplumaController;
use App\Http\Controllers\NavigationAccessController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PublicDocumentTrackingController;
use App\Http\Controllers\PurposeTypeController;
use App\Http\Controllers\QrDocumentWorkflowController;
use App\Http\Controllers\RangeController;
use App\Http\Controllers\SetupController;
use App\Http\Controllers\SystemMaintenanceController;
use App\Http\Controllers\StagedDocumentUploadController;
use App\Http\Controllers\UserAccountController;
use App\Services\DocumentTemplates;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::redirect('/', '/login');
Route::get('/track/{trackingNumber}', [PublicDocumentTrackingController::class, 'show'])
    ->where('trackingNumber', '[^/]+')
    ->middleware(['signed', 'throttle:qr-tracking', 'qr.document:optional'])
    ->name('documents.track');
Route::post('/track/{trackingNumber}/otp', [QrDocumentWorkflowController::class, 'requestOtp'])
    ->where('trackingNumber', '[^/]+')->middleware(['signed', 'throttle:qr-otp-request'])->name('documents.track.otp.request');
Route::post('/track/{trackingNumber}/otp/verify', [QrDocumentWorkflowController::class, 'verifyOtp'])
    ->where('trackingNumber', '[^/]+')->middleware(['signed', 'throttle:qr-otp-verify'])->name('documents.track.otp.verify');
Route::post('/track/{trackingNumber}/otp/resend', [QrDocumentWorkflowController::class, 'resendOtp'])
    ->where('trackingNumber', '[^/]+')->middleware(['signed', 'throttle:qr-otp-resend'])->name('documents.track.otp.resend');
Route::delete('/track/{trackingNumber}/session', [QrDocumentWorkflowController::class, 'endSession'])
    ->where('trackingNumber', '[^/]+')->name('documents.track.session.destroy');

Route::middleware(['qr.document', 'throttle:qr-document-actions'])->group(function () {
    Route::post('/track/{trackingNumber}/receive', [QrDocumentWorkflowController::class, 'receive'])->name('documents.track.receive');
    Route::post('/track/{trackingNumber}/signature-claim', [QrDocumentWorkflowController::class, 'claimSignature'])->name('documents.track.signature-claim');
    Route::post('/track/{trackingNumber}/signature-claim/release', [QrDocumentWorkflowController::class, 'releaseSignatureClaim'])->name('documents.track.signature-claim.release');
    Route::post('/track/{trackingNumber}/decision', [QrDocumentWorkflowController::class, 'decide'])->name('documents.track.decision');
    Route::post('/track/{trackingNumber}/wet-signed', [QrDocumentWorkflowController::class, 'uploadWetSignedAndApprove'])->name('documents.track.wet-signed');
    Route::post('/track/{trackingNumber}/forward', [QrDocumentWorkflowController::class, 'forward'])->name('documents.track.forward');
    Route::get('/track/{trackingNumber}/files/{file}/view', [QrDocumentWorkflowController::class, 'viewFile'])
        ->whereNumber('file')->name('documents.track.files.view');
    Route::get('/track/{trackingNumber}/files/{file}', [QrDocumentWorkflowController::class, 'downloadFile'])
        ->whereNumber('file')->name('documents.track.files.download');
});

Route::middleware(['auth', 'active.user'])->get('/maintenance', [SystemMaintenanceController::class, 'show'])->name('maintenance.show');

Route::middleware(['auth', 'active.user', 'verified', 'system.maintenance', 'navigation.visible'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
    Route::post('/document-uploads', [StagedDocumentUploadController::class, 'store'])->middleware('throttle:30,1')->name('document-uploads.store');
    Route::delete('/document-uploads/{token}', [StagedDocumentUploadController::class, 'destroy'])->whereUuid('token')->name('document-uploads.destroy');
    Route::get('/documents/latest', [DocumentController::class, 'latest'])->name('documents.latest');
    Route::get('/documents/{id}/details', [DocumentController::class, 'details'])->whereNumber('id')->name('documents.details');
    Route::post('/documents/{id}/signature-claim', [DocumentController::class, 'claimSignature'])->whereNumber('id')->name('documents.signature-claim');
    Route::post('/documents/{id}/signature-claim/release', [DocumentController::class, 'releaseSignatureClaim'])->whereNumber('id')->name('documents.signature-claim.release');
    Route::post('/documents/{id}/approval', [DocumentController::class, 'decideApproval'])->whereNumber('id')->name('documents.approval');
    Route::get('/documents/{document}/files/{file}/view', [DocumentController::class, 'viewFile'])
        ->whereNumber('document')->whereNumber('file')->name('documents.files.view');
    Route::get('/documents/{document}/files/{file}', [DocumentController::class, 'downloadFile'])
        ->whereNumber('document')->whereNumber('file')->name('documents.files.download');
    Route::get('/document-creation', [DocumentCreationController::class, 'index'])->name('document-creation.index');
    Route::get('/document-workflow', [DocumentWorkflowController::class, 'index'])->name('document-workflow.index');
    Route::get('/document-fonts/{face}', DocumentFontController::class)
        ->where('face', 'regular|bold|italic|bold-italic')->name('document-fonts.show');
    Route::get('/document-assets/{filename}', [DocumentTemplates::class, 'show'])->where('filename', '[a-f0-9]{64}\.(png|jpg)')->name('document-assets.show');
    Route::post('/document-creation/preview', [DocumentCreationController::class, 'preview'])->middleware('throttle:30,1')->name('document-creation.preview');
    Route::get('/document-creation/{draft}/preview', [DocumentCreationController::class, 'previewSubmission'])->middleware('throttle:30,1')->name('document-creation.preview-submission');
    Route::get('/drafts', [DraftsController::class, 'index'])->name('drafts.index');
    Route::get('/approved-documents', fn () => redirect()->route('document-workflow.index'))->name('approved-documents.index');
    Route::post('/document-creation', [DocumentCreationController::class, 'store'])->name('document-creation.store');
    Route::post('/document-creation/finalize', [DocumentCreationController::class, 'finalizeCurrent'])->name('document-creation.finalize');
    Route::delete('/document-creation/{draft}', [DocumentCreationController::class, 'destroy'])->name('document-creation.destroy');
    Route::post('/document-creation/{draft}/archive', [DocumentCreationController::class, 'archive'])->name('document-creation.archive');
    Route::post('/document-creation/{draft}/restore', [DocumentCreationController::class, 'restore'])->name('document-creation.restore');
    Route::post('/archives/{document}/restore', [ArchiveController::class, 'restore'])->name('archives.restore');
    Route::put('/document-creation/{draft}', [DocumentCreationController::class, 'update'])->name('document-creation.update');
    Route::post('/documents', [DocumentController::class, 'store'])->name('documents.store');
    Route::put('/documents/{id}', [DocumentController::class, 'update'])->name('documents.update');
    Route::post('/documents/{id}/release', [DocumentController::class, 'release'])->name('documents.release');
    Route::put('/documents/{document}/routes/{route}/remaining-steps', [DocumentController::class, 'updateRemainingRouteSteps'])
        ->whereNumber('document')->whereNumber('route')->name('documents.routes.remaining-steps.update');
    Route::post('/documents/{id}/receive', [DocumentController::class, 'receive'])->name('documents.receive');
    Route::post('/documents/{id}/terminal', [DocumentController::class, 'tagTerminal'])->name('documents.terminal');
    Route::delete('/documents/{id}', [DocumentController::class, 'destroy'])->name('documents.destroy');

    Route::get('/archives', [ArchiveController::class, 'index'])->name('archives.index');
    Route::get('/archives/categories', [ArchiveController::class, 'categories'])->name('archives.categories');

    Route::get('/audit-trail', [AuditTrailController::class, 'index'])->name('audit-trail.index');

    Route::middleware('administrator')->group(function () {
        Route::get('/admin/email', [EmailIntegrationController::class, 'index'])->name('email-integration.index');
        Route::patch('/admin/email/automation', [EmailIntegrationController::class, 'updateAutomation'])
            ->name('email-integration.automation.update');
        Route::post('/admin/email/test', [EmailIntegrationController::class, 'sendTest'])
            ->middleware('throttle:5,1')->name('email-integration.test');

        // Keep old bookmarks working after the Gmail-specific integration was replaced by SMTP.
        Route::redirect('/admin/gmail', '/admin/email')->name('gmail-integration.index');
        Route::redirect('/admin/gmail/connect', '/admin/email')->name('gmail-integration.connect');
        Route::redirect('/admin/gmail/callback', '/admin/email')->name('gmail-integration.callback');
        Route::post('/admin/gmail/disconnect', fn () => redirect()->route('email-integration.index'))
            ->name('gmail-integration.disconnect');

        Route::get('/setup', [SetupController::class, 'index'])->name('setup.index');
        Route::get('/libraries', [SetupController::class, 'libraries'])->name('libraries.index');
        Route::get('/libraries/agencies', [SetupController::class, 'agencies'])->name('libraries.agencies');
        Route::get('/libraries/offices', [SetupController::class, 'offices'])->name('libraries.offices');
        Route::get('/libraries/document-types', [SetupController::class, 'documentTypes'])->name('libraries.document-types');
        Route::get('/libraries/action-types', [SetupController::class, 'actionTypes'])->name('libraries.action-types');
        Route::get('/libraries/categories', [SetupController::class, 'categories'])->name('libraries.categories');

        Route::get('/offices', [OfficeController::class, 'index'])->name('offices.index');
        Route::post('/offices', [OfficeController::class, 'store'])->name('offices.store');
        Route::put('/offices/{id}', [OfficeController::class, 'update'])->name('offices.update');
        Route::post('/offices/hris-directory/sync', [OfficeController::class, 'syncHris'])->name('offices.hris-sync');
        Route::post('/offices/hris-directory/{divisionCode}/mapping', [OfficeController::class, 'updateHrisMapping'])
            ->where('divisionCode', '[^/]+')->name('offices.hris-mappings.update');

        Route::get('/ranges', [RangeController::class, 'index'])->name('ranges.index');
        Route::post('/ranges', [RangeController::class, 'store'])->name('ranges.store');
        Route::put('/ranges/{id}', [RangeController::class, 'update'])->name('ranges.update');

        Route::get('/document-types', [DocumentTypeController::class, 'index'])->name('document-types.index');
        Route::post('/document-types', [DocumentTypeController::class, 'store'])->name('document-types.store');
        Route::put('/document-types/{id}', [DocumentTypeController::class, 'update'])->name('document-types.update');

        Route::get('/action-types', [ActionTypeController::class, 'index'])->name('action-types.index');
        Route::post('/action-types', [ActionTypeController::class, 'store'])->name('action-types.store');
        Route::put('/action-types/{id}', [ActionTypeController::class, 'update'])->name('action-types.update');

        Route::get('/purpose-types', [PurposeTypeController::class, 'purposeTypes'])->name('purpose-types.index');
        Route::post('/purpose-types', [PurposeTypeController::class, 'storePurposeType'])->name('purpose-types.store');
        Route::put('/purpose-types/{id}', [PurposeTypeController::class, 'updatePurposeType'])->name('purpose-types.update');
        Route::get('/hris-employees', [HrisEmployeeController::class, 'index'])->name('hris-employees.index');
        Route::post('/hris-employees/sync', [HrisEmployeeController::class, 'sync'])->name('hris-employees.sync');
        Route::get('/user-accounts', [UserAccountController::class, 'index'])->name('user-accounts.index');
        Route::post('/user-accounts/search-employees', [UserAccountController::class, 'searchEmployees'])->middleware('throttle:30,1')->name('user-accounts.search-employees');
        Route::post('/user-accounts/lookup-employee', [UserAccountController::class, 'lookupEmployee'])->middleware('throttle:20,1')->name('user-accounts.lookup-employee');
        Route::post('/user-accounts', [UserAccountController::class, 'store'])->name('user-accounts.store');
        Route::put('/user-accounts/{id}', [UserAccountController::class, 'update'])->name('user-accounts.update');

    });

    Route::middleware('super.admin')->group(function () {
        Route::get('/navigation-access', [NavigationAccessController::class, 'index'])->name('navigation-access.index');
        Route::put('/navigation-access', [NavigationAccessController::class, 'update'])->name('navigation-access.update');
        Route::get('/system-maintenance', [SystemMaintenanceController::class, 'index'])->name('system-maintenance.index');
        Route::put('/system-maintenance', [SystemMaintenanceController::class, 'update'])->name('system-maintenance.update');
    });

    Route::get('/connected-systems', fn () => Inertia::render('ConnectedSystems/Index'))->name('connected-systems.index');
    Route::get('/drip', [IntegrationController::class, 'drip'])->name('drip.index');
    Route::get('/ipluma', [IplumaController::class, 'index'])->name('ipluma.index');
    Route::get('/pdmis', [IntegrationController::class, 'pdmis'])->name('pdmis.index');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
