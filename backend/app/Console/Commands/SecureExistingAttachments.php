<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\AttachmentController;
use App\Models\Attachment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class SecureExistingAttachments extends Command
{
    protected $signature = 'attachments:secure-existing {--dry-run : Show what would move without touching anything}';

    protected $description = 'Move attachments uploaded before secure downloads (public disk) onto the private disk';

    public function handle(): int
    {
        $public = Storage::disk('public');
        $private = Storage::disk(AttachmentController::DISK);
        $dry = $this->option('dry-run');

        $moved = $missing = 0;

        Attachment::where('disk', 'public')->each(function (Attachment $attachment) use ($public, $private, $dry, &$moved, &$missing) {
            if (!$public->exists($attachment->file_path)) {
                $this->warn("Missing on disk, skipped: #{$attachment->id} {$attachment->file_path}");
                $missing++;

                return;
            }

            if (!$dry) {
                $private->put($attachment->file_path, $public->get($attachment->file_path));
                $attachment->update(['disk' => AttachmentController::DISK]);
                $public->delete($attachment->file_path);
            }

            $moved++;
        });

        $this->info(($dry ? '[dry run] Would move ' : 'Moved ') . "{$moved} file(s) to the private disk; {$missing} missing.");

        return self::SUCCESS;
    }
}
