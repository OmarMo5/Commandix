<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            // Stamped by tasks:notify-due so each reminder fires once; cleared when the due date changes.
            $table->timestamp('due_reminder_sent_at')->nullable()->after('due_date');
            $table->timestamp('overdue_notified_at')->nullable()->after('due_reminder_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['due_reminder_sent_at', 'overdue_notified_at']);
        });
    }
};
