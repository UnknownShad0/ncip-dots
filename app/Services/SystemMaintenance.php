<?php

namespace App\Services;

use App\Models\SystemMaintenanceSetting;
use App\Models\User;
use Illuminate\Support\Carbon;

class SystemMaintenance
{
    public const DEFAULT_MESSAGE = 'We are performing scheduled maintenance. Please try again later.';

    public function current(): ?SystemMaintenanceSetting
    {
        return SystemMaintenanceSetting::query()->find(1);
    }

    public function settings(): SystemMaintenanceSetting
    {
        return SystemMaintenanceSetting::query()->firstOrCreate(
            ['id' => 1],
            ['mode' => 'off', 'message' => self::DEFAULT_MESSAGE],
        );
    }

    public function activeMode(?SystemMaintenanceSetting $setting = null): ?string
    {
        $setting ??= $this->current();

        if (! $setting || $setting->mode === 'off') {
            return null;
        }

        $now = now();

        if ($setting->starts_at && $now->lt($setting->starts_at)) {
            return null;
        }

        if ($setting->ends_at && $now->gte($setting->ends_at)) {
            return null;
        }

        return $setting->mode;
    }

    public function forLayout(): ?array
    {
        $setting = $this->current();
        $mode = $this->activeMode($setting);

        if (! $setting || ! $mode) {
            return null;
        }

        return [
            'mode' => $mode,
            'message' => $setting->message,
            'endsAt' => $setting->ends_at?->copy()->timezone(config('app.timezone'))->format('M j, Y g:i A T'),
        ];
    }

    public function forManagement(?SystemMaintenanceSetting $setting = null): array
    {
        $setting ??= $this->settings();
        $now = now();
        $effectiveMode = $this->activeMode($setting);

        $status = match (true) {
            $setting->mode === 'off' => 'off',
            $setting->starts_at && $now->lt($setting->starts_at) => 'scheduled',
            $setting->ends_at && $now->gte($setting->ends_at) => 'ended',
            default => 'active',
        };

        return [
            'mode' => $setting->mode,
            'effectiveMode' => $effectiveMode,
            'status' => $status,
            'message' => $setting->message,
            'startsAt' => $setting->starts_at?->copy()->timezone(config('app.timezone'))->format('Y-m-d\\TH:i'),
            'endsAt' => $setting->ends_at?->copy()->timezone(config('app.timezone'))->format('Y-m-d\\TH:i'),
            'startsAtLabel' => $setting->starts_at?->copy()->timezone(config('app.timezone'))->format('M j, Y g:i A T'),
            'endsAtLabel' => $setting->ends_at?->copy()->timezone(config('app.timezone'))->format('M j, Y g:i A T'),
            'updatedAtLabel' => $setting->updated_at?->copy()->timezone(config('app.timezone'))->format('M j, Y g:i A T'),
            'updatedBy' => $setting->updater?->name,
        ];
    }

    public function toStorageTime(?string $value): ?Carbon
    {
        return $value === null
            ? null
            : Carbon::createFromFormat('Y-m-d\\TH:i', $value, config('app.timezone'));
    }

    public function snapshot(SystemMaintenanceSetting $setting): array
    {
        return [
            'mode' => $setting->mode,
            'message' => $setting->message,
            'starts_at' => $setting->starts_at?->toIso8601String(),
            'ends_at' => $setting->ends_at?->toIso8601String(),
        ];
    }
}
