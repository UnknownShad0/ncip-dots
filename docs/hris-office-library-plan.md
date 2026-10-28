# HRIS Office Directory Sync Plan

## Goal

Keep the local office directory used by DOTS aligned with HRIS by synchronizing HRIS office and division data into the existing `office_lists` table. Let users choose current HRIS directory entries while assigning each account to the correct existing operational office, so legacy and new documents remain visible under the same office identity.

This plan covers the HRIS directory (`office_lists`). It does not automatically create, rename, deactivate, or delete operational `offices` records.

## Table and ID separation

- `office_lists` is the HRIS/office-selection directory. Its `id` is only that directory row's database ID; its stable source key is `division_code`.
- `offices` is the operational DOTS office table. Its `id` is referenced by `users.office_id`, documents, trails, routes, and other workflow records. The legacy import also retains legacy bureau identifiers.
- A directory sync into an empty `office_lists` inserts directory rows only. It does not infer matches to operational offices, users, or legacy IDs. It must never copy an `office_lists.id` into any operational-office reference.
- Do not match `office_lists` rows to `offices` rows by exact or similar names. Names are display labels, can differ or change, and are not a reliable identity key. This sync does not create a cross-table mapping.
- Syncing `office_lists` does not change the existing user-to-office links or document visibility. The sync must not insert, update, delete, or renumber rows in `offices`, `users`, or document/workflow tables.
- User-account creation must save an operational `offices.id`, never an `office_lists.id`. For a new HRIS directory selection, resolve its stable HRIS division code through an explicit mapping to the canonical operational office. For example, HRIS directory row `office_lists.id = 121` can map to existing `offices.id = 21`; the new account stores `office_id = 21`.
- The mapping is a deliberate administrative decision, not a name-based guess. Multiple HRIS divisions may map to the same operational office if that is the approved organization structure. An unmapped directory entry cannot be used for an account until an administrator maps it or explicitly establishes a genuinely new operational office.
- This mapping avoids duplicate operational identities: if an HRIS entry represents legacy OPPR-ICTD, map it to the existing `offices.id = 21`. New documents and user assignments then continue to use ID 21, preserving access to existing ICTD documents. Create a new operational office ID only for a genuinely distinct office, not merely because HRIS uses a different row ID or label.

## Current state

- `office_lists` already exists. It stores division-level records keyed by unique `division_code`, with names, address and contact fields, geographic codes, status, parent relationship, timestamps, and soft deletes.
- `OfficeController` uses `office_lists` as the source for the division picker when an administrator creates or updates an operational office. The operational `offices` table holds DOTS assignments and may also carry local ranges, parent links, and user/document relationships.
- User accounts and historical DOTS records rely on the existing operational office IDs. Those IDs are part of authorization and data visibility, not disposable row numbers.
- `office_lists` currently has 269 records imported from the legacy SQL dump. `OfficeListsImportTest` verifies the repeatable import and legacy values.
- A scan of the configured database found 293 operational `offices` rows. The `hris_office_mappings` table has been created with 2 exact-code candidates marked `auto_confirmed` and 32 unique normalized-name candidates marked `pending_review`; 235 active directory rows remain unmatched. This mapping data is not yet connected to account creation, and no users or operational-office assignments were changed.
- HRIS configuration already includes `HRIS_OFFICE_PATH` (default `/api/offices`). `HrisDirectory` calls this endpoint with a `division_code` when resolving an employee's office and expects office records containing a code, name, region, and nested divisions.
- `tests/Fixtures/hris/get-office.json` contains that office-with-divisions shape. It is useful for sample-mode development, but does not by itself confirm the complete production office roster contract.
- Employee roster synchronization already provides a useful local pattern for server-side API access, an administrator-triggered sync, a CLI command, a cache lock, and sync-result reporting.

## Proposed experience

- Add an administrator-only **Sync from HRIS** action to the Offices page, where the `office_lists` directory currently feeds office selection.
- Keep sync and mapping management inside the existing **Offices** module; add an HRIS Directory section/tab there rather than adding a separate top-level module.
- Show the last successful directory sync, current/latest status, start time, counts of divisions added and updated, and a readable sanitized failure message.
- Keep this sync isolated from operational office creation and editing. Refreshing `office_lists` must not create or overwrite operational `offices` rows. Review the separate office creation flow before exposing newly synced directory entries there, since it can create a new operational ID.
- Do not automatically create new operational `offices` from HRIS records. Do not replace, truncate, reseed, or renumber existing operational offices. Preserve every current `offices.id` and its user/document relationships.
- Keep the HRIS token on the server. The browser only starts the application sync and receives the result summary.
- Record the administrator who initiated a manual sync. Provide a CLI command using the same synchronization service for operations.
- In the Offices module's HRIS Directory section, provide administrator-managed mappings from HRIS division entries (keyed by `division_code`) to existing operational offices. Show unmapped entries clearly; never guess a mapping by name.
- In account creation, show the current HRIS directory choice but submit its stable `division_code`; resolve that code server-side to the mapped `offices.id` and store that operational ID in `users.office_id`.
- Do not let an HRIS directory row be assigned directly as `users.office_id`. Disable or reject account creation for an unmapped entry with a clear instruction to complete the mapping.

## Data mapping

The local table is division-oriented while the HRIS fixture is office-oriented. Flatten each HRIS office's `divisions` array into one `office_lists` row per division.

| `office_lists` field | HRIS source / handling |
| --- | --- |
| `division_code` | `divisions[].code`; required stable upsert key |
| `division_name` | `divisions[].name`; required display name |
| `long_name` | Initially use the division name unless the verified API provides a distinct long name |
| `short_name` | Map only if HRIS provides a documented equivalent; otherwise preserve existing value |
| `email` | Map only if HRIS provides an office/division email with confirmed ownership; otherwise preserve existing value |
| `status` | Map only after confirming HRIS status semantics; otherwise preserve existing value |
| `region_code` | Parent office's `region.code` |
| `office_address`, `province_code`, `municipality_code` | Map only when the endpoint supplies documented matching values; otherwise preserve existing values |
| `parent_office_id` | Resolve only if a verified HRIS parent/child relationship maps unambiguously to another local division; do not infer from region or grouping |

The parent HRIS office's `code` and `name` are not currently represented as dedicated `office_lists` fields. Do not put the office code into `division_code` or conflate the parent office with a division. Before implementation, decide whether the directory needs dedicated parent-office code/name fields or whether the existing `division_name` values are sufficient for current DOTS workflows. If fields are added, make them nullable and keep `division_code` as the unique key.

Fields omitted by HRIS must not be cleared during upsert. The initial implementation should update only fields whose source and semantics are confirmed. Do not include residential or other unnecessary personal data if the API returns it.

## HRIS directory to operational office mapping

Use an explicit crosswalk so the UI can display current HRIS office/division choices while DOTS retains its existing operational office identity.

- Use `hris_office_mappings` with a unique `division_code`, required `office_id` foreign key to `offices.id`, `match_method`, review `status`, and mapping/review metadata. The mapping row's own ID is not an office ID. Only `auto_confirmed` and administrator-`confirmed` mappings may be used for account assignment.
- Allow multiple HRIS division codes to point to one existing operational office when those HRIS divisions belong to the same DOTS office. Each HRIS division code may have only one current operational-office mapping.
- Map using the HRIS code and an administrator's verified knowledge of the existing DOTS office. Never infer the relation from exact, partial, or normalized names. Preserve a mapping across HRIS name changes because its key is the stable division code.
- In user-account creation, submit `division_code` (not `office_lists.id` or a display name), look up the mapping on the server, and store the mapped `office_id` in `users.office_id`. Continue deriving `office_code`/`office_name` from the mapped operational `Office` record so existing application behavior remains consistent.
- If a division code has no mapping, block account creation for that selection and direct an administrator to map it. Do not silently create a new `offices` row. If the organization confirms the entry is a genuinely new operational office, an administrator can create that office explicitly and map the HRIS division code to its new `offices.id`.
- Mapping or changing a mapping affects future user assignments only. Do not bulk-change existing users or historical document office IDs as part of this feature. Any reassignment requires a separate reviewed migration with visibility checks.

## Sync behavior

1. Verify the live `GET /api/offices` contract, including whether an unfiltered request returns the complete roster, how pagination is represented, which fields identify offices and divisions, and how inactive or removed divisions are represented.
2. Fetch the complete roster on the application server with the configured bearer token. Support the verified pagination format; do not treat an empty, malformed, or partial response as a successful sync.
3. Validate each office and nested division. Require non-empty unique division codes and names; reject duplicate codes or invalid records before writing anything.
4. Flatten and normalize the complete response, then upsert `office_lists` by `division_code` in a database transaction. Preserve local values for fields HRIS does not authoritatively supply.
5. Prevent concurrent syncs with a dedicated office-directory lock. Track sync start/end, actor, status, received/created/updated counts, and a sanitized error summary. Keep the last-success timestamp unchanged after a failed sync.
6. Do not hard-delete or soft-delete records missing from a response until HRIS completeness and removal/status semantics are confirmed. Initially, retain missing rows and report counts for review.
7. Do not mutate `offices`, `divisions`, user assignments, ranges, document routes, or audit history as a side effect of refreshing `office_lists`. In particular, do not create replacement office rows or alter existing office primary keys.

## Security and data handling

- Restrict the manual sync action and directory-sync status to authorized administrators.
- Keep API credentials in server configuration; never return tokens or full raw HRIS responses to the browser or logs.
- Log sync identifiers, endpoint path, response status, and counts as needed, but avoid logging directory payloads or personal data.
- Validate and bound API response sizes and field lengths before persistence.
- Preserve the last complete local directory when the API fails, returns partial data, or contains invalid records.

## Implementation sequence

1. Confirm the production office endpoint's full-roster, pagination, status, and identity contracts; confirm which `office_lists` fields HRIS owns.
2. Decide whether parent HRIS office code/name need dedicated nullable columns, based on the current Offices UI and lookup requirements.
3. Add office-directory sync history storage (or a clearly typed shared sync-history design), model, and status/count fields without changing operational office records.
4. Implement a reusable server-side synchronizer that fetches, validates, flattens, and transactionally upserts the roster by division code; add a CLI command and overlap protection.
5. Add the HRIS Directory section within the existing Offices page and server-side resolver from HRIS `division_code` to canonical `offices.id`, using the mapping table already created. Do not add a top-level module or use directory row IDs/names as mapping keys.
6. Update account creation to display HRIS directory choices but store only the mapped operational `office_id`; block unmapped choices.
7. Add the administrator-only sync route and Offices page status/action, with actor attribution and understandable success/failure feedback.
8. Add coverage for fixture import, nested division flattening, field preservation, duplicate/malformed response rejection, lock behavior, failed-sync preservation, authorization, only-directory writes during sync, correct mapping resolution, unmapped-choice rejection, and unchanged legacy user/document references.
9. Run an initial controlled sync, map HRIS divisions to existing offices with an administrator, and verify a new account selecting the HRIS ICTD entry receives the existing ICTD `offices.id`. Confirm existing users and document visibility are unchanged.

## Acceptance criteria

- An authorized administrator can start a server-side sync from the Offices page and see its outcome and last-successful-sync time.
- The HRIS API token remains server-side, and a CLI command can run the same synchronization logic.
- A complete HRIS roster is flattened to division-level `office_lists` records and upserted by `division_code` without duplicate rows.
- Fields not authoritatively supplied by HRIS are preserved.
- Empty, malformed, duplicate, partial, or failed responses do not replace or delete the last usable local directory.
- Missing HRIS records are retained until their deactivation/removal semantics are confirmed.
- The sync writes HRIS directory data to `office_lists` and sync history only; it does not write to operational `offices`, `users`, or document/workflow tables.
- An empty `office_lists` table can be populated without reusing its generated row IDs as operational office IDs or legacy user IDs.
- Existing operational office IDs, user assignments, and document visibility remain untouched because the sync does not change those tables.
- An administrator can map the HRIS ICTD division code to the existing operational ICTD office ID; account creation displays the latest HRIS entry and stores that mapped operational ID.
- Multiple HRIS divisions can map to one operational office when explicitly configured; no mapping is inferred from names.
- Account creation rejects an unmapped HRIS directory entry and never copies `office_lists.id` into `users.office_id`.
- A genuinely new operational office can be created and mapped explicitly; it does not become a replacement for an existing legacy office merely because its label is similar.
- The office picker continues to use the local directory while HRIS is unavailable.
- A newly synced directory entry cannot silently create a duplicate operational office for an existing legacy unit; operational-office creation from synced entries requires a reviewed mapping/reuse decision.
- Sync history identifies the actor, status, timing, and record counts without storing raw API responses or sensitive values.

## Open decisions before implementation

- Does an unfiltered HRIS offices endpoint return the complete office and division roster, or is a different endpoint/query needed?
- Does the live API paginate, and what response envelope indicates completion?
- Which HRIS statuses mean active, inactive, or deleted, and should inactive divisions remain selectable?
- Should parent office code/name be added to `office_lists` and shown in the Offices picker or directory UI?
- Are HRIS-provided email, address, short name, and parent relationships authoritative, or should these remain locally managed?
- Should sync history use a dedicated `hris_office_syncs` table or a shared polymorphic HRIS sync-history table? Prefer a dedicated table unless a shared implementation has a clear existing need.
- Are HRIS `division_code` values stable over time? If HRIS can replace codes, define an administrator-reviewed mapping migration for code changes.
