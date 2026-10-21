# HRIS Employee Library Plan

## Goal

Create a local, searchable copy of HRIS employee records so employee lookup remains available when the HRIS API is unavailable. Add employee name search to user-account creation and an administrator-managed **HRIS Employees** page under the Library module, including a button to sync the latest employee roster from HRIS.

## Current state

- `HrisDirectory` currently looks up an employee by code using `GET /api/employees/{employeeCode}`. It does not persist the response.
- In sample-data mode, the service loads `tests/Fixtures/hris/get-employee.json` as a list and searches it locally. The fixture has 1,621 employee records, which can be used to exercise roster import and search behavior.
- The configured live `GET /api/employees` endpoint was checked and returned a bare JSON list of 1,624 employees. The fixture contains 1,621 records and remains useful for sample mode and development.
- User-account creation currently starts lookup by employee code. The document-creation page is not currently wired to `HrisDirectory`.

## Proposed experience

### Library > HRIS Employees

- Add an **HRIS Employees** entry to the Library navigation.
- Show a read-only, searchable, paginated employee table. Suggested columns: employee code, full name, username, division, position, employment status, and last synced time.
- Add a **Sync from HRIS** button. The button asks the application server to fetch the latest roster from the configured HRIS API and upsert the local directory. The browser must not receive or use the HRIS API token.
- Show sync state and results: syncing, last successful sync, records added/updated, and a clear error if sync fails. Keep the last successful local copy when the API is unavailable or a sync is incomplete.
- Restrict viewing and sync actions to authorized administrators and record who started a manual sync.

### User-account creation lookup

- Let an administrator search by employee code or by full/partial name (first, middle, last, or combined name).
- Return matching local employees in a selectable result list, including enough identifying details to disambiguate people with similar names.
- Selecting a result uses its canonical employee code and the server-side directory record to populate account details. The account form must not be able to substitute edited employee identity fields for the selected HRIS record.
- Keep lookup functional from the local copy during an HRIS outage. If no local match exists, an optional live lookup can be attempted while the API is available.

## Local data and privacy

- Create a separate `hris_employees` table; do not create application accounts for every HRIS employee.
- Use `employee_code` as a unique lookup key and retain `employee_id` if it is stable and useful for reconciling HRIS changes.
- Store only fields needed for directory search, account creation, and document workflows: employee code, names, username, email, division code/name, position/designation, employment status, relevant employment dates, and sync timestamps. Confirm the final field list against actual screens before implementation.
- Do not copy TIN, bank details, or residential/permanent addresses into the local directory. Do not retain the raw API response by default.
- Treat the local directory as HR data: authorize access, validate search inputs, and avoid writing personal values to logs.

## Sync behavior

1. The live roster endpoint and bearer-token authentication are confirmed. Recheck pagination and inactive/terminated employee semantics if the HRIS response format changes.
2. Implement one server-side sync operation used by both the **Sync from HRIS** button and a CLI command for operations.
3. Fetch roster pages in batches and upsert by the chosen stable identifier. Prevent overlapping sync runs.
4. Track sync start/end, status, record counts, and a sanitized error summary. Update the last-successful-sync timestamp only after all pages complete successfully.
5. Do not delete or mark records inactive based on a failed or partial response. Only reconcile missing employees after a complete roster fetch and once HRIS removal/status semantics are confirmed.
6. Keep scheduled sync as a later optional addition; the manual button is the initial requested workflow. A schedule can be added once the appropriate freshness interval and API load are agreed.

The roster endpoint currently returns the full list in one response. The fixture can validate importer behavior in sample mode, but it is not a production source of truth.

## Implementation sequence

1. Verify the live HRIS roster API contract and approve the minimal stored field list.
2. Add the employee-directory schema, model, and indexed name/code search.
3. Add the reusable server-side roster importer, sync status tracking, and administrator-only sync endpoint.
4. Add the HRIS Employees Library page, table, search, pagination, and **Sync from HRIS** action.
5. Update user-account creation to search by employee code or name and select from local results.
6. Confirm the cached lookup works with the HRIS API unavailable and that incomplete syncs preserve the last good directory.

## Acceptance criteria

- An administrator can find an employee by exact code and by partial or combined name.
- A selected employee can be used to create an account from canonical directory values.
- The Library page shows the local employee directory and when it was last successfully synced.
- The sync button copies the complete roster from the live API, handles pagination, and reports its result.
- A failed or partial sync leaves the prior complete local copy usable.
- TIN, bank details, and home addresses are not copied to the local employee directory.
- The employee lookup works while HRIS is offline for records already in the local directory.

## Current status — 2026-10-21

- The live `GET /api/employees` request returned 1,624 records.
- The HRIS Employees Library page, administrator sync button, reusable sync command, local-first employee lookup, and user-account name search are implemented.
- The local MySQL development database was migrated and initially synced: 1,624 employees added.
- Local lookup for `CARLOS P. BUASEN` and employee code `EMP-12720` returned the cached record with the HRIS URL disabled.
