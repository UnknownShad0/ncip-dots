<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Inertia\Inertia;

class ArchiveController extends Controller
{
    public function index()
    {
        $documents = Document::with(['documentType', 'office', 'creator'])
            ->where('is_archived', true)
            ->latest()
            ->get();

        return Inertia::render('Archives/Index', [
            'documents' => $documents,
        ]);
    }

    public function categories()
    {
        return Inertia::render('Archives/Index', [
            'documents' => [],
            'title' => 'Archive Categories',
        ]);
    }
}
