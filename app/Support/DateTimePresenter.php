<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;

final class DateTimePresenter
{
    public static function timezone(): string
    {
        return (string) config('app.display_timezone', 'Asia/Manila');
    }

    public static function format(DateTimeInterface|string|null $value, string $format): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $date = $value instanceof DateTimeInterface
            ? CarbonImmutable::instance($value)
            : CarbonImmutable::parse($value);

        return $date->setTimezone(self::timezone())->format($format);
    }

    public static function formatWithLabel(DateTimeInterface|string|null $value, string $format): ?string
    {
        $formatted = self::format($value, $format);

        return $formatted === null ? null : $formatted.' PHT';
    }
}
