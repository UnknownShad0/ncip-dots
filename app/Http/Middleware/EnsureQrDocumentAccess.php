<?php

namespace App\Http\Middleware;

use App\Models\Document;
use App\Models\DocumentRouteStep;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureQrDocumentAccess
{
    public function handle(Request $request, Closure $next, string $mode = 'required'): Response
    {
        $scope = $request->session()->get('qr_document_access');
        $trackingNumber = (string) $request->route('trackingNumber');
        $document = Document::query()->where('tracking_number', $trackingNumber)->first();

        $valid = is_array($scope) && $document
            && (int) ($scope['document_id'] ?? 0) === (int) $document->id
            && now()->lt($scope['expires_at'] ?? now()->subSecond());

        $user = $valid ? User::query()->find($scope['user_id'] ?? 0) : null;
        $step = $valid ? DocumentRouteStep::query()->find($scope['route_step_id'] ?? 0) : null;
        $valid = $valid && $user && $step
            && $user->is_active && ! $user->is_locked && $user->email_verified_at
            && (int) $user->office_id === (int) ($scope['office_id'] ?? 0)
            && (int) $step->office_id === (int) $user->office_id
            && (int) $step->route()->value('document_id') === (int) $document->id;

        if (! $valid) {
            $request->session()->forget('qr_document_access');
            if ($mode !== 'optional') {
                abort(403, 'Your QR document session has expired. Request a new email code.');
            }

            return $next($request);
        }

        Auth::guard('web')->setUser($user);
        $request->setUserResolver(fn () => $user);
        $request->attributes->set('qr_document', $document);
        $request->attributes->set('qr_route_step', $step);

        return $next($request);
    }
}
