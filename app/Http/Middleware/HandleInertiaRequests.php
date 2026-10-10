<?php

namespace App\Http\Middleware;

use App\Models\Office;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $authUser = $request->user();
        $authUserData = null;

        if ($authUser) {
            $authUserData = $authUser->toArray();
            $authUserData['short_name'] = trim(
                (filled($authUser->firstname) ? mb_substr(trim($authUser->firstname), 0, 1).'. ' : '').
                ($authUser->lastname ?? '')
            ) ?: $authUser->name;
            $office = $this->userOffice($authUser);
            $authUserData['office_short_name'] = $office?->short_name;
            $authUserData['office_display_name'] = trim((string) $office?->short_name)
                ?: ($office?->name ?: ($authUser->office_name ?: $authUser->division));
            $authUserData['range'] = $this->userRange($authUser);
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $authUserData,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'warning' => fn () => $request->session()->get('warning'),
            ],
            'canManageLibraries' => $request->user()?->canManageLibraries() ?? false,
            'ziggy' => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
        ];
    }

    private function userRange(User $user): ?string
    {
        $office = $this->userOffice($user);

        if ($office?->range) {
            return $office->range->name;
        }

        return null;
    }

    private function userOffice(User $user): ?Office
    {
        $office = $user->office_id
            ? Office::query()->with('range')->find($user->office_id)
            : null;

        if (! $office && filled($user->office_code)) {
            $office = Office::query()->with('range')->where('code', $user->office_code)->first();
        }

        return $office;
    }
}
