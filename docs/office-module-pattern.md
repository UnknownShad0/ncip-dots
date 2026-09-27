# Office Module Implementation Reference (Actual Repo Pattern)

This file is the concrete pattern used for the Office module in this project. Use it as a reference when building the next lookup module.

## 1) The actual problem
The Office module was not just a UI issue. The real problem was that the code was mixing:

- legacy rows from the old database table `bureau`
- with current rows from the Laravel app table `bureaus`

The table rows were then displayed as if they all belonged to the same editable source.

The fix was to normalize the shape before sending data to the React page.

## 2) The working approach
This project uses the same pattern for Office:

- modern model: `Bureau`
- legacy adapter: `BureauLegacy`
- legacy table: `bureau`
- modern DB table: `bureaus`

The naming is slightly older in the codebase, but the pattern is the same as the “new model + legacy adapter” approach.

## 3) New model shape
This is the actual modern model used by the Office module:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bureau extends Model
{
    use HasFactory;

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

This model is the current app-layer representation: clean names, Laravel-friendly fields, and no direct dependency on the old DB column names.

## 4) Legacy adapter shape
The old database is wrapped in a read-only adapter model:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BureauLegacy extends Model
{
    use HasFactory;

    protected $connection = 'legacy';
    protected $table = 'bureau';
    protected $primaryKey = 'bureauId';
    public $timestamps = false;

    protected $fillable = [
        'bureauId',
        'parentbureauId',
        'officeCode',
        'officeEmail',
        'longName',
        'shortName',
        'status',
        'range',
        'dateAdded',
        'addedBy',
    ];

    protected $casts = [
        'bureauId' => 'integer',
        'parentbureauId' => 'integer',
        'dateAdded' => 'datetime',
    ];
}
```

This is important because the legacy table still uses old naming conventions like:

- `bureauId`
- `parentbureauId`
- `longName`
- `shortName`
- `officeCode`
- `officeEmail`
- `range`

Those are not used directly in the new frontend-only shape.

## 5) The controller pattern
The Office controller does two separate queries, then normalizes both into one common array shape before sending to Inertia.

```php
public function index()
{
    $legacyOffices = BureauLegacy::query()
        ->select([
            'bureauId',
            'parentbureauId',
            'officeCode',
            'officeEmail',
            'longName',
            'shortName',
            'status',
            'range',
            'dateAdded',
            'addedBy',
        ])
        ->orderBy('longName')
        ->get()
        ->map(function ($office) {
            return [
                'id' => $office->bureauId,
                'name' => $office->longName ?? '',
                'short_name' => $office->shortName ?? '',
                'code' => $office->officeCode ?? '',
                'email' => $office->officeEmail ?? '',
                'location' => $office->range ?? '',
                'parent_id' => $office->parentbureauId ?? null,
                'source' => 'Old DB',
            ];
        });

    $newOffices = Bureau::query()
        ->select(['id', 'name', 'short_name', 'code', 'email', 'location', 'parent_id'])
        ->orderBy('name')
        ->get()
        ->map(function ($office) {
            return [
                'id' => $office->id,
                'name' => $office->name,
                'short_name' => $office->short_name ?? '',
                'code' => $office->code ?? '',
                'email' => $office->email ?? '',
                'location' => $office->location ?? '',
                'parent_id' => $office->parent_id,
                'source' => 'New DB',
            ];
        });

    return Inertia::render('Offices/Index', [
        'offices' => [
            ...$legacyOffices->toArray(),
            ...$newOffices->toArray(),
        ],
    ]);
}
```

This is the key idea: after mapping, both legacy and new rows follow the same shape. The frontend does not need to know whether the data came from the old or new DB.

## 6) The store/update pattern
The create and update flow is kept simple and consistent with the app's Laravel + Inertia usage:

```php
public function store(Request $request)
{
    $validated = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'short_name' => ['nullable', 'string', 'max:50'],
        'code' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'location' => ['nullable', 'string', 'max:255'],
    ]);

    Bureau::create($validated);

    return redirect()->route('offices.index')->with('success', 'Office added.');
}

public function update(Request $request, $id)
{
    $validated = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'short_name' => ['nullable', 'string', 'max:50'],
        'code' => ['nullable', 'string', 'max:50'],
        'email' => ['nullable', 'email', 'max:255'],
        'location' => ['nullable', 'string', 'max:255'],
    ]);

    $office = Bureau::findOrFail($id);
    $office->update($validated);

    return redirect()->route('offices.index')->with('success', 'Office updated.');
}
```

Only the modern model is edited. Legacy records are treated as read-only.

## 7) Frontend data contract
The React page expects a normalized row shape with a `source` field:

```ts
type OfficeRow = {
    id: number | string | null;
    name: string;
    short_name?: string;
    code?: string;
    email?: string;
    location?: string;
    parent_id?: number | null;
    source?: string;
};
```

This is the important UI contract:

- `source === 'Old DB'` means it is legacy and cannot be edited
- `source === 'New DB'` means it can be updated

## 8) Frontend modal and close pattern
This is the exact modal reset pattern used by the module:

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

And the create/update actions use `onSuccess` to close after a successful save:

```ts
router.post('/offices', {
    ...form,
}, {
    onSuccess: closeModal,
});

router.put(`/offices/${editingRow.id}`, {
    ...form,
}, {
    onSuccess: closeModal,
});
```

This keeps the flow consistent and prevents stale modal state.

## 9) Preventing edit on legacy rows
This is the rule used by the table UI:

```ts
const openEdit = (row: OfficeRow) => {
    if (row.source === 'Old DB') {
        return;
    }

    setEditingRow(row);
    setForm({
        name: row.name ?? '',
        short_name: row.short_name ?? '',
        code: row.code ?? '',
        email: row.email ?? '',
        location: row.location ?? '',
    });
};
```

And the button logic is:

```ts
const isLegacy = row.source === 'Old DB';

<button
    type="button"
    onClick={() => openEdit(row)}
    disabled={isLegacy}
    className={`rounded-md px-3 py-1.5 text-xs font-medium ${isLegacy ? 'cursor-not-allowed bg-slate-300 text-slate-500' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
>
    Edit
</button>
```

This prevents users from trying to edit records they should not modify.

## 10) Search, sorting, pagination, and print
The Office page follows a standard lookup-module UX pattern:

- search input
- sortable table headers
- rows-per-page selector
- previous / next pagination
- Print button
- New Office CTA

Example structure:

```ts
const [search, setSearch] = useState('');
const [sortKey, setSortKey] = useState<SortKey>('name');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
const [page, setPage] = useState(1);
const [perPage, setPerPage] = useState(10);
```

Then:

```ts
const sortedOffices = useMemo(() => {
    const filtered = offices.filter((row) => {
        const haystack = [
            row.name,
            row.short_name ?? '',
            row.code ?? '',
            row.email ?? '',
            row.location ?? '',
        ].join(' ').toLowerCase();

        return haystack.includes(search.toLowerCase());
    });

    return [...filtered].sort((a, b) => {
        const valueA = String(a[sortKey] ?? '').toLowerCase();
        const valueB = String(b[sortKey] ?? '').toLowerCase();

        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
}, [offices, search, sortKey, sortDirection]);
```

And print is a straightforward browser print action:

```ts
const handlePrint = () => {
    window.print();
};
```

## 11) The copy-paste checklist for future modules
When you build a similar lookup module, copy this sequence:

1. Confirm whether the module has legacy records from the old DB.
2. Create a legacy model using the old table and column names.
3. Create the modern model with the Laravel-friendly schema.
4. Query both sets separately in the controller.
5. Normalize both sets to one common field shape.
6. Add `source: 'Old DB' | 'New DB'` to each row.
7. Disable edit actions for `Old DB` rows.
8. Use `closeModal` and `onSuccess` for create/update flows.
9. Keep search, sort, print, and pagination behavior consistent.
10. Keep the UI “dumb” and the controller responsible for data normalization.

## 12) Summary
The Office module work is a good template because it solved the real issue:

- the project had two data sources
- the app treated them as one
- the fix was to normalize them before the UI used them

Once the old and new data sources are normalized to one shape, the rest of the UI behavior becomes straightforward to implement and maintain.
