<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $fillable = [
        'name', 'email', 'password', 'role_id', 'department_id', 'avatar', 'is_active',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'locked_until' => 'datetime',
        ];
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function assignedTasks()
    {
        return $this->belongsToMany(Task::class, 'task_assignees');
    }

    public function createdTasks()
    {
        return $this->hasMany(Task::class, 'creator_id');
    }

    public function notifications()
    {
        return $this->hasMany(TaskNotification::class);
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) return true;
        if (!$this->role) return false;
        return $this->role->permissions()->where('name', $permission)->exists();
    }

    public function isAdmin(): bool
    {
        return $this->role?->name === 'admin';
    }

    public function isSuperAdmin(): bool
    {
        return $this->role?->name === 'super_admin';
    }

    public function isAdminOrAbove(): bool
    {
        return $this->isAdmin() || $this->isSuperAdmin();
    }

    public function isManager(): bool
    {
        return $this->role?->name === 'manager';
    }

    /**
     * The avatar is stored as a path on the public disk but always *served* as a full URL,
     * so every endpoint that embeds a user (assignees, comments, members…) renders a working <img>.
     * Writes still take the raw path: `$user->update(['avatar' => 'avatars/x.png'])`.
     */
    public function getAvatarAttribute(?string $value): ?string
    {
        if (!$value) {
            return null;
        }

        return str_starts_with($value, 'http') ? $value : asset('storage/' . $value);
    }

    public function getAvatarUrlAttribute(): ?string
    {
        return $this->avatar;
    }
}
