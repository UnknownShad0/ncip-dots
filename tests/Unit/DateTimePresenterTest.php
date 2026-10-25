<?php

namespace Tests\Unit;

use App\Support\DateTimePresenter;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class DateTimePresenterTest extends TestCase
{
    public function test_it_converts_utc_timestamps_to_philippine_time(): void
    {
        config(['app.display_timezone' => 'Asia/Manila']);
        $utc = CarbonImmutable::create(2026, 10, 25, 0, 30, 0, 'UTC');

        $this->assertSame(
            'October 25, 2026 8:30 AM PHT',
            DateTimePresenter::formatWithLabel($utc, 'F j, Y g:i A'),
        );
    }

    public function test_null_timestamps_remain_null(): void
    {
        $this->assertNull(DateTimePresenter::format(null, 'F j, Y g:i A'));
        $this->assertNull(DateTimePresenter::formatWithLabel(null, 'F j, Y g:i A'));
    }
}
