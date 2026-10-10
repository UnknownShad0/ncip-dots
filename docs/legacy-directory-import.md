# Legacy directory import (local first)

Source: `legacy_dots`. Target: `new_dots`. This imports directory records only; documents, trails, and files still use their existing workflows. The application uses the new database for runtime pages after import, but this one-time importer still needs the configured legacy source connection if it is run again.

## Terminal commands

Run from the project folder. These are shell commands, not commands for the `mysql>` prompt.

```bash
# Backup the target before changing it. Keep this file private.
mysqldump -u root -p --single-transaction --no-tablespaces new_dots > new_dots_before_import.sql

# Apply the identity and source-tracking migrations, not unrelated pending migrations.
php artisan migrate --path=database/migrations/2026_10_10_000001_add_legacy_identity_columns.php
php artisan migrate --path=database/migrations/2026_10_10_000003_add_record_source_to_importable_tables.php

# Read-only preview. No rows are written, even temporarily.
php artisan legacy:import-directory --unassign-mismatched-divisions

# Apply to the configured target only when its database name is new_dots.
php artisan legacy:import-directory --apply --target=new_dots --unassign-mismatched-divisions

# Repeat the preview: New and Existing to link should now be zero.
php artisan legacy:import-directory --unassign-mismatched-divisions
```

The division option was explicitly selected for this dataset: retain the user's bureau, leave a division belonging to another bureau unassigned. Without the option, that conflict stops the import.

The importer reads the configured live `legacy` connection. The SQL export is a reference/backup; it is not executed against the new database. Use a maintenance window when applying: the source and target must not be edited concurrently. Production import requires its own backup, preview, and review.

## Mapping

| Legacy | New |
|---|---|
| `rangeregion.id` | `ranges.legacy_range_id` |
| `bureau.bureauId` | `offices.legacy_bureau_id` |
| `division.divisionId` | `divisions.legacy_division_id` |
| `user.userUuid` | `users.legacy_user_uuid` |
| `bureau.range` (name) | Match `rangeregion.name`, then map to `offices.range_id`; preserve source ID in `offices.legacy_range_id` |
| `bureau.parentbureauId` | Remapped `offices.parent_id` |
| `division.bureauId` | Remapped `divisions.office_id` |
| `user.bureauId` | Remapped `users.office_id`, original in `users.legacy_office_id` |
| `user.divisionId` | Remapped `users.division_id`, except approved mismatches |
| `user.role` | `users.role_id`; name comes from legacy `role.rolename` |
| `user.status` | `1` active, `2` inactive |
| `user.isLocked` | `Y` locked, `N` unlocked |
| `user.password` | Existing bcrypt hash, copied verbatim for new users |

Existing ranges/offices match by trimmed, case-insensitive name. Divisions match by name plus mapped office. Existing users must match BOTH username and email; partial or ambiguous matches stop the import. Existing matched records keep profile fields, HRIS codes, password, permissions and account status; only legacy identity and compatible assignment links are added. Already imported identities are skipped, so reruns do not reset later edits. This is a one-time migration, not ongoing synchronization.

Each importable row has a `record_source`: `native` for rows created in the new app, `legacy_import` for rows inserted by the importer, and `legacy_linked` for an existing local row matched to a legacy identity. Rows that already had a legacy identity before source tracking was introduced are marked `legacy_unclassified` when their original inserted-vs-linked status cannot be proven. The importer preserves that historical status on reruns rather than guessing.

The importer preserves valid original creation timestamps. Legacy zero dates (`0000-00-00 00:00:00`) and absent dates remain null rather than inventing a historical date; the report counts converted zero dates. It does not import session tokens, login-attempt counters or email-verification state, send mail, or create login sessions. Unknown password formats, roles, account statuses, missing relations and conflicting mappings stop the import. Invalid but nonempty legacy emails are retained with a warning; correct them before email delivery.

`bureau.status`, `division.shortName`/`description`, and other source-only fields have no equivalent in these target tables and remain available in the legacy database/export. No new office-status behavior is introduced by this directory import.

## SQL commands for checking (inside mysql)

```sql
USE new_dots;

-- Total rows and rows linked to legacy identities.
SELECT 'ranges' AS table_name, COUNT(*) AS total,
       COUNT(legacy_range_id) AS legacy_linked FROM ranges
UNION ALL
SELECT 'offices', COUNT(*), COUNT(legacy_bureau_id) FROM offices
UNION ALL
SELECT 'divisions', COUNT(*), COUNT(legacy_division_id) FROM divisions
UNION ALL
SELECT 'users', COUNT(*), COUNT(legacy_user_uuid) FROM users;

-- Distinguish native, imported, linked and historically unclassified rows.
SELECT record_source, COUNT(*) AS records
FROM ranges GROUP BY record_source;
SELECT record_source, COUNT(*) AS records
FROM offices GROUP BY record_source;
SELECT record_source, COUNT(*) AS records
FROM divisions GROUP BY record_source;
SELECT record_source, COUNT(*) AS records
FROM users GROUP BY record_source;

-- All four results should be zero when the full source has been imported.
SELECT 'ranges' AS table_name, COUNT(*) AS missing
FROM legacy_dots.rangeregion l LEFT JOIN ranges n ON n.legacy_range_id = l.id WHERE n.id IS NULL
UNION ALL
SELECT 'offices', COUNT(*) FROM legacy_dots.bureau l
LEFT JOIN offices n ON n.legacy_bureau_id = l.bureauId WHERE n.id IS NULL
UNION ALL
SELECT 'divisions', COUNT(*) FROM legacy_dots.division l
LEFT JOIN divisions n ON n.legacy_division_id = l.divisionId WHERE n.id IS NULL
UNION ALL
SELECT 'users', COUNT(*) FROM legacy_dots.user l
LEFT JOIN users n ON n.legacy_user_uuid = l.userUuid WHERE n.id IS NULL;

-- Must return zero: imported users assigned to the wrong mapped bureau.
SELECT COUNT(*) AS incorrect_office_mapping
FROM users u LEFT JOIN offices o ON o.id = u.office_id
WHERE u.legacy_user_uuid IS NOT NULL
  AND (o.id IS NULL OR NOT (o.legacy_bureau_id <=> u.legacy_office_id));

-- Inspect exceptional assignments without displaying passwords.
SELECT legacy_bureau_id, name FROM offices
WHERE legacy_bureau_id IS NOT NULL AND range_id IS NULL;

SELECT legacy_user_uuid, legacy_office_id, division_id FROM users
WHERE legacy_user_uuid = '0d08d967-319a-4650-9ab9-0da8fde91c08';
```

Use the Laravel migration for the `ALTER TABLE` changes so Laravel's migration history stays correct. Do not run separate manual `ALTER`/`INSERT` commands in addition to the importer. The source dump contains the OLD schema and must not be restored directly into `new_dots`.

All data writes are transactional. A failed apply rolls back that run's data changes; the separately applied identity migration remains. Do not roll back the identity migration after a successful import: that would remove the mappings without removing imported records. Full restore from the pre-import backup is a separate maintenance operation and would discard later changes; do not restore automatically.

## Local execution result — 2026-10-10 (Asia/Manila)

Applied to local `127.0.0.1 / new_dots` from `legacy_dots`:

| Table | Inserted | Existing linked | Final total | Linked to legacy |
|---|---:|---:|---:|---:|
| ranges | 28 | 0 | 28 | 28 |
| offices | 287 | 2 | 290 | 289 |
| divisions | 1 | 0 | 1 | 1 |
| users | 421 | 0 | 431 | 421 |

All 10 pre-existing users were verified unchanged. Existing office names, codes, contact fields and original creation dates were preserved. All 421 imported password hashes match their source verbatim, and each imported user points to the office mapped from its legacy bureau. A second plan returned no writes.

Exceptions retained in the report:

- Bureau `290`: placeholder range, imported with null range.
- User `0d08d967-319a-4650-9ab9-0da8fde91c08`: approved null division; original bureau retained.
- User `188538ae-be76-4d2e-a355-cfd936ad5ddb`: malformed historical email retained; needs correction before delivery.
- 285 legacy bureau zero dates converted to null.

Private target backups (filenames use UTC):

- `storage/app/private/legacy-import-backups/new_dots_20261010_051226.sql`: before the schema migration and import.
- `storage/app/private/legacy-import-backups/new_dots_20261010_051316.sql`: after the identity migration, before successful data import.

The first data attempt rolled back on MySQL's rejection of legacy zero dates. After adding explicit zero-date conversion, the retry committed and passed verification. Source records were not changed.

Validation: six importer tests passed (37 assertions), covering read-only preview, matching/remapping, existing-account preservation, repeat imports, conflict rejection, transaction rollback, approved division handling, bcrypt preservation and zero dates. The eight failures in the previously run account/HRIS tests were reproduced on an isolated HEAD checkout without these changes (17 tests, 54 assertions, 8 failures; one risky-test warning). They remain separate account-workflow issues.
