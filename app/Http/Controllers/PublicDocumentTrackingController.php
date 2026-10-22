<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Inertia\Inertia;

class PublicDocumentTrackingController extends Controller
{
    public function show(string $trackingNumber)
    {
        $document = Document::query()
            ->where('tracking_number', $trackingNumber)
            ->where('is_finalized', true)
            ->with([
                'office:id,name', 'documentType:id,name', 'purposeType:id,name',
                'trails.fromOffice:id,name', 'trails.toOffice:id,name',
                'latestRoute.fromOffice:id,name', 'latestRoute.steps.office:id,name',
                'routes.fromOffice:id,name', 'routes.steps.office:id,name',
            ])
            ->first();

        if ($document) {
            $routes = $document->routes;
            $rootRoute = $routes->whereNull('parent_step_id')->sortByDesc('id')->first();
            $hasPendingRoute = $routes->contains(fn ($route) => $route->status === 'pending');

            return Inertia::render('PublicTracking/Show', [
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
                    ])->values() ?? [],
                    'route_tree' => $this->serializeRouteTree($routes),
                    'document_type' => $document->other_document_type ?: $document->documentType?->name,
                    'purpose' => $document->other_purpose ?: $document->purposeType?->name,
                    'office_name' => $document->office?->name,
                    'created_at' => $document->created_at?->format('F j, Y g:i A'),
                    'trails' => $document->trails->sortBy([['created_at', 'desc'], ['id', 'desc']])->values()->map(fn ($trail) => [
                        'action' => $trail->action ?: ucfirst((string) $trail->status),
                        'status' => $trail->status,
                        'from_office' => $trail->fromOffice?->name,
                        'to_office' => $trail->toOffice?->name,
                        'created_at' => $trail->created_at?->format('F j, Y g:i A'),
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
                    'child_routes' => $routes->where('parent_step_id', $step->id)->sortBy('id')
                        ->map(fn ($childRoute) => $serializeRoute($childRoute))->values()->all(),
                ])->values()->all(),
            ];
        };

        return $routes->whereNull('parent_step_id')->sortBy('id')
            ->map(fn ($route) => $serializeRoute($route))->values()->all();
    }
}
