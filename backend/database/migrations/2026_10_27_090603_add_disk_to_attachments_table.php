<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            // 'public' = legacy files served straight from /storage; 'local' = private disk, download only through the API.
            $table->string('disk', 20)->default('public')->after('file_path');
        });
    }

    public function down(): void
    {
        Schema::table('attachments', function (Blueprint $table) {
            $table->dropColumn('disk');
        });
    }
};
