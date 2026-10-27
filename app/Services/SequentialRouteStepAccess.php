<?php

namespace App\Services;

use App\Models\DocumentRoute;
use App\Models\DocumentRouteStep;

class SequentialRouteStepAccess
{
    public function canAccess(DocumentRoute $route, DocumentRouteStep $step): bool
    {
        if ($route->mode !== 'sequential') {
            return true;
        }

        if (in_array($step->status, ['in_progress', 'waiting_on_branch'], true) && $step->received_at !== null) {
            return true;
        }

        return ! $route->steps->where('position', '<', $step->position)
            ->contains(fn (DocumentRouteStep $previous) => $previous->status !== 'approved');
    }
}
