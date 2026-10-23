<?php

namespace App\Services;

use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NavigationAccess
{
    private const MANAGED_ROLES = [
        2 => 'Executive',
        3 => 'Admin Staff',
    ];

    private const RESTRICTED_NAVIGATION_KEYS = [
        'user_accounts',
        'libraries',
        'email_notifications',
    ];

    private const LANDING_ROUTES = [
        'dashboard' => ['route' => 'dashboard'],
        'latest_documents' => ['route' => 'documents.latest'],
        'all_documents' => ['route' => 'documents.index'],
        'document_creation' => ['route' => 'document-creation.index'],
        'document_workflow' => ['route' => 'document-workflow.index'],
        'drafts' => ['route' => 'drafts.index'],
        'connected_systems' => ['route' => 'connected-systems.index'],
        'archived_documents' => ['route' => 'archives.index'],
        'user_accounts' => ['route' => 'user-accounts.index', 'requires_administrator' => true],
        'libraries' => ['route' => 'libraries.index', 'requires_administrator' => true],
        'email_notifications' => ['route' => 'email-integration.index', 'requires_administrator' => true],
        'audit_trails' => ['route' => 'audit-trail.index'],
    ];

    private const EXACT_ROUTE_ACCESS = [
        'dashboard' => ['dashboard'],
        'documents.latest' => ['latest_documents'],
        'documents.store' => ['all_documents', 'latest_documents'],
        'document-creation.preview-submission' => ['document_creation', 'drafts', 'document_workflow'],
        'document-creation.finalize' => ['document_creation', 'document_workflow'],
        'document-creation.update' => ['document_creation', 'drafts', 'document_workflow'],
        'document-creation.destroy' => ['document_creation', 'drafts'],
        'document-creation.archive' => ['document_creation', 'document_workflow', 'archived_documents'],
        'document-creation.restore' => ['document_creation', 'document_workflow', 'archived_documents'],
        'document-creation.index' => ['document_creation'],
        'approved-documents.index' => ['document_workflow'],
        'archives.restore' => ['archived_documents'],
        'document-fonts.show' => ['document_creation', 'latest_documents', 'all_documents', 'drafts', 'document_workflow'],
        'document-assets.show' => ['document_creation', 'latest_documents', 'all_documents', 'drafts', 'document_workflow'],
        'drip.index' => ['connected_systems'],
        'ipluma.index' => ['connected_systems'],
        'pdmis.index' => ['connected_systems'],
    ];

    private const ROUTE_PREFIX_ACCESS = [
        'documents.' => ['all_documents', 'latest_documents'],
        'document-creation.' => ['document_creation'],
        'document-workflow.' => ['document_workflow'],
        'drafts.' => ['drafts'],
        'archives.' => ['archived_documents'],
        'connected-systems.' => ['connected_systems'],
        'user-accounts.' => ['user_accounts'],
        'libraries.' => ['libraries'],
        'setup.' => ['libraries'],
        'offices.' => ['libraries'],
        'ranges.' => ['libraries'],
        'document-types.' => ['libraries'],
        'action-types.' => ['libraries'],
        'purpose-types.' => ['libraries'],
        'hris-employees.' => ['libraries'],
        'email-integration.' => ['email_notifications'],
        'gmail-integration.' => ['email_notifications'],
        'audit-trail.' => ['audit_trails'],
    ];

    public function groups(): array
    {
        return [
            ['label' => '', 'items' => [
                ['key' => 'dashboard', 'name' => 'Dashboard'],
            ]],
            ['label' => 'Documents', 'items' => [
                ['key' => 'latest_documents', 'name' => 'Latest documents'],
                ['key' => 'all_documents', 'name' => 'All documents'],
                ['key' => 'document_creation', 'name' => 'Document creation'],
                ['key' => 'document_workflow', 'name' => 'Document Workflow'],
                ['key' => 'drafts', 'name' => 'Drafts'],
            ]],
            ['label' => 'Connected systems', 'items' => [
                ['key' => 'connected_systems', 'name' => 'Connected systems'],
            ]],
            ['label' => 'Archives', 'items' => [
                ['key' => 'archived_documents', 'name' => 'Archived documents'],
            ]],
            ['label' => 'Administration', 'items' => [
                ['key' => 'user_accounts', 'name' => 'User accounts'],
                ['key' => 'libraries', 'name' => 'Libraries'],
                ['key' => 'email_notifications', 'name' => 'Email notifications'],
                ['key' => 'audit_trails', 'name' => 'Audit trails'],
            ]],
        ];
    }

    public function navigationKeys(): array
    {
        return collect($this->groups())
            ->flatMap(fn (array $group) => collect($group['items'])->pluck('key'))
            ->all();
    }

    public function accessKeysForRoute(?string $routeName): array
    {
        if ($routeName === null) {
            return [];
        }

        if (isset(self::EXACT_ROUTE_ACCESS[$routeName])) {
            return self::EXACT_ROUTE_ACCESS[$routeName];
        }

        foreach (self::ROUTE_PREFIX_ACCESS as $prefix => $keys) {
            if (str_starts_with($routeName, $prefix)) {
                return $keys;
            }
        }

        return [];
    }

    public function accessKeysForRequest(Request $request, User $user): ?array
    {
        $routeName = $request->route()?->getName();

        if (in_array($routeName, [
            'documents.details', 'documents.files.view', 'documents.files.download',
            'documents.approval', 'documents.update', 'documents.release', 'documents.receive',
            'documents.terminal', 'documents.destroy',
        ], true)) {
            $documentId = (int) ($request->route('document') ?? $request->route('id') ?? 0);
            $document = $documentId > 0
                ? Document::query()->find($documentId, [
                    'id', 'is_archived', 'created_at', 'status', 'is_finalized', 'legacy_needs_review',
                ])
                : null;

            if (! $document) {
                return null;
            }

            return $this->documentRouteAccessKeys($routeName, $document, $user);
        }

        if ($routeName === 'documents.index') {
            if ($request->integer('edit_draft_id') > 0) {
                return ['all_documents', 'drafts'];
            }

            if ($request->integer('open_document_id') > 0) {
                $keys = ['all_documents'];
                if ($this->isWorkflowDocument($user, $request->integer('open_document_id'))) {
                    $keys[] = 'document_workflow';
                }

                return $keys;
            }

            if ($request->integer('create_routing_draft_id') > 0) {
                return ['all_documents'];
            }

            return ['all_documents'];
        }

        if ($routeName === 'document-creation.index') {
            if ($request->filled('queue')) {
                return ['document_workflow'];
            }

            if ($request->integer('edit_draft_id') > 0) {
                return ['document_creation', 'drafts', 'document_workflow'];
            }
        }

        if ($routeName === null) {
            return null;
        }

        $keys = $this->accessKeysForRoute($routeName);

        return $keys === [] ? null : $keys;
    }

    private function isWorkflowDocument(User $user, int $documentId): bool
    {
        $query = Document::query()->whereKey($documentId)->where(function (Builder $workflow) use ($user): void {
            $workflow->where(function (Builder $submission) use ($user): void {
                $submission->where('created_by', $user->id)
                    ->whereIn('approval_status', ['awaiting_approval', 'changes_requested', 'rejected', 'approved']);
            });

            $officeId = app(DocumentAccess::class)->currentOfficeId($user);
            if ($user->is_active && $user->isAdministrator() && $officeId !== null) {
                $workflow->orWhere(function (Builder $approval) use ($user, $officeId): void {
                    $approval->where('approval_status', 'awaiting_approval')
                        ->where('is_archived', false)
                        ->where('legacy_needs_review', false)
                        ->where('created_by', '!=', $user->id)
                        ->whereHas('latestTrail', fn (Builder $trail) => $trail
                            ->where('status', 'pending')
                            ->where('to_office_id', $officeId));
                });
            }
        });

        return $query->exists();
    }

    private function documentRouteAccessKeys(string $routeName, Document $document, User $user): array
    {
        $keys = ['all_documents'];
        $isRecent = $document->created_at?->greaterThanOrEqualTo(now()->subDays(15)) ?? false;
        $isDraft = $document->status === 'draft'
            && ! $document->is_finalized
            && ! $document->legacy_needs_review
            && ! $document->is_archived;

        if (in_array($routeName, ['documents.details', 'documents.files.view', 'documents.files.download'], true)) {
            if ($isRecent) {
                $keys[] = 'latest_documents';
            }
            if ($document->is_archived) {
                $keys[] = 'archived_documents';
            }
            if ($this->isWorkflowDocument($user, (int) $document->id)) {
                $keys[] = 'document_workflow';
            }
        } elseif ($routeName === 'documents.approval') {
            if ($isRecent) {
                $keys[] = 'latest_documents';
            }
            if ($this->isWorkflowDocument($user, (int) $document->id)) {
                $keys[] = 'document_workflow';
            }
        } elseif (in_array($routeName, ['documents.update', 'documents.destroy'], true)) {
            if ($isDraft) {
                $keys[] = 'drafts';
            }
        } elseif (in_array($routeName, ['documents.release', 'documents.terminal'], true)) {
            if ($isRecent) {
                $keys[] = 'latest_documents';
            }
        } elseif ($routeName === 'documents.receive') {
            $keys[] = 'dashboard';
            if ($isRecent) {
                $keys[] = 'latest_documents';
            }
        }

        return $keys;
    }

    public function managedRoles(): array
    {
        return collect(self::MANAGED_ROLES)
            ->map(fn (string $name, int $roleId) => [
                'id' => $roleId,
                'name' => $name,
                'defaults' => $this->defaultVisibilityForRole($roleId),
                'visibility' => $this->visibilityForRole($roleId),
            ])
            ->values()
            ->all();
    }

    public function forUser(User $user): array
    {
        $visibility = $this->defaultVisibility($user->canManageLibraries() || $user->isSuperAdmin());

        if (in_array((int) $user->role_id, array_keys(self::MANAGED_ROLES), true)) {
            $saved = DB::table('role_navigation_visibility')
                ->where('role_id', $user->role_id)
                ->pluck('is_visible', 'navigation_key');

            foreach ($saved as $key => $isVisible) {
                if (array_key_exists($key, $visibility)) {
                    $visibility[$key] = (bool) $isVisible;
                }
            }
        }

        return $visibility;
    }

    public function visibilityForRole(int $roleId): array
    {
        $visibility = $this->defaultVisibilityForRole($roleId);
        $saved = DB::table('role_navigation_visibility')
            ->where('role_id', $roleId)
            ->pluck('is_visible', 'navigation_key');

        foreach ($saved as $key => $isVisible) {
            if (array_key_exists($key, $visibility)) {
                $visibility[$key] = (bool) $isVisible;
            }
        }

        return $visibility;
    }

    public function firstVisibleRoute(User $user): string
    {
        $visibility = $this->forUser($user);

        foreach (self::LANDING_ROUTES as $key => $destination) {
            if (! ($visibility[$key] ?? false)) {
                continue;
            }

            if (($destination['requires_administrator'] ?? false) && ! $user->canManageLibraries()) {
                continue;
            }

            return $destination['route'];
        }

        return 'profile.edit';
    }

    public function defaultVisibilityForRole(int $roleId): array
    {
        return $this->defaultVisibility(in_array($roleId, [1, 2], true));
    }

    private function defaultVisibility(bool $canManageLibraries): array
    {
        $visibility = array_fill_keys($this->navigationKeys(), true);

        if (! $canManageLibraries) {
            foreach (self::RESTRICTED_NAVIGATION_KEYS as $key) {
                $visibility[$key] = false;
            }
        }

        return $visibility;
    }
}
