<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_workflow_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('step_order');  // 1, 2, 3 ...
            $table->enum('status', ['waiting', 'active', 'completed'])->default('waiting');
            $table->text('notes')->nullable();          // note from the user when done
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        // Add workflow_enabled flag to tasks table
        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('workflow_enabled')->default(false)->after('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('workflow_enabled');
        });
        Schema::dropIfExists('task_workflow_steps');
    }
};
