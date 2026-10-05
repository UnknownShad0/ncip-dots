<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'username',
        'firstname',
        'lastname',
        'middlename',
        'extensionname',
        'agency_employee_no',
        'email',
        'password',
        'role',
        'role_id',
        'office_id',
        'legacy_bureau_id',
        'division_id',
        'is_active',
        'is_locked',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
            'is_locked' => 'boolean',
            'role_id' => 'integer',
            'legacy_bureau_id' => 'integer',
        ];
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class);
    }

    public function isAdministrator(): bool
    {
        if (in_array((int) $this->role_id, [1, 3], true)) {
            return true;
        }

        $role = Str::of((string) $this->role)->lower()->replace(['_', '-'], ' ')->squish()->toString();

        return in_array($role, ['admin', 'administrator', 'system admin', 'super admin', 'admin staff'], true);
    }

    public function canManageLibraries(): bool
    {
        return in_array((int) $this->role_id, [1, 2], true);
    }

    public function canReceiveDocuments(): bool
    {
        if (in_array((int) $this->role_id, [1, 2, 3, 14], true)) {
            return true;
        }

        $role = Str::of((string) $this->role)->lower()->replace(['_', '-'], ' ')->squish()->toString();

        return in_array($role, [
            'system admin', 'super admin', 'admin', 'administrator', 'admin staff', 'executive', 'executives', 'encoder',
        ], true);
    }

    public function division(): BelongsTo
    {
        return $this->belongsTo(Division::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'created_by');
    }

    public function auditTrails(): HasMany
    {
        return $this->hasMany(AuditTrail::class);
    }
}
