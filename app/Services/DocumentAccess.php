<?php

namespace App\Services;

use App\Models\BureauLegacy;
use App\Models\Document;
use App\Models\Office;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class DocumentAccess
{
    public function canViewAllDocuments(User $user): bool
    {
        if (in_array((int) $user->role_id, [1, 2], true)) {
            return true;
        }

        $role = strtolower(trim(preg_replace('/[_-]+/', ' ', (string) $user->role) ?? ''));

        return in_array($role, ['system admin', 'executive', 'executives'], true);
    }

    public function officeIds(User $user): array
    {
        $officeIds = collect([$user->office_id])->filter()->map(fn ($id) => (int) $id);

        if ($user->legacy_office_id && !$user->office_id) {
            try {
                $officeName = BureauLegacy::query()->where('bureauId', $user->legacy_office_id)->value('longName');
                if ($officeName) {
                    $officeIds = $officeIds->merge(Office::query()->where('name', $officeName)->pluck('id'));
                }
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $officeIds->unique()->values()->all();
    }

    public function currentOfficeId(User $user): ?int
    {
        return $user->office_id ? (int) $user->office_id : ($this->officeIds($user)[0] ?? null);
    }

    public function legacyBureauId(User $user): ?int
    {
        if ($user->legacy_office_id) {
            return (int) $user->legacy_office_id;
        }

        $officeName = $user->office?->name;
        if (!$officeName) {
            return null;
        }

        try {
            $id = BureauLegacy::query()->where('longName', $officeName)->value('bureauId');
        } catch (\Throwable $exception) {
            report($exception);

            return null;
        }

        return $id === null ? null : (int) $id;
    }

    public function scope(Builder $query, User $user): Builder
    {
        if ($this->canViewAllDocuments($user)) {
            return $query;
        }

        $officeIds = $this->officeIds($user);

        return $query->where(function (Builder $visible) use ($officeIds, $user) {
            if ($officeIds !== []) {
                $visible->whereIn('office_id', $officeIds)
                    ->orWhereHas('trails', fn (Builder $trails) => $trails
                        ->whereIn('from_office_id', $officeIds)
                        ->orWhereIn('to_office_id', $officeIds)
                        ->orWhereIn('holder_office_id', $officeIds)
                        ->orWhereIn('legacy_receiving_office_id', $officeIds));
            }

            $visible->orWhere(function (Builder $importedOwner) use ($user) {
                $importedOwner->whereNotNull('legacy_doc_id')->where('created_by', $user->id);
            });

            $visible->orWhere(function (Builder $ownDraft) use ($user) {
                $ownDraft->where('created_by', $user->id)
                    ->where('is_finalized', false)
                    ->where('status', 'draft');
            });
        });
    }
}
