<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A message can tag several people (typed with @); this replaces the single task_comments.mentioned_user_id.
        Schema::create('comment_mentions', function (Blueprint $table) {
            $table->foreignId('comment_id')->constrained('task_comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['comment_id', 'user_id']);
        });

        // Carry over every existing single mention. (The old column stays in place, no longer written.)
        DB::table('task_comments')->whereNotNull('mentioned_user_id')->orderBy('id')->each(function ($comment) {
            DB::table('comment_mentions')->insertOrIgnore([
                'comment_id' => $comment->id,
                'user_id' => $comment->mentioned_user_id,
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_mentions');
    }
};
