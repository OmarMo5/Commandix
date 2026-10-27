<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            // Set on a private group by its creator (or the Super Admin): hidden from the main
            // list and read-only until restored. Different from closed_at, which only the Super Admin sets.
            $table->timestamp('archived_at')->nullable()->after('closed_at');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('archived_at');
        });
    }
};
