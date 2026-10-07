# Document Release Office Range Filter

This document describes how the receiving-office list is restricted to the signed-in user's assigned range.

## Range resolution

The controller resolves the user's range from their assigned office in the new database:

1. Look up `users.office_id` in `offices`.
2. If that office's `range_id` points to a row in the new `ranges` table, use the identity `new:<range id>`.
3. Otherwise, if its `legacy_range_id` points to a row in legacy `rangeregion`, use `legacy:<range id>`.
4. If the user has no resolved `office_id`, try their `office_code`; if needed, fall back to `legacy_office_id` and that legacy bureau's `range` value.

Range identity includes its source. A new range with ID `4` is distinct from a legacy range with ID `4`.

## Receiving office options

The release form lists rows from the new database's `offices` table that resolve to the same range identity as the sender. An office's range comes from its valid `range_id` first, then its valid `legacy_range_id`. If neither is available, the controller can resolve a matching legacy bureau by office name.

Offices without an active recipient remain visible but disabled. If the sender has no resolvable range or no offices match it, the dropdown has no receiving-office choices and displays a message.

Legacy bureaus are not listed directly as receiving options. Release trails store a new-database office ID, so a legacy office must have a corresponding `offices` row to be selectable.

## Release validation

The `release()` endpoint repeats the range check before checking that the target office has an active recipient. This rejects a forged or stale request even if the browser submits an office that was not in the filtered dropdown.

Legacy-formatted selections (`legacy:<bureau id>`) are also checked against the sender's range, legacy bureau status, and active-recipient requirement before resolution to an `offices` row.

## Manual verification

1. Sign in as a user whose assigned office has a valid new `range_id`. Confirm the dropdown lists only new-database offices with that same new range ID.
2. Repeat with a user assigned an office whose range is set by `legacy_range_id`. Confirm only offices with that same legacy range ID are listed. A numerically identical ID from the new `ranges` table must not match.
3. Sign in as a user with no resolvable office range. Confirm the dropdown reports that no receiving offices are available.
4. Confirm an in-range office with no active recipient is disabled.
5. Submit a valid in-range office and confirm the document releases successfully.
6. Submit an out-of-range office ID directly to the release endpoint and confirm the request is rejected with a `to_office_id` validation error.

Implementation: `app/Http/Controllers/DocumentController.php` and `resources/js/Pages/Documents/Index.tsx`.
