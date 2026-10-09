<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use Inertia\Inertia;

class AuditTrailController extends Controller
{
    public function index()
    {
        $trail = AuditTrail::with('user:id,name,firstname,lastname')
            ->latest()
            ->take(50)
            ->get()
            ->each(function (AuditTrail $entry) {
                if ($entry->user) {
                    $entry->user->setAttribute('short_name', trim(
                        (filled($entry->user->firstname) ? mb_substr(trim($entry->user->firstname), 0, 1).'. ' : '').
                        ($entry->user->lastname ?? '')
                    ) ?: $entry->user->name);
                }
            });

        return Inertia::render('AuditTrail/Index', [
            'trail' => $trail,
        ]);
    }
}
