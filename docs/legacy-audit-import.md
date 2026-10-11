# Legacy audit import — 2026-10-11

The importer reads the live `legacy` connection (`legacy_dots.audit_trail`) and inserts into the default database's `audit_trails` table. The export at `tests/legacy_db_tables_sql_copies/legacy_audit_trail_full.sql` is a reference/backup; the command does not execute this SQL file or any historical query stored inside it.

## Verified dataset and current state

- 398,141 source records, with 398,141 unique original IDs.
- 52,553 records have no recorded actor; these retain a null `user_id`.
- All nonblank actor IDs resolve through the imported users.
- No missing actions or zero/null timestamps in this export.
- UTC timestamp range: 2022-02-21 01:50:59 through 2026-08-14 09:25:49.
- Full import was tested in a temporary local MySQL database, then that database was removed. The actual `new_dots` audit table and migration history have NOT been changed by this validation.
- The test preserved all 12 existing audit records and verified every source ID, exact stored query text, timestamp instant, and user link. Repeating the preview produced zero new rows. Peak PHP memory during the full test was approximately 36 MiB.
- Five focused tests passed (52 assertions): preview, reruns, source text preservation, null actors/dates, original records, batch rollback, command target guard, pagination, payload privacy, and rollback protection.

## Mapping

| Legacy field | Target |
|---|---|
| trailUuid | legacy_trail_uuid (nullable unique string, 100 characters) |
| userUuid | legacy_user_uuid; mapped users.id in user_id |
| event | action, preserving original text/null |
| module | legacy_module |
| logDate | created_at and updated_at, preserving the original instant |
| All six source columns, including query | legacy_payload JSON |

Imported rows use `record_source=legacy_import`; pre-existing/native entries use `native`. No document/model ID, IP address, user agent, or action is inferred from stored SQL. Existing target rows are never overwritten, and imported IDs are skipped on reruns. This is a migration, not ongoing synchronization.

Both MySQL sessions temporarily use UTC to avoid shifting TIMESTAMP values; their previous timezones are restored afterward. A missing/zero timestamp becomes null with its original value preserved in the payload. Malformed timestamps stop the import. Nonblank unknown user identities stop the entire import so directory mappings can be corrected first. Blank actors remain unknown rather than being falsely attributed to a system account.

Raw `legacy_payload` is hidden on the model and excluded from the audit-page query. The page exposes action/module, user display name, date and record source, not historical SQL. Imported entries without a user/date have explicit fallback labels. Pagination displays 50 records per page, ordered by timestamp then ID, so older imports remain accessible.

## Step-by-step commands

Run these in the project terminal, not the `mysql>` prompt. Keep the application and legacy source from receiving edits while applying the import. Do not run multiple importers concurrently.

1. Confirm `.env` points to the intended local `new_dots` and `legacy_dots`. If configuration was cached after an `.env` change:

```bash
php artisan config:clear
```

2. Back up the target first. Use a filename that does not already exist (shell redirection overwrites an existing file):

```bash
mkdir -p storage/app/private/legacy-import-backups
mysqldump -u root -p --single-transaction --no-tablespaces new_dots \
  > storage/app/private/legacy-import-backups/new_dots_before_audit.sql
```

3. Apply the new schema migration before opening the updated Audit Trail page:

```bash
php artisan migrate --path=database/migrations/2026_10_11_000001_prepare_legacy_audit_import.php
```

4. Preview — no database records are written:

```bash
php artisan legacy:import-audit
```

Expected first-run figures against the reviewed data: 398,141 new; 52,553 without an actor. The report saves aggregate counts only under `storage/app/private/legacy-import-reports/`; no raw queries or personal values are printed.

5. Apply to the intended target:

```bash
php artisan legacy:import-audit --apply --target=new_dots
```

6. Repeat the preview:

```bash
php artisan legacy:import-audit
```

`New` should be zero and `Existing` should be 398,141. Warning counters refer to new rows, so the repeat report should not recount missing actors on skipped records. Open `/audit-trail` and use Next/Previous to browse historical records.

All insert batches (500 rows each) are inside one target transaction. A failure rolls back every row inserted during that run. The migration itself is separate and remains applied. The schema rollback refuses to discard imported identities/data; restore a reviewed backup if abandoning the import, accounting for any changes made since the backup.

After `migrate:fresh`, run the directory importer first and then this importer. Audit import does not depend on the document import. A fresh reset erases native audit entries; the legacy importer cannot restore records that only existed in the new system.

## SQL verification in mysql>

```sql
USE new_dots;

SELECT record_source, COUNT(*) AS records
FROM audit_trails GROUP BY record_source;

SELECT COUNT(*) AS imported,
       SUM(user_id IS NULL) AS without_actor
FROM audit_trails WHERE legacy_trail_uuid IS NOT NULL;
-- Expected imported: 398141; without_actor: 52553.

SELECT COUNT(*) AS source_rows_not_imported
FROM legacy_dots.audit_trail s
LEFT JOIN audit_trails t ON t.legacy_trail_uuid = s.trailUuid
WHERE t.id IS NULL;
-- Expected zero.

SELECT COUNT(*) AS incorrect_user_links
FROM audit_trails a LEFT JOIN users u ON u.id = a.user_id
WHERE a.legacy_user_uuid IS NOT NULL
  AND TRIM(a.legacy_user_uuid) <> ''
  AND NOT (a.legacy_user_uuid <=> u.legacy_user_uuid);
-- Expected zero.
```

Keep the export and database backups private. Historical SQL remains database data only and is never executed by the importer.
