<?php

namespace App\Services;

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
        return $user->office_id ? [(int) $user->office_id] : [];
    }

    public function currentOfficeId(User $user): ?int
    {
        return $user->office_id ? (int) $user->office_id : ($this->officeIds($user)[0] ?? null);
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
