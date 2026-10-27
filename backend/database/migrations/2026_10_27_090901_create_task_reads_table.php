<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per (member, chat): "I have read up to comment N". Drives unread
        // counters now and the "seen by" markers on messages.
        Schema::create('task_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('task_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('last_read_comment_id')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'task_id']);
        });

        $this->backfillExistingChats();
    }

    /**
     * Everything already in a private chat is considered read by its current members,
     * so the first deploy doesn't show a wall of "unread" for old conversations.
     */
    private function backfillExistingChats(): void
    {
        $now = now();

        DB::table('tasks')->where('is_private', true)->orderBy('id')->each(function ($task) use ($now) {
            $lastComment = DB::table('task_comments')->where('task_id', $task->id)->max('id');
            if (!$lastComment) {
                return;
            }

            // Members of a group chat = its creator + assignees; a sub-task is visible to the whole parent group.
            $groupId = $task->parent_group_id ?: $task->id;
            $memberIds = DB::table('task_assignees')->where('task_id', $groupId)->pluck('user_id')
                ->push(DB::table('tasks')->where('id', $groupId)->value('creator_id'))
                ->push($task->creator_id)
                ->filter()->unique();

            DB::table('task_reads')->insertOrIgnore(
                $memberIds->map(fn($userId) => [
                    'user_id' => $userId, 'task_id' => $task->id,
                    'last_read_comment_id' => $lastComment, 'created_at' => $now, 'updated_at' => $now,
                ])->all()
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_reads');
    }
};
