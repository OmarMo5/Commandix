<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Requires a real server cron entry running `php artisan schedule:run` every minute
// to actually fire in production — this alone is not enough on its own.
Schedule::command('tasks:generate-recurring')->daily();
