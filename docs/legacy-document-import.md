# Import legacy documents step by step

This importer reads the live Laravel `legacy` connection (`legacy_dots`). The SQL export is a backup/reference, not a script to execute in `new_dots`. Import the directory first so `users.legacy_user_uuid` and `offices.legacy_bureau_id` resolve source relationships.

## Current state

The implementation has been exercised against the complete local source dataset in a separate temporary MySQL database. That database was deleted after verification. Validation also passed 14 focused tests (102 assertions) and `npx tsc --noEmit`. No document records or preparation migration have been applied to `new_dots` by this test.

Expected first import with the reviewed source:

| Result | Count |
|---|---:|
| Documents imported | 62,206 |
| Trails attached to documents | 267,228 |
| File metadata attached to documents | 57,929 |
| Orphan trails retained in exceptions | 663 |
| Orphan files retained in exceptions | 804 |
| Documents requiring review | 414 |

All 267,891 trails and 58,733 file rows are accounted for by the imported records plus exception rows. No orphan is discarded. Ten files with a valid document but a missing/conflicting trail are attached only to the document, with the original reference retained in `legacy_payload`.

## Run from the terminal, not mysql>

After `migrate:fresh`, the identity columns exist but the target directory tables are empty. The document-only command will therefore stop until users and offices are imported. Use the combined command below to preview or import the directory and documents in order. It does not run `migrate:fresh`; preview writes are rolled back, while `--apply` commits both imports in one target transaction.

Preview both imports without changing the target:

```bash
php -d memory_limit=768M artisan legacy:import-all --unassign-mismatched-divisions
```

Apply only after reviewing the preview and making a backup:

```bash
php -d memory_limit=768M artisan legacy:import-all \
  --apply --target=new_dots --unassign-mismatched-divisions
```

The directory option is needed for the reviewed source's approved bureau/division mismatches. Do not add `migrate:fresh` to an automated import command: it permanently deletes all target data.

1. Verify `.env`: target must be the intended local `new_dots`, source must be `legacy_dots`. If configuration was cached, run `php artisan config:clear` after editing `.env`. Stop edits to both systems during import. This is a one-time migration, not continuous sync.
2. Back up the target. Keep the backup private:

```bash
mkdir -p storage/app/private/legacy-import-backups
mysqldump -u root -p --single-transaction --no-tablespaces new_dots \
  > storage/app/private/legacy-import-backups/new_dots_before_documents.sql
```

Choose a different backup filename if that file already exists; shell redirection overwrites it.

3. Apply the schema changes (required before using the updated document screens):

```bash
php artisan migrate --path=database/migrations/2026_10_10_000002_prepare_legacy_document_import.php
php artisan migrate --path=database/migrations/2026_10_10_000003_add_record_source_to_importable_tables.php
```

4. Preview, with no database writes:

```bash
php -d memory_limit=768M artisan legacy:import-documents
```

The report prints counts and saves reason counts plus example IDs to `storage/app/private/legacy-import-reports/`. A preview does not create exception rows or imported records.

5. If the preview matches the intended dataset, apply:

```bash
php -d memory_limit=768M artisan legacy:import-documents --apply --target=new_dots
```

The command uses batches of 500 within a single target database transaction. A failure rolls back all imported data from that run, including lookup links and exception rows. Schema changes are separate. Do not run two importers simultaneously.

6. Repeat the preview:

```bash
php -d memory_limit=768M artisan legacy:import-documents
```

Existing identities are skipped. `New` and `Linked` should be zero. Orphan exceptions can still be reported; rerunning updates their saved payload without creating duplicates. Existing imported records and later application edits are never reset. New legacy history cannot be appended behind newer history or after local workflow actions; such a run stops for reconciliation.

After `migrate:fresh`, run the directory importer first, then this document importer. Fresh destroys all local records; import restores only what exists in the legacy source. Do not use fresh as a production migration procedure.

## Data handling

- Titles allow 500 characters and null; no truncation or invented title.
- Missing tracking numbers remain null, with their original legacy identity retained. No invented official tracking numbers. Nonempty tracking conflicts stop the whole import instead of merging unrelated documents.
- Missing titles/tracking or incomplete active routing set `legacy_needs_review`. The Documents page shows “Needs review”; update/delete/release/receive/terminal actions are disabled for these records. Normal imported records can continue through the local workflow.
- Archived source records remain archived even when their last trail says AVAILABLE or PENDING; they cannot be received or released.
- Imported trails are inserted in ascending legacy trail-ID order. The new latest-trail behavior therefore preserves legacy ordering even if timestamps are out of order.
- AVAILABLE maps its destination to the receiving office; PENDING/TERMINAL maps it to the holder. Separate columns preserve the original holder and receiver, and raw source payloads preserve every original column.
- Free-text purposes/actions remain text; purpose names can match lookup rows. An unknown nonzero document type is left null and reported, with its source ID retained in the payload.
- Users/offices are mapped by their original legacy identity, never by assuming the numeric IDs match. Missing directory identities stop the import.
- Source zero dates become null. Existing lookup rows matched by name keep their local fields; ambiguous matches stop the import.
- Importable rows have a `record_source`: `native` for new app records, `legacy_import` for rows inserted by the importer, and `legacy_linked` for local lookup rows matched to legacy identities. Existing directory/lookup records whose historical insert-vs-link status is unknown are marked `legacy_unclassified`; reruns preserve that value rather than guessing.
- Orphan history/files are saved in `legacy_document_exceptions` with a source key, reason and complete original payload. Do not delete them. Restore the true parent/source relationship before attempting reconciliation; never invent a parent document.
- Attachments are metadata-only, as requested. `is_available=false` prevents links to old server paths. Actual files will need a separate verified copy process before marking them available.
- Runtime pages and workflows use the imported local tables only; they do not query the legacy database. The one-time import/preview commands still need the legacy source connection. Preserve it until no further import or reconciliation is required.

No email, notification, file download or session is created by the import.

## SQL checks (inside mysql>)

```sql
USE new_dots;

SELECT COUNT(*) AS imported_documents FROM documents WHERE legacy_doc_id IS NOT NULL;
SELECT COUNT(*) AS imported_trails FROM document_trails WHERE legacy_doc_trail_id IS NOT NULL;
SELECT COUNT(*) AS imported_file_metadata FROM document_files WHERE legacy_file_id IS NOT NULL;

SELECT 'documents' AS table_name, record_source, COUNT(*) AS records
FROM documents GROUP BY record_source
UNION ALL
SELECT 'document_trails', record_source, COUNT(*) FROM document_trails GROUP BY record_source
UNION ALL
SELECT 'document_files', record_source, COUNT(*) FROM document_files GROUP BY record_source;

SELECT source_table, reason, COUNT(*) AS records
FROM legacy_document_exceptions GROUP BY source_table, reason;

SELECT legacy_doc_id, tracking_number, title, status
FROM documents WHERE legacy_needs_review = 1 ORDER BY legacy_doc_id;

-- Original values stay accessible for a specific legacy document.
SELECT legacy_doc_id, legacy_payload FROM documents WHERE legacy_doc_id = 20723;

-- Physical files have not been copied: available_imported_files should be zero.
SELECT COUNT(*) AS available_imported_files FROM document_files
WHERE legacy_file_id IS NOT NULL AND is_available = 1;

-- Must be zero: file history links must belong to the same document.
SELECT COUNT(*) AS incorrect_file_trail_links FROM document_files f
JOIN document_trails t ON t.id = f.document_trail_id
WHERE f.document_id <> t.document_id;
```

Before clearing a review flag, verify the source record, supply the real tracking/title where missing, establish the correct current holder/destination, and check the latest trail and archive state. There is no automatic “clear all” command and no review-resolution UI in this change.

A rollback of the schema migration is deliberately blocked once imported identities or incompatible data exist, because it would destroy provenance or truncate titles. Use a reviewed backup restore if abandoning the import, accounting for any later user edits.
