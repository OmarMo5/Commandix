<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('saved_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('scope', 32)->default('tasks');   // which page the view belongs to
            $table->string('name', 60);
            $table->json('filters');
            $table->timestamps();

            $table->unique(['user_id', 'scope', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('saved_views');
    }
};
