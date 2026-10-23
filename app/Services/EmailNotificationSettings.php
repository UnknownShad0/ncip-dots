<?php

namespace App\Services;

use App\Models\EmailNotificationSetting;
use Illuminate\Support\Facades\Schema;

class EmailNotificationSettings
{
    private const SINGLETON_ID = 1;

    public function automatedEnabled(): bool
    {
        if (! Schema::hasTable('email_notification_settings')) {
            return false;
        }

        return (bool) EmailNotificationSetting::query()
            ->whereKey(self::SINGLETON_ID)
            ->value('automated_enabled');
    }

    public function setAutomatedEnabled(bool $enabled, ?int $updatedBy): EmailNotificationSetting
    {
        return EmailNotificationSetting::query()->updateOrCreate(
            ['id' => self::SINGLETON_ID],
            [
                'automated_enabled' => $enabled,
                'updated_by' => $updatedBy,
            ],
        );
    }
}
