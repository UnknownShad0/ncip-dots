<?php

namespace App\Services;

use App\Models\User;

class DocumentMetadata
{
    public static function officeName(?User $creator): string
    {
        return $creator?->office?->name ?: 'NATIONAL COMMISSION ON INDIGENOUS PEOPLES';
    }

    public static function displayDate(?string $value): string
    {
        if ($value && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $parts)
            && checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1])) {
            return \DateTimeImmutable::createFromFormat('!Y-m-d', $value)->format('F d, Y');
        }

        return $value ?? '';
    }

    public static function present(array $content, ?User $creator): array
    {
        $content['footer_office_name'] ??= self::officeName($creator);
        $content['date'] = self::displayDate($content['date'] ?? null);

        return $content;
    }
}
