<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Inbox triage: an item is in the inbox, parked in "Later" (optionally until a time), or cleared.
        Schema::table('notifications', function (Blueprint $table) {
            $table->timestamp('cleared_at')->nullable()->after('read_at');
            $table->timestamp('later_at')->nullable()->after('cleared_at');
            $table->timestamp('snoozed_until')->nullable()->after('later_at');

            $table->index(['user_id', 'cleared_at']);
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'cleared_at']);
            $table->dropColumn(['cleared_at', 'later_at', 'snoozed_until']);
        });
    }
};
