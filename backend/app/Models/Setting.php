<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = ['app_name', 'logo'];

    public static function current(): self
    {
        return static::firstOrCreate([], ['app_name' => 'Commandix']);
    }

    public function getLogoUrlAttribute(): ?string
    {
        return $this->logo ? asset('storage/' . $this->logo) : null;
    }
}
