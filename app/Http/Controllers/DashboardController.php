<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\User;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $stats = [
            'total_documents' => Document::count(),
            'active_users' => User::where('is_active', true)->count(),
            'pending_documents' => Document::where('status', 'pending')->count(),
            'archived_documents' => Document::where('is_archived', true)->count(),
        ];

        $recentDocuments = Document::with(['documentType', 'office', 'creator'])
            ->latest()
            ->take(5)
            ->get();

        return Inertia::render('Dashboard', [
            'stats' => $stats,
            'recentDocuments' => $recentDocuments,
        ]);
    }
}
