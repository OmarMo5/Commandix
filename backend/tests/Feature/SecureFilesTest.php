<?php

namespace Tests\Feature;

use App\Models\Attachment;
use App\Models\Task;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class SecureFilesTest extends ApiTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    private function upload($user, Task $task, string $name = 'plan.pdf')
    {
        return $this->actAs($user)->post(
            "/api/v1/tasks/{$task->id}/attachments",
            ['file' => UploadedFile::fake()->create($name, 20, 'application/pdf')],
            ['Accept' => 'application/json']
        );
    }

    public function test_new_uploads_go_to_the_private_disk_and_expose_no_public_url(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member]);

        $response = $this->upload($member, $group)->assertCreated()->assertJsonMissingPath('url');
        $attachment = Attachment::findOrFail($response->json('id'));

        $this->assertSame('local', $attachment->disk);
        Storage::disk('local')->assertExists($attachment->file_path);
        Storage::disk('public')->assertMissing($attachment->file_path);
    }

    public function test_group_files_download_for_members_and_super_admin_only(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $outsider = $this->makeUser('employee');
        $admin = $this->makeUser('admin');
        $super = $this->makeUser('super_admin');
        $group = $this->makeGroup($creator, [$member]);

        $id = $this->upload($member, $group)->json('id');

        $this->actAs($creator)->get("/api/v1/attachments/{$id}/download")->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->actAs($member)->get("/api/v1/attachments/{$id}/download")->assertOk();
        $this->actAs($super)->get("/api/v1/attachments/{$id}/download")->assertOk();

        $this->actAs($outsider)->getJson("/api/v1/attachments/{$id}/download")->assertForbidden();
        $this->actAs($admin)->getJson("/api/v1/attachments/{$id}/download")->assertForbidden();
    }

    public function test_downloads_require_authentication(): void
    {
        $creator = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$this->makeUser('employee')]);
        $id = $this->upload($creator, $group)->json('id');

        // A fresh request with no token at all.
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/v1/attachments/{$id}/download")->assertUnauthorized();
    }

    public function test_normal_task_files_follow_task_access_and_the_uploader_keeps_access(): void
    {
        $dept = $this->department();
        $manager = $this->makeUser('manager', $dept);
        $assignee = $this->makeUser('employee', $dept);
        $stranger = $this->makeUser('employee', $this->department('Other'));
        $task = Task::create(['title' => 'Normal', 'creator_id' => $manager->id, 'department_id' => $dept->id]);
        $task->assignees()->attach($assignee->id);

        $id = $this->upload($assignee, $task)->json('id');

        $this->actAs($manager)->get("/api/v1/attachments/{$id}/download")->assertOk();
        $this->actAs($assignee)->get("/api/v1/attachments/{$id}/download")->assertOk();
        $this->actAs($stranger)->getJson("/api/v1/attachments/{$id}/download")->assertForbidden();

        // Removed from the task afterwards, the uploader can still fetch their own file…
        $task->assignees()->detach($assignee->id);
        $this->actAs($assignee)->get("/api/v1/attachments/{$id}/download")->assertOk();
    }

    public function test_missing_files_return_404_and_deleting_removes_the_stored_file(): void
    {
        $creator = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$this->makeUser('employee')]);
        $attachment = Attachment::findOrFail($this->upload($creator, $group)->json('id'));

        Storage::disk('local')->delete($attachment->file_path);
        $this->actAs($creator)->getJson("/api/v1/attachments/{$attachment->id}/download")->assertNotFound();

        $second = Attachment::findOrFail($this->upload($creator, $group, 'again.pdf')->json('id'));
        $this->actAs($creator)->deleteJson("/api/v1/attachments/{$second->id}")->assertOk();
        Storage::disk('local')->assertMissing($second->file_path);
    }

    public function test_secure_existing_moves_legacy_public_files_to_the_private_disk(): void
    {
        $user = $this->makeUser('admin');
        $task = Task::create(['title' => 'Old', 'creator_id' => $user->id]);

        Storage::disk('public')->put('attachments/1/old.pdf', 'legacy-bytes');
        $legacy = Attachment::create([
            'task_id' => $task->id, 'user_id' => $user->id, 'file_name' => 'old.pdf',
            'file_path' => 'attachments/1/old.pdf', 'file_type' => 'application/pdf', 'file_size' => 12,
        ]);
        $this->assertSame('public', $legacy->fresh()->disk);

        $this->artisan('attachments:secure-existing', ['--dry-run' => true])->assertSuccessful();
        Storage::disk('public')->assertExists('attachments/1/old.pdf');

        $this->artisan('attachments:secure-existing')->assertSuccessful();

        $this->assertSame('local', $legacy->fresh()->disk);
        Storage::disk('local')->assertExists('attachments/1/old.pdf');
        Storage::disk('public')->assertMissing('attachments/1/old.pdf');
        $this->actAs($user)->get("/api/v1/attachments/{$legacy->id}/download")->assertOk();
    }

    public function test_deleting_a_group_removes_the_files_of_the_group_and_its_tasks(): void
    {
        $creator = $this->makeUser('employee');
        $member = $this->makeUser('employee');
        $group = $this->makeGroup($creator, [$member]);
        $sub = Task::find($this->actAs($member)->postJson("/api/v1/tasks/{$group->id}/subtasks", [
            'title' => 'Child', 'assignees' => [$member->id],
        ])->json('id'));

        $onGroup = Attachment::findOrFail($this->upload($creator, $group)->json('id'));
        $onChild = Attachment::findOrFail($this->upload($member, $sub, 'child.pdf')->json('id'));

        $this->actAs($creator)->deleteJson("/api/v1/tasks/{$group->id}")->assertOk();

        Storage::disk('local')->assertMissing($onGroup->file_path);
        Storage::disk('local')->assertMissing($onChild->file_path);
        $this->assertSame(0, Attachment::count());
    }
}
