# Office Module Pattern (Legacy + New DB)

This note records the working pattern used for the Office module and is meant to be reused for other lookup modules.

## 1) Core issue
The main bug was not the modal logic alone. The real issue was that the module was mixing:

- a legacy table source (`bureau` in the old database)
- with the new Laravel table (`offices` in the app database)

The UI was then treating both as if they were the same structure and same editable source.

## 2) Correct pattern
Use a `new model + legacy adapter` approach:

- New Laravel model: `Office`
- Legacy adapter model: `OfficeLegacy` (or `BureauLegacy` in some earlier naming)
- Legacy table in old DB: `bureau`
- New table in app DB: `offices`

The modern `Office` model should reflect the current Laravel schema, not the old CI/legacy column names.

## 3) Legacy adapter mapping
Example mapping used in the Office controller:

- `bureauId` -> `id` (for the legacy row id)
- `parentbureauId` -> `parent_id`
- `longName` -> `name`
- `shortName` -> `short_name`
- `officeCode` -> `code`
- `officeEmail` -> `email`
- `range` -> `location`

This is the normalization step that allows the UI to work with a single shape.

## 4) Modern model shape
`Office` should look like this conceptually:

```php
class Office extends Model
{
    protected $fillable = [
        'parent_id',
        'name',
        'short_name',
        'code',
        'email',
        'location',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }

    public function divisions(): HasMany
    {
        return $this->hasMany(Division::class, 'office_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'office_id');
    }
}
```

## 5) Legacy adapter shape
Legacy models should keep the old database table/column names but be treated as read-only in the UI when needed.

Example concept:

```php
class OfficeLegacy extends Model
{
    protected $connection = 'legacy';
    protected $table = 'bureau';
    protected $primaryKey = 'bureauId';
    public $timestamps = false;
}
```

## 6) UI pattern
The Office page should follow this layout:

- search input
- print button
- table header with sortable columns
- rows-per-page selector
- previous/next page buttons
- “New Office” button
- modal for create/update
- `closeModal()` resets form state and closes the modal
- `router.post(..., { onSuccess: closeModal })`
- `router.put(..., { onSuccess: closeModal })`

The key form logic is:

```ts
const closeModal = () => {
  setEditingRow(null);
  setIsCreateOpen(false);
  setForm({
    name: '',
    short_name: '',
    code: '',
    email: '',
    location: '',
  });
};
```

and

```ts
router.post('/offices', payload, {
  onSuccess: closeModal,
});
```

## 7) Old DB row handling
For legacy rows, disable editing in the table UI.

```ts
if (row.source === 'Old DB') {
    return;
}
```

and in the button:

```ts
const isLegacy = row.source === 'Old DB';

<button
  disabled={isLegacy}
  className={isLegacy ? 'cursor-not-allowed bg-slate-300 text-slate-500' : 'bg-sky-600 text-white hover:bg-sky-700'}
>
  Edit
</button>
```

This prevents editing records that come from the old database and keeps the app consistent with the legacy/new migration pattern.

## 8) Reuse checklist for future modules
When creating a new lookup module, repeat this checklist:

1. Confirm whether the module has legacy data from old DB.
2. Create a legacy model with the old table name and old column names.
3. Create the new Laravel model with modern schema fields.
4. Map old columns to new UI-safe fields in the controller.
5. Add `source` metadata (`Old DB` / `New DB`) for UI decisions.
6. Disable edit buttons for legacy rows.
7. Add `closeModal` + `onSuccess` for create/update submissions.
8. Keep search, sort, print, and pagination consistent.

## 9) Important note
The issue is usually not only the frontend form behavior. Most of the time, it is the mismatch between old DB table naming and the Laravel app table naming. Once that is normalized, the rest of the module works smoothly.
