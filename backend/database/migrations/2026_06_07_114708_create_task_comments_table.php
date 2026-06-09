<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('parent_id')->nullable();  // for replies
            $table->text('content');
            $table->boolean('is_question')->default(false);       // true = question, false = comment
            $table->boolean('is_answered')->default(false);       // question resolved flag
            $table->timestamps();

            $table->foreign('parent_id')->references('id')->on('task_comments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_comments');
    }
};
