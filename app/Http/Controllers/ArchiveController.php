<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\Office;
use App\Services\DocumentAccess;
use Inertia\Inertia;

class ArchiveController extends Controller
{
    public function index()
    {
        $access = app(DocumentAccess::class);
        $canFilterOffices = $access->canViewAllDocuments(auth()->user());
        if (request()->filled('office_id')) {
            abort_unless($canFilterOffices, 403);
        }
        $filters = request()->validate([
            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'sort' => ['nullable', 'in:newest,oldest,bureau_asc,bureau_desc'],
        ]);
        $officeId = ! empty($filters['office_id']) ? (int) $filters['office_id'] : null;
        $sort = $filters['sort'] ?? 'newest';
        $query = $access->scope(Document::query(), auth()->user())
            ->select(['documents.id', 'documents.title', 'documents.tracking_number', 'documents.office_id'])
            ->with('office:id,name,short_name')
            ->where('is_archived', true)
            ->when($officeId !== null, fn ($q) => $q->where('office_id', $officeId));
        if (in_array($sort, ['bureau_asc', 'bureau_desc'], true)) {
            $query->orderBy(Office::select('name')->whereColumn('offices.id', 'documents.office_id')->limit(1), $sort === 'bureau_asc' ? 'asc' : 'desc');
        }
        $documents = $query->orderBy('documents.created_at', $sort === 'oldest' ? 'asc' : 'desc')
            ->orderBy('documents.id', $sort === 'oldest' ? 'asc' : 'desc')
            ->paginate(25)
            ->withQueryString();

        return Inertia::render('Archives/Index', [
            'documents' => $documents,
            'canFilterOffices' => $canFilterOffices,
            'offices' => $canFilterOffices ? Office::orderBy('name')->get(['id', 'name']) : [],
            'filters' => ['office_id' => $officeId, 'sort' => $sort],
        ]);
    }

    public function categories()
    {
        return Inertia::render('Archives/Index', [
            'title' => 'Archive Categories',
        ]);
    }
}
