<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Office;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

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

    public function scopeForOffices(Builder $query, array $officeIds): Builder
    {
        return $query->where(function (Builder $visible) use ($officeIds) {
            $visible->whereIn('office_id', $officeIds)
                ->orWhereHas('trails', fn (Builder $trails) => $trails
                    ->whereIn('from_office_id', $officeIds)
                    ->orWhereIn('to_office_id', $officeIds)
                    ->orWhereIn('holder_office_id', $officeIds)
                    ->orWhereIn('legacy_receiving_office_id', $officeIds));
        });
    }

    public function scope(Builder $query, User $user): Builder
    {
        if ($this->canViewAllDocuments($user)) {
            return $query;
        }

        $officeIds = $this->officeIds($user);
        $visibleDocumentIds = DB::table('documents')->select('id')->whereNotNull('legacy_doc_id')->where('created_by', $user->id)
            ->union(DB::table('documents')->select('id')->where('created_by', $user->id)->where('is_finalized', false)->where('status', 'draft'));
        if ($officeIds !== []) {
            $visibleDocumentIds = DB::table('documents')->select('id')->whereIn('office_id', $officeIds)
                ->union(DB::table('document_trails')->select('document_id')->whereIn('from_office_id', $officeIds))
                ->union(DB::table('document_trails')->select('document_id')->whereIn('to_office_id', $officeIds))
                ->union(DB::table('document_trails')->select('document_id')->whereIn('holder_office_id', $officeIds))
                ->union(DB::table('document_trails')->select('document_id')->whereIn('legacy_receiving_office_id', $officeIds))
                ->union($visibleDocumentIds);
        }

        // A joined ID union preserves the office and owner scope while letting
        // MySQL materialize indexable branches instead of evaluating a
        // correlated office-history OR for each candidate document.
        return $query->joinSub($visibleDocumentIds, 'document_access_scope', 'document_access_scope.id', '=', 'documents.id');
    }
}
