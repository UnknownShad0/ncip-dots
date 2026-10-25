<?php

namespace App\Services;

use App\Models\SystemMaintenanceSetting;
use App\Models\User;
use App\Support\DateTimePresenter;
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
            'endsAt' => DateTimePresenter::formatWithLabel($setting->ends_at, 'M j, Y g:i A'),
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
            'startsAt' => DateTimePresenter::format($setting->starts_at, 'Y-m-d\\TH:i'),
            'endsAt' => DateTimePresenter::format($setting->ends_at, 'Y-m-d\\TH:i'),
            'startsAtLabel' => DateTimePresenter::formatWithLabel($setting->starts_at, 'M j, Y g:i A'),
            'endsAtLabel' => DateTimePresenter::formatWithLabel($setting->ends_at, 'M j, Y g:i A'),
            'updatedAtLabel' => DateTimePresenter::formatWithLabel($setting->updated_at, 'M j, Y g:i A'),
            'updatedBy' => $setting->updater?->name,
        ];
    }

    public function toStorageTime(?string $value): ?Carbon
    {
        return $value === null
            ? null
            : Carbon::createFromFormat('Y-m-d\\TH:i', $value, DateTimePresenter::timezone())->utc();
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
