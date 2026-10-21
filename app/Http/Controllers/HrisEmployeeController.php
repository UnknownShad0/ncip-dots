<?php

namespace App\Http\Controllers;

use App\Models\HrisEmployee;
use App\Models\HrisEmployeeSync;
use App\Services\HrisEmployeeSynchronizer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Throwable;

class HrisEmployeeController extends Controller
{
    public function index(Request $request)
    {
        $search = mb_substr(trim((string) $request->query('search', '')), 0, 100);
        $employees = HrisEmployee::query();

        foreach (preg_split('/\s+/u', $search, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $term) {
            $pattern = '%'.$term.'%';
            $employees->where(fn ($matches) => $matches
                ->where('employee_code', 'like', $pattern)
                ->orWhere('first_name', 'like', $pattern)
                ->orWhere('middle_name', 'like', $pattern)
                ->orWhere('last_name', 'like', $pattern)
                ->orWhere('ext_name', 'like', $pattern)
                ->orWhere('username', 'like', $pattern)
                ->orWhere('signatory_name', 'like', $pattern)
                ->orWhere('division', 'like', $pattern)
                ->orWhere('position', 'like', $pattern));
        }

        $latestSync = HrisEmployeeSync::query()->latest('id')->first();
        $lastSuccessfulSync = HrisEmployeeSync::query()->where('status', 'succeeded')->latest('id')->first();

        return Inertia::render('HrisEmployees/Index', [
            'employees' => $employees->orderBy('last_name')->orderBy('first_name')->paginate(25, [
                'id', 'employee_code', 'username', 'first_name', 'middle_name', 'last_name', 'ext_name',
                'division', 'position', 'employment_status', 'last_synced_at',
            ])->withQueryString(),
            'filters' => ['search' => $search],
            'latestSync' => $latestSync?->only([
                'id', 'status', 'records_received', 'records_created', 'records_updated', 'error_summary', 'started_at', 'finished_at',
            ]),
            'lastSuccessfulSync' => $lastSuccessfulSync?->only(['records_received', 'finished_at']),
            'directoryCount' => HrisEmployee::query()->count(),
        ]);
    }

    public function sync(Request $request, HrisEmployeeSynchronizer $synchronizer)
    {
        try {
            $sync = $synchronizer->sync($request->user()->id);
            $newEmployees = $sync->records_created === 1
                ? '1 new employee added'
                : number_format($sync->records_created).' new employees added';

            return redirect()->route('hris-employees.index')->with(
                'success',
                number_format($sync->records_received)." employees synced to the local library; {$newEmployees}.",
            );
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->route('hris-employees.index')->with('warning', $exception->getMessage());
        }
    }
}
