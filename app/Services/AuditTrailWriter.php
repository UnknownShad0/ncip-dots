<?php

namespace App\Services;

use App\Models\AuditTrail;
use App\Models\Office;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditTrailWriter
{
    public function record(
        string $action,
        ?Model $subject = null,
        array|string|null $details = null,
        string $result = 'success',
        ?User $actor = null,
    ): AuditTrail {
        $actor ??= auth()->user();
        $officeId = $actor?->office_id;
        $officeName = $officeId ? Office::query()->whereKey($officeId)->value('name') : null;

        return AuditTrail::query()->create([
            'user_id' => $actor?->id,
            'actor_name' => $actor?->name,
            'actor_office_id' => $officeId,
            'actor_office_name' => $officeName,
            'action' => $action,
            'model_type' => $subject ? $subject::class : null,
            'model_id' => $subject?->getKey(),
            'details' => is_array($details)
                ? json_encode($details, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)
                : $details,
            'result' => $result,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
