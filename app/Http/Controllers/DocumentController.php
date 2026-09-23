<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function index()
    {
        $documents = Document::with(['documentType', 'office', 'creator'])
            ->latest()
            ->get();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'tracking_number' => ['required', 'string', 'max:100', 'unique:documents'],
            'status' => ['nullable', 'string'],
        ]);

        Document::create([
            ...$validated,
            'created_by' => auth()->id(),
            'status' => $validated['status'] ?? 'pending',
        ]);

        return redirect()->route('documents.index')->with('success', 'Document created successfully.');
    }
}
