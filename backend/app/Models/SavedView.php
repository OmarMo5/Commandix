<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SavedView extends Model
{
    protected $fillable = ['user_id', 'scope', 'name', 'filters'];

    protected function casts(): array
    {
        return ['filters' => 'array'];
    }
}
