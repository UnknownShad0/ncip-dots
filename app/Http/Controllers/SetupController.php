<?php

namespace App\Http\Controllers;

use App\Models\ActionType;
use App\Models\DocumentType;
use App\Models\Office;
use App\Models\PurposeType;
use Inertia\Inertia;

class SetupController extends Controller
{
    public function index()
    {
        return Inertia::render('Setup/Index', [
            'offices' => Office::latest()->take(10)->get(),
            'documentTypes' => DocumentType::latest()->take(10)->get(),
            'actionTypes' => ActionType::latest()->take(10)->get(),
            'purposeTypes' => PurposeType::latest()->take(10)->get(),
        ]);
    }
}
