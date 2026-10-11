<?php

namespace App\Http\Controllers;

use App\Models\DocumentType;
use App\Services\AuditTrailWriter;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocumentTypeController extends Controller
{
    public function index()
    {
        $newDocumentTypes = DocumentType::query()
            ->select(['id', 'name', 'code', 'description', 'is_active'])
            ->orderBy('name')
            ->get()
            ->map(function ($documentType) {
                return [
                    'id' => $documentType->id,
                    'name' => $documentType->name,
                    'code' => $documentType->code ?? '',
                    'description' => $documentType->description ?? '',
                    'is_active' => (int) ($documentType->is_active ?? 1),
                    'source' => 'New DB',
                ];
            });

        return Inertia::render('DocumentTypes/Index', [
            'documentTypes' => $newDocumentTypes->toArray(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $documentType = DocumentType::create([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => auth()->id(),
        ]);
        app(AuditTrailWriter::class)->record('library.document_type_created', $documentType, $documentType->only(['name', 'code', 'description', 'is_active']));

        return redirect()->route('document-types.index')->with('success', 'Document type added.');
    }

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['required', 'boolean'],
        ]);

        $documentType = DocumentType::findOrFail($id);
        $before = $documentType->only(['name', 'code', 'description', 'is_active']);

        $documentType->update([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'],
            'created_by' => auth()->id(),
        ]);
        app(AuditTrailWriter::class)->record('library.document_type_updated', $documentType, [
            'before' => $before,
            'after' => $documentType->only(array_keys($before)),
        ]);

        return redirect()->route('document-types.index')->with('success', 'Document type updated.');
    }
}
