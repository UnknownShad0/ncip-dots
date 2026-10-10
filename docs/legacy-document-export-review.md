# Legacy document export review — 2026-10-10

Implementation update: the importer and preparation migration are now available and validated against the full dataset in a temporary MySQL database. See [step-by-step import instructions](legacy-document-import.md). This file records the initial findings; `new_dots` has not received the document import yet.

Read-only review of `tests/legacy_db_tables_sql_copies/legacy_documents_full.sql` against the committed application schema and the earlier `legacy_users_offices_full.sql` directory snapshot. No SQL dump statements were executed against MySQL, and no records were imported. Data was parsed into an isolated in-memory SQLite database for aggregate checks. This is not yet a comparison against the current target database's document contents.

## Export completeness

All six tables have CREATE TABLE definitions, data and original primary IDs. The dump has a completion footer. Each table's primary IDs are nonempty and unique.

| Legacy table | Records | Primary key | Target |
|---|---:|---|---|
| document | 62,206 | docId | documents |
| document_trail | 267,891 | docTrailId | document_trails |
| file | 58,733 | fileId | document_files |
| document_type | 37 | dtId | document_types |
| action_type | 8 | dtId | action_types |
| purpose_type | 17 | dtId | purpose_types |

## Findings that affect migration

- 399 documents have a null/blank tracking number. There are no duplicate nonblank tracking numbers under a trim/lowercase check. The new tracking number is required and unique; a policy is needed for these records. Do not invent official tracking numbers automatically.
- 399 documents have no matching trails. The overlap with the missing-tracking group has not been established individually.
- 2,089 titles exceed the new schema's 255-character limit; maximum length is 500. Widen the target field before import rather than truncating historical titles.
- 45 document titles are null, but the target title is required. Preserve missing titles explicitly through a schema or agreed display policy, rather than silently substituting content.
- 663 trail rows have no matching document in this export.
- 804 file rows have no matching document. 812 file rows reference a nonzero trail ID absent from the export. These sets can overlap; do not add these counts together or discard these rows automatically.
- 98 document type references do not resolve: 45 null, 52 zero, and one nonzero missing type ID.
- Every document creator, trail creator and file uploader resolves to a user in the directory snapshot.
- All populated trail office references resolve to bureaus in the directory snapshot. Missing references are null: 119 originating, 106,718 holder, and 85,200 receiving values. These are historical gaps, not references to unknown nonzero office IDs; preserve and interpret them per workflow state.
- File paths are nonblank for all file rows, and no secondary attachmentPath is populated. This does not verify that any physical attachment exists or is readable.

## Workflow mapping requirements

Legacy trails store originating, receiving and holder separately. The new workflow currently uses from_office_id and to_office_id, with to_office_id serving as receiving/holder depending on state. A plain column rename would lose information. Preserve original holder/routing values and test AVAILABLE, PENDING and TERMINAL transitions before enabling imported documents in the new workflow.

The current model determines the latest trail using the new ID. Import ordering must therefore preserve legacy trail order, not just timestamps. Legacy purpose and trail action are text values; do not treat them as foreign-key IDs automatically.

Proposed identity columns: documents.legacy_doc_id, document_trails.legacy_doc_trail_id, document_files.legacy_file_id, and a legacy type ID on each lookup table. All should be nullable and unique, following the directory-import approach.

## Proposed next stages

1. Produce an exception report keyed by legacy IDs, including relationship gaps and missing tracking numbers. Keep source records intact; stop or hold unresolved records for explicit review.
2. Map lookup types against existing target records and check target tracking-number collisions.
3. Add identity columns and the schema changes needed to preserve title/routing information.
4. Build a batched, repeatable importer with a read-only preview and a clear policy for partial progress/rollback. This dataset is much larger than the directory import.
5. Locate and verify the physical legacy attachment directory; SQL contains metadata only.
6. Test document ownership, access, receiving/releasing, terminal status, ordering and file downloads. Switch off the legacy listing for migrated records to avoid duplicates. Keep the legacy connection until remaining dependencies have been removed.

No document migration, importer, target database update, or file copy has been performed in this review.
