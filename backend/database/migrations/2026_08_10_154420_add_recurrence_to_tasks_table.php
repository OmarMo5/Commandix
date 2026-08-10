<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('recurrence')->nullable()->after('workflow_enabled'); // daily|weekly|monthly
            $table->date('recurrence_end_date')->nullable()->after('recurrence');
            $table->foreignId('recurrence_parent_id')->nullable()->after('recurrence_end_date')
                ->constrained('tasks')->nullOnDelete();
            $table->date('last_generated_at')->nullable()->after('recurrence_parent_id');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropConstrainedForeignId('recurrence_parent_id');
            $table->dropColumn(['recurrence', 'recurrence_end_date', 'last_generated_at']);
        });
    }
};
