<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use Inertia\Inertia;

class AuditTrailController extends Controller
{
    public function index()
    {
        $trail = AuditTrail::with('user')
            ->latest()
            ->take(50)
            ->get();

        return Inertia::render('AuditTrail/Index', [
            'trail' => $trail,
        ]);
    }
}
