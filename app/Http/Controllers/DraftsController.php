<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DocumentCreationDraft;
use App\Services\DocumentAccess;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DraftsController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $source = in_array($request->query('source'), ['tracking', 'generation'], true)
            ? $request->query('source')
            : 'tracking';
        $search = trim((string) $request->query('search', ''));

        if ($source === 'generation') {
            $query = DocumentCreationDraft::query()
                ->with('documentType:id,name')
                ->where('created_by', $user->id)
                ->where('status', 'draft');

            if ($search !== '') {
                $like = '%'.$search.'%';
                $query->where(function ($drafts) use ($like) {
                    $drafts->where('title', 'like', $like)
                        ->orWhereHas('documentType', fn ($type) => $type->where('name', 'like', $like));
                });
            }

            $page = $query->latest()->paginate(5)->withQueryString();
            $drafts = $page->getCollection()->map(fn (DocumentCreationDraft $draft) => [
                'id' => $draft->id,
                'source' => 'generation',
                'title' => $draft->title,
                'status' => $draft->status,
                'document_type' => $draft->documentType?->name,
                'created_at' => $draft->created_at?->toDateTimeString(),
            ])->values();
        } else {
            $access = app(DocumentAccess::class);
            $query = $access->scope(Document::query(), $user)
                ->where('documents.legacy_needs_review', false)
                ->where('documents.is_finalized', false)
                ->where('documents.is_archived', false)
                ->where('documents.status', 'draft');

            if (! $access->canViewAllDocuments($user)) {
                $query->where('documents.created_by', $user->id);
                if ($access->currentOfficeId($user) !== null) {
                    $query->where('documents.office_id', $access->currentOfficeId($user));
                } else {
                    $query->whereRaw('1 = 0');
                }
            }

            if ($search !== '') {
                $like = '%'.$search.'%';
                $query->where(function ($documents) use ($like) {
                    $documents->where('documents.title', 'like', $like)
                        ->orWhere('documents.tracking_number', 'like', $like)
                        ->orWhereHas('documentType', fn ($type) => $type->where('name', 'like', $like));
                });
            }

            $page = $query->with(['documentType:id,name', 'office:id,name,short_name'])
                ->latest('documents.created_at')
                ->paginate(5)
                ->withQueryString();
            $drafts = $page->getCollection()->map(fn (Document $document) => [
                'id' => $document->id,
                'source' => 'tracking',
                'title' => $document->title,
                'tracking_number' => $document->tracking_number,
                'status' => 'draft',
                'document_type' => $document->documentType?->name,
                'office' => $document->office?->short_name ?: $document->office?->name,
                'created_at' => $document->created_at?->toDateTimeString(),
            ])->values();
        }

        return Inertia::render('Drafts/Index', [
            'drafts' => $drafts,
            'pagination' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'source' => $source,
            'filters' => ['source' => $source, 'search' => $search],
        ]);
    }
}
