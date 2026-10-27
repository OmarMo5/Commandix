<?php

namespace Tests\Feature;

use App\Models\Task;

class AvatarsTest extends ApiTestCase
{
    public function test_avatars_are_full_urls_everywhere_a_user_is_embedded(): void
    {
        $dept = $this->department();
        $viewer = $this->makeUser('employee', $dept);
        $pic = $this->makeUser('employee', $dept, ['avatar' => 'avatars/me.png']);
        $creator = $this->makeUser('manager', $dept);
        $task = Task::create(['title' => 'T', 'creator_id' => $creator->id, 'department_id' => $dept->id]);
        $task->assignees()->attach([$pic->id, $viewer->id]);

        $expected = asset('storage/avatars/me.png');

        $dir = collect($this->actAs($viewer)->getJson('/api/v1/users/directory')->json())->firstWhere('id', $pic->id);
        $this->assertSame($expected, $dir['avatar']);

        $assignees = collect($this->actAs($viewer)->getJson("/api/v1/tasks/{$task->id}")->json('assignees'))->keyBy('id');
        $this->assertSame($expected, $assignees[$pic->id]['avatar']);
        $this->assertNull($assignees[$viewer->id]['avatar'], 'no avatar stays null');

        $this->actAs($pic)->getJson('/api/v1/auth/me')->assertJsonPath('avatar', $expected);
    }
}
