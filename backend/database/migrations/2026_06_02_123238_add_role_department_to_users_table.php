<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('role_id')->nullable()->after('email');
            $table->unsignedBigInteger('department_id')->nullable()->after('role_id');
            $table->string('avatar')->nullable()->after('department_id');
            $table->boolean('is_active')->default(true)->after('avatar');
            $table->foreign('role_id')->references('id')->on('roles')->nullOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['role_id']);
            $table->dropForeign(['department_id']);
            $table->dropColumn(['role_id', 'department_id', 'avatar', 'is_active']);
        });
    }
};
