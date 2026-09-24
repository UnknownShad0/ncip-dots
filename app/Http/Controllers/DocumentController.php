<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function index()
    {
        $documents = Document::with('office')
            ->latest()
            ->get()
            ->map(function ($doc) {
                return [
                    'id' => $doc->id,
                    'tracking_number' => $doc->tracking_number,
                    'title' => $doc->title,
                    'status' => $doc->status,
                    'office' => [
                        'name' => $doc->office?->name,
                    ],
                ];
            });

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
        ]);
    }

    public function incoming()
    {
        $documents = Document::with(['documentType', 'office', 'creator'])
            ->where('status', 'pending')
            ->latest()
            ->get();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'title' => 'Incoming Documents',
        ]);
    }

    public function outgoing()
    {
        $documents = Document::with(['documentType', 'office', 'creator'])
            ->where('status', 'processed')
            ->latest()
            ->get();

        return Inertia::render('Documents/Index', [
            'documents' => $documents,
            'title' => 'Outgoing Documents',
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
