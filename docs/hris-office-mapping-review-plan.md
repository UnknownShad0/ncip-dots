# HRIS-to-DOTS Office Mapping Review Plan

## Purpose

Prepare a reviewable crosswalk from the current HRIS office-directory entries to DOTS operational offices. The current `offices` table is the legacy DOTS roster and may not contain every current HRIS office. The crosswalk will let account creation show current HRIS directory choices while storing the appropriate canonical `offices.id` in `users.office_id`—an existing ID for a continuing legacy office, or a newly created operational ID for a confirmed new office.

This document describes the mapping and review work only. It does not authorize or perform an HRIS sync, database migration, user reassignment, or document update.

## Identity rules

- `office_lists.id` identifies a directory row. `offices.id` identifies a DOTS operational office. They are separate ID spaces and must never be copied between each other.
- `users.office_id` references `offices.id`. `users.legacy_office_id` preserves the legacy source office identifier; it is not an `office_lists.id`.
- The mapping key will be a stable HRIS identifier, initially the HRIS `division_code` because the roster is represented as offices containing divisions. The mapped value is the canonical `offices.id`.
- Office names can be different, abbreviated, outdated, or reused. Exact or approximate name similarity can provide review context but must never create an automatic mapping.
- A full-name match after normalizing case and punctuation is only a candidate; it remains pending review and cannot be used for account assignment until confirmed.
- Multiple HRIS division codes may map to one existing DOTS office if an administrator confirms they are the same DOTS unit. One HRIS division code may have only one active mapping.
- A mapping changes how future assignments resolve. It does not move existing users, documents, routes, trails, or audit history.

## Sources to inspect

1. **HRIS directory:** the complete live `GET /api/offices` response, including each parent office code/name and its nested division codes/names. Confirm pagination and code stability first. The committed fixture is useful for development but is not proof of the current production roster.
2. **Operational DOTS offices:** existing `offices.id`, `code`, `name`, `short_name`, and `legacy_bureau_id`. Treat the primary key and existing references as canonical.
3. **Legacy identifiers:** existing users' `office_id` and `legacy_office_id`, plus the legacy bureau identifiers and office codes available from the migration/import source. Use aggregate counts and identifiers needed for the crosswalk; do not export unrelated user personal data.
4. **Current references:** counts of users and documents associated with each `offices.id`, including office references in document trails and routes. These are for impact review, not for inferring an HRIS mapping from usage.

## Mapping method

### 1. Produce a read-only inventory

Export a dated, access-controlled working inventory with one row per existing operational office and one row per HRIS division. Include stable IDs/codes, labels for human review, parent HRIS office code/name, and aggregate user/document reference counts. Do not change database records during inventory.

### 2. Generate candidates using identifier evidence

For each HRIS division, look for verified identifier relationships in this order:

1. An existing reviewed crosswalk or an HRIS division code already stored on the operational office.
2. An exact stable HRIS office code to existing `offices.code` match, but only when the relationship is at the same organizational level. A parent office code matching a DOTS office does not automatically prove that every nested division should map to it.
3. A documented legacy source crosswalk tying the HRIS division/office code to a legacy bureau identifier and then to `offices.legacy_bureau_id`.

Do not auto-map from names, address, region, or parent/child grouping alone. If the available evidence does not establish the same organizational unit, leave the entry unmapped.

### 3. Classify every result

The review report will assign each HRIS division one of these outcomes:

| Outcome | Meaning | Action |
| --- | --- | --- |
| Exact identifier candidate | Stable identifier evidence points to one existing operational office | Present evidence for review; apply only after confirmation of organizational level |
| Ambiguous | Evidence points to multiple offices, or parent/division granularity is unclear | Leave unmapped and ask an administrator to decide |
| No match / uncertain | No reliable identifier relationship was found, or a rename/reorganization may explain the mismatch | Leave unmapped pending review; do not guess from names |
| Confirmed new HRIS office | Administrator confirms it is a current, distinct DOTS operational office absent from the legacy roster (not merely a division or renamed legacy office) | Create a new operational office through the approved workflow, configure required DOTS settings, then map to its new `offices.id` |
| Retired/obsolete HRIS entry | Source confirms the division is inactive or removed | Keep history; disable future selection according to the confirmed HRIS status policy |

### 4. Deliver a review artifact before applying mappings

Prepare a CSV or Markdown review table with at least:

| HRIS division code/name | Parent HRIS office code/name | Candidate DOTS `offices.id`/code/name | Evidence | Reference counts | Proposed outcome | Reviewer decision |
| --- | --- | --- | --- | --- | --- | --- |

Example only (not a verified mapping): `DIV-4824` / ICTD → candidate `offices.id 21` / OPPR-ICTD. If the only evidence is a similar name, classify it as **No match / uncertain** and leave it unmapped until confirmed. An HRIS entry absent from the legacy roster is not automatically a new DOTS office; confirm that it is a routable/assignable office at the correct organizational level first.

The report must list every HRIS division, including unmapped entries, so the review does not hide gaps. It should also flag duplicate HRIS codes, duplicate operational codes, and one-to-many candidate relationships.

### 5. Apply only approved decisions

Store candidates and approved mappings in `hris_office_mappings`, with a match method and status:

```text
division_code  ->  office_id  | match_method          | status
BSO-422        ->  290        | exact_code            | auto_confirmed
DIV-4824       ->  21         | normalized_exact_name | pending_review
```

The table should also include `mapped_by`, `reviewed_by`, `reviewed_at`, and `review_note`. Enforce one row per HRIS directory code and a foreign key to `offices.id`. Account creation may use only `auto_confirmed` or administrator-`confirmed` rows. Do not update existing `users.office_id` values as part of applying this crosswalk.

### Current database scan

A scan of the configured database found 269 active `office_lists` rows and 293 operational `offices` rows. The `hris_office_mappings` table has now been created and populated with review status:

- 2 rows have a case-insensitive exact match from `office_lists.division_code` to `offices.code`; these are marked `auto_confirmed`.
- 32 additional rows have a unique full-name match after normalizing case and punctuation. These are stored as candidates with `pending_review` status and cannot be used for account assignment until approved.
- The other 235 active directory rows have no unique exact code or full-name match. Partial/fuzzy name similarities are excluded.
- No exact-code match conflicted with a unique normalized full-name match.
- In particular, `DIV-4824` maps as a pending candidate to existing `offices.id = 21` (`CO-OPPR-ICTD`). It remains pending because the match is by normalized name, not shared identifier.

## Runtime assignment flow

1. HRIS sync refreshes `office_lists` by `division_code` and records sync status. It does not modify operational `offices` or user/document rows.
2. An administrator reviews and maps directory divisions to canonical operational offices in the existing Offices module.
3. Account creation displays the latest HRIS directory entry and submits its `division_code`.
4. The server looks up `hris_office_mappings.division_code` and writes the mapped `office_id` to `users.office_id`.
5. If no mapping exists, account creation is blocked with a message that the office needs review. The server never falls back to `office_lists.id` or a name match.
6. For a confirmed new operational office, create/configure its `offices` row first, then map the HRIS division code to its generated `offices.id`. The new user and new documents use that new office ID; legacy data remains under existing office IDs unless a separate approved migration establishes continuity.

## Verification before release

- Every approved mapping points to an existing `offices.id` and uses an HRIS division code present in the synchronized directory.
- No HRIS division is silently mapped from name similarity alone.
- A new ICTD account choosing the HRIS ICTD division stores the reviewed existing ICTD `offices.id` (for example, ID 21 only if the crosswalk confirms it).
- An unmapped HRIS entry cannot create an account assignment.
- Existing `users.office_id`, `users.legacy_office_id`, document office references, route/trail references, and legacy document visibility are unchanged by sync or mapping setup.
- A new ICTD document uses the same canonical office ID as legacy ICTD documents when the mapping confirms that shared identity.
- A confirmed HRIS office absent from the legacy roster receives a new operational office ID only after review and required DOTS configuration; it is not assigned an existing ID based only on a similar name.
- Sync failure preserves the last successful directory; mapping failure does not partially apply decisions.

## Sequence and review gates

1. Confirm the HRIS endpoint contract and whether division codes are stable.
2. Produce the read-only inventory and candidate crosswalk.
3. Review ambiguous, unmatched, and proposed exact-code cases with the DOTS office owner.
4. Approve the mapping table design and Offices-module mapping UI.
5. Implement sync and mapping separately; do not alter existing operational office IDs.
6. Apply only reviewed mappings, then verify account assignment and office-scoped visibility before release.

No name-based mapping should be enabled until its candidate is reviewed. Unique exact-code matches may be stored as `auto_confirmed`; normalized-name candidates remain `pending_review` until an administrator confirms or rejects them.
