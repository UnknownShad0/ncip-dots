<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HrisEmployee extends Model
{
    protected $fillable = [
        'hris_employee_id', 'employee_code', 'username', 'email_address',
        'first_name', 'middle_name', 'last_name', 'ext_name',
        'division_code', 'division', 'position', 'designation',
        'employment_status', 'start_date', 'end_date',
        'signatory_name', 'signatory_designation', 'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'hris_employee_id' => 'integer',
            'start_date' => 'date',
            'end_date' => 'date',
            'last_synced_at' => 'datetime',
        ];
    }

    public function displayName(): string
    {
        return trim(implode(' ', array_filter([
            $this->first_name,
            $this->middle_name,
            $this->last_name,
            $this->ext_name,
        ], fn ($part) => filled($part))));
    }
}
