<?php

namespace App\Http\Controllers;

use App\Models\ActionType;
use App\Models\Document;
use App\Models\Office;
use App\Services\QrDocumentAccess;
use App\Support\DateTimePresenter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;

class PublicDocumentTrackingController extends Controller
{
    public function show(Request $request, string $trackingNumber)
    {
        $document = Document::query()
            ->where('tracking_number', $trackingNumber)
            ->where('is_finalized', true)
            ->with([
                'office:id,name', 'documentType:id,name', 'purposeType:id,name',
                'trails.fromOffice:id,name', 'trails.toOffice:id,name',
                'latestRoute.fromOffice:id,name', 'latestRoute.steps.office:id,name',
                'routes.fromOffice:id,name', 'routes.steps.office:id,name',
                'files',
            ])
            ->first();

        if ($document) {
            $routes = $document->routes;
            $rootRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();
            $hasPendingRoute = $routes->contains(fn ($route) => $route->status === 'pending');
            $qrDocument = $request->attributes->get('qr_document');
            $verified = $qrDocument && (int) $qrDocument->id === (int) $document->id;
            $user = $verified ? $request->user() : null;
            $step = $verified ? $request->attributes->get('qr_route_step') : null;
            $pending = $request->session()->get('qr_otp_pending');
            $otpPending = is_array($pending) && (int) ($pending['document_id'] ?? 0) === (int) $document->id;
            $expiresAt = now()->addMinutes((int) config('qr_document.otp_ttl_minutes', 10));
            $actionableStepExists = $routes
                ->where('status', 'pending')
                ->contains(fn ($route) => $route->steps->contains(
                    fn ($routeStep) => in_array($routeStep->status, ['available', 'in_progress'], true)
                ));
            $workflow = [
                'state' => $verified ? 'verified' : ($otpPending ? 'otp_pending' : 'public'),
                'can_start' => $actionableStepExists,
                'masked_email' => $otpPending ? ($pending['masked_email'] ?? null) : null,
                'request_otp_url' => URL::temporarySignedRoute('documents.track.otp.request', $expiresAt, ['trackingNumber' => $trackingNumber]),
                'verify_otp_url' => $otpPending
                    ? URL::temporarySignedRoute('documents.track.otp.verify', $expiresAt, ['trackingNumber' => $trackingNumber])
                    : null,
                'resend_otp_url' => $otpPending
                    ? URL::temporarySignedRoute('documents.track.otp.resend', $expiresAt, ['trackingNumber' => $trackingNumber])
                    : null,
                'resend_available_at' => $otpPending ? ($pending['resend_available_at'] ?? null) : null,
                'session_end_url' => route('documents.track.session.destroy', ['trackingNumber' => $trackingNumber]),
                'user' => $verified ? [
                    'name' => $user->name,
                    'office' => $user->office?->name,
                    'role' => $user->role,
                ] : null,
                'expires_at' => $verified ? data_get($request->session()->get('qr_document_access'), 'expires_at') : null,
                'step_status' => $step?->status,
                'step_signature_required' => (bool) ($step?->signature_required ?? false),
                'can_receive' => $verified && $step?->status === 'available' && $user->canReceiveDocuments(),
                'can_approve' => $verified && app(QrDocumentAccess::class)->canApprove($document, $user, $step),
                'can_forward' => $verified && $step?->status === 'in_progress' && $user->isAdministrator(),
                'receive_url' => $verified ? route('documents.track.receive', ['trackingNumber' => $trackingNumber]) : null,
                'decision_url' => $verified ? route('documents.track.decision', ['trackingNumber' => $trackingNumber]) : null,
                'wet_signed_url' => $verified ? route('documents.track.wet-signed', ['trackingNumber' => $trackingNumber]) : null,
                'forward_url' => $verified ? route('documents.track.forward', ['trackingNumber' => $trackingNumber]) : null,
                'signature_status' => $document->signature_status,
                'source_document_file_id' => $verified ? $document->files->whereIn('type', ['original', 'version', 'signed'])->sortByDesc('id')->first()?->id : null,
                'ipluma_available' => false,
                'files' => $verified ? $document->files->sortByDesc('id')->values()->map(fn ($file) => [
                    'id' => $file->id,
                    'name' => $file->original_name,
                    'type' => $file->type,
                    'size_bytes' => $file->size_bytes,
                    'is_pdf' => strtolower(pathinfo($file->original_name, PATHINFO_EXTENSION)) === 'pdf',
                    'download_url' => route('documents.track.files.download', ['trackingNumber' => $trackingNumber, 'file' => $file->id]),
                    'view_url' => in_array(strtolower(pathinfo($file->original_name, PATHINFO_EXTENSION)), ['pdf', 'png', 'jpg', 'jpeg'], true)
                        ? route('documents.track.files.view', ['trackingNumber' => $trackingNumber, 'file' => $file->id])
                        : null,
                ])->all() : [],
                'action_types' => $verified && $user->isAdministrator()
                    ? ActionType::query()->where('is_active', true)->orderBy('name')->get(['id', 'name'])->all()
                    : [],
                'offices' => $verified && $user->isAdministrator() && $user->office?->range_id
                    ? Office::query()->where('range_id', $user->office->range_id)->whereKeyNot($user->office_id)
                        ->orderBy('name')->get(['id', 'name'])->all()
                    : [],
            ];

            return Inertia::render('PublicTracking/Show', [
                'workflow' => $workflow,
                'document' => [
                    'tracking_number' => $document->tracking_number,
                    'title' => $document->title,
                    'status' => $hasPendingRoute ? 'pending' : ($rootRoute?->status ?? $document->status),
                    'route_mode' => $rootRoute?->mode,
                    'route_status' => $rootRoute?->status,
                    'route_from_office' => $rootRoute?->fromOffice?->name ?? $document->office?->name,
                    'route_steps' => $rootRoute?->steps->map(fn ($step) => [
                        'office' => $step->office?->name,
                        'position' => $step->position,
                        'status' => $step->status,
                        'signature_required' => (bool) $step->signature_required,
                        'signature_status' => $step->signature_status,
                    ])->values() ?? [],
                    'route_tree' => $this->serializeRouteTree($routes),
                    'document_type' => $document->other_document_type ?: $document->documentType?->name,
                    'purpose' => $document->other_purpose ?: $document->purposeType?->name,
                    'office_name' => $document->office?->name,
                    'created_at' => DateTimePresenter::format($document->created_at, 'F j, Y g:i A'),
                    'trails' => $document->trails->sortBy([['created_at', 'desc'], ['id', 'desc']])->values()->map(fn ($trail) => [
                        'action' => $trail->action ?: ucfirst((string) $trail->status),
                        'status' => $trail->status,
                        'from_office' => $trail->fromOffice?->name,
                        'to_office' => $trail->toOffice?->name,
                        'created_at' => DateTimePresenter::format($trail->created_at, 'F j, Y g:i A'),
                    ]),
                ],
            ]);
        }

        abort(404);
    }

    private function serializeRouteTree($routes): array
    {
        $serializeRoute = function ($route) use (&$serializeRoute, $routes): array {
            return [
                'id' => $route->id,
                'mode' => $route->mode,
                'status' => $route->status,
                'from_office' => $route->fromOffice?->name,
                'steps' => $route->steps->map(fn ($step) => [
                    'id' => $step->id,
                    'office_id' => $step->office_id,
                    'office' => $step->office?->name,
                    'position' => $step->position,
                    'status' => $step->status,
                    'signature_required' => (bool) $step->signature_required,
                    'signature_status' => $step->signature_status,
                    'signed_at' => DateTimePresenter::format($step->signed_at, 'F j Y h:i:s A'),
                    'child_routes' => $routes->where('parent_step_id', $step->id)->sortBy('id')
                        ->map(fn ($childRoute) => $serializeRoute($childRoute))->values()->all(),
                ])->values()->all(),
            ];
        };

        return $routes->whereNull('parent_step_id')->sortBy('id')
            ->map(fn ($route) => $serializeRoute($route))->values()->all();
    }
}
