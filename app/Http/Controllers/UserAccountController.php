<?php

namespace App\Http\Controllers;

use App\Models\User;
use Inertia\Inertia;

class UserAccountController extends Controller
{
    public function index()
    {
        $users = User::with(['office', 'division'])
            ->latest()
            ->get();

        return Inertia::render('UserAccounts/Index', [
            'users' => $users,
        ]);
    }
}
