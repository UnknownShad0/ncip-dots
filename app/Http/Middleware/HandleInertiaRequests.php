<?php

namespace App\Http\Middleware;

use App\Models\BureauLegacy;
use App\Models\Office;
use App\Models\RangeLegacy;
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
        $office = $user->office_id
            ? Office::query()->with('range')->find($user->office_id)
            : null;

        if (! $office && filled($user->office_code)) {
            $office = Office::query()->with('range')->where('code', $user->office_code)->first();
        }

        if ($office?->legacy_range_id) {
            $rangeName = RangeLegacy::query()->whereKey($office->legacy_range_id)->value('name');
            if (filled($rangeName)) {
                return $rangeName;
            }
        }

        if ($office?->range) {
            return $office->range->name;
        }

        if (! $user->legacy_office_id) {
            return null;
        }

        $rangeValue = trim((string) BureauLegacy::query()->whereKey($user->legacy_office_id)->value('range'));
        if ($rangeValue === '') {
            return null;
        }

        return ctype_digit($rangeValue)
            ? RangeLegacy::query()->whereKey((int) $rangeValue)->value('name')
            : RangeLegacy::query()->whereRaw('LOWER(name) = ?', [mb_strtolower($rangeValue)])->value('name');
    }
}
