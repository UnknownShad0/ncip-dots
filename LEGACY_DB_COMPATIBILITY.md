# Legacy Database Compatibility

## Purpose

This project supports a temporary compatibility layer for reading from an older database whose table names are singular, while the new Laravel app uses the modern pluralized schema.

This is useful during a phased upgrade where:
- the old system still exists and is being read from
- the new Laravel schema is being introduced gradually
- data is not yet fully migrated and mapped

## Concept

This is not a Laravel naming rule issue. It is a schema compatibility issue.

The old database may use tables such as:
- `user`
- `document`
- `bureau`
- `rangeregion`

The new Laravel app expects tables such as:
- `users`
- `documents`
- `offices`
- `routing_ranges`

## Implementation pattern

### 1) Add a secondary database connection

The project now includes a `legacy` database connection in [config/database.php](config/database.php).

Example values in [.env.example](.env.example):

```env
LEGACY_DB_CONNECTION=mysql
LEGACY_DB_HOST=127.0.0.1
LEGACY_DB_PORT=3306
LEGACY_DB_DATABASE=legacy_dots
LEGACY_DB_USERNAME=root
LEGACY_DB_PASSWORD=
LEGACY_DB_CHARSET=utf8mb4
LEGACY_DB_COLLATION=utf8mb4_unicode_ci
```

### 2) Map the model to a legacy table name

Example model:

```php
<?php

namespace App\Models\Legacy;

use Illuminate\Database\Eloquent\Model;

class LegacyDocument extends Model
{
    protected $connection = 'legacy';
    protected $table = 'document';
    public $timestamps = false;

    protected $guarded = [];
}
```

This tells Eloquent:
- use the `legacy` connection
- read from the old `document` table
- keep Laravel compatible even though the table is singular

## Example read-only usage

```php
use App\Models\Legacy\LegacyDocument;

$documents = LegacyDocument::query()
    ->where('status', 'pending')
    ->limit(50)
    ->get();
```

This is a classic legacy adapter pattern.

## Recommended upgrade path

Use this only as a temporary bridge.

The healthy migration plan is:

1. Keep the old database as a read-only source
2. Map legacy models to the old schema
3. Migrate the data into new Laravel tables
4. Switch the app to the new pluralized schema
5. Remove the legacy connection when migration is complete

## Terminology

The correct terms for this approach are:
- legacy DB connection
- legacy model adapter
- read-only compatibility layer
- data migration bridge

## Notes

This pattern is useful for phased upgrades, but it should not remain permanent in the final architecture. The long-term goal is for the app to use only the new Laravel schema with the standard pluralized tables.
