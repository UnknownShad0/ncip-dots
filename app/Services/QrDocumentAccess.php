<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentRoute;
use App\Models\DocumentRouteStep;
use App\Models\User;

class QrDocumentAccess
{
    /** @return array{0: DocumentRoute, 1: DocumentRouteStep}|null */
    public function findStep(Document $document, int $officeId, string|array $statuses): ?array
    {
        $statuses = (array) $statuses;
        $routes = $document->relationLoaded('routes')
            ? $document->routes
            : $document->routes()->with('steps')->get();

        foreach ($routes->sortByDesc('id') as $route) {
            if ($route->status !== 'pending') {
                continue;
            }

            $step = $route->steps->first(fn (DocumentRouteStep $candidate) => (int) $candidate->office_id === $officeId && in_array($candidate->status, $statuses, true)
            );
            if (! $step) {
                continue;
            }

            if ($route->mode === 'sequential'
                && $route->steps->where('position', '<', $step->position)
                    ->contains(fn (DocumentRouteStep $previous) => $previous->status !== 'approved')) {
                continue;
            }

            return [$route, $step];
        }

        return null;
    }

    /** @return array{0: DocumentRoute, 1: DocumentRouteStep}|null */
    public function eligibleStep(Document $document, User $user): ?array
    {
        if (! $user->is_active || $user->is_locked || ! $user->office_id
            || $document->is_archived || $document->legacy_needs_review) {
            return null;
        }

        $step = $this->findStep($document, (int) $user->office_id, ['available', 'in_progress']);
        if (! $step) {
            return null;
        }

        [, $routeStep] = $step;
        if ($routeStep->status === 'available' && ! $user->canReceiveDocuments()) {
            return null;
        }

        if ($routeStep->status === 'in_progress' && ! $user->canReceiveDocuments() && ! $user->isAdministrator()) {
            return null;
        }

        return $step;
    }

    public function canApprove(Document $document, User $user, DocumentRouteStep $step): bool
    {
        return $user->is_active
            && $user->isAdministrator()
            && (int) $document->created_by !== (int) $user->id
            && $document->approval_status === 'awaiting_approval'
            && $step->status === 'in_progress';
    }
}
