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

    public function libraries()
    {
        return $this->index();
    }

    public function agencies()
    {
        return $this->index();
    }

    public function offices()
    {
        return $this->index();
    }

    public function documentTypes()
    {
        return $this->index();
    }

    public function categories()
    {
        return $this->index();
    }

    public function actionTypes()
    {
        return $this->index();
    }

    public function purposeTypes()
    {
        return $this->index();
    }
}
