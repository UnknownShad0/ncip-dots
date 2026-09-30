# Release receiving office filter (exploratory)

This note records the temporary release-office restrictions being explored. Keep it until the desired policy is confirmed.

## Current behavior

- Legacy receiving bureaus are loaded from `legacy.bureau` and must have an active status (`1`, `active`, `enabled`, or `Y`, case-insensitive).
- Both legacy and current offices are limited to the range resolved from the signed-in user's bureau.
- Options with no active user assigned are disabled in the release modal. Legacy bureaus also must be active.
- The release endpoint repeats the range, bureau-active, and assigned-active-user checks, so a manually crafted request is rejected too.
- Legacy selections use `legacy:<bureauId>` and are resolved to a current `offices` row before release.

## Files and implementation areas

- `app/Http/Controllers/DocumentController.php`
  - `release()`: rechecks range and active-user eligibility.
  - `documentFormOptions()`: filters office choices by the signed-in user's range and loads active legacy bureaus.
  - `currentUserRangeName()`, `legacyBureauIsInCurrentUserRange()`, `officeIsInCurrentUserRange()`, `legacyBureauIsActive()`, `legacyBureauHasActiveUsers()`, and `officeHasActiveUsers()`: implement the exploratory rules.
  - `resolveLegacySelections()`: checks legacy selections and resolves the `to_office_id` value through `office_id`.
  - `mergeOfficeOptions()`: retains the legacy bureau ID in option values and adds the `disabled` flag.
- `resources/js/Pages/Documents/Index.tsx`
  - `LibraryOption.disabled` and the release-office `<option disabled={office.disabled}>` render disabled choices.

## Reverting the exploratory restrictions

When the policy is decided, review these changes before reverting. To remove only the range and active-user experiment while keeping legacy bureaus in the dropdown:

1. Remove the range filtering from the `offices` prop in `documentFormOptions()` and remove the range helper methods and their range imports/cache fields.
2. Remove the active-user/range guard in `release()` and the matching guards in `resolveLegacySelections()`.
3. Remove `disabled` from `mergeOfficeOptions()` and remove the active-user helper methods if they are no longer needed.
4. Remove the `disabled` property from `LibraryOption` and the `disabled` attribute from the receiving-office `<option>`.
5. Keep `mergeOfficeOptions()`'s legacy `bureauId` option values and the `to_office_id` to legacy resolver mapping if legacy bureaus should remain selectable.

Do not revert either whole file: both contain unrelated work. Recheck with the relevant feature tests after deciding the final policy.
