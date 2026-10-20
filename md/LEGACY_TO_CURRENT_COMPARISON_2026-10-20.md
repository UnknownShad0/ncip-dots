# DOTS Legacy-to-Current Comparison

**Reviewed:** October 20, 2026 (Asia/Manila)  
**Legacy baseline:** [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md), [`ERD.md`](ERD.md), and the legacy workflow notes in this folder.  
**Current baseline:** Laravel application routes, controllers, services, models, migrations, and React pages in the workspace.

This comparison lists the legacy capability, its current Laravel counterpart, and the level of implementation visible in the source. “Partial” means a related screen or foundation exists, but the old behavior is not represented end to end in the current app. “Not found” means no current route/model/workflow for the listed legacy feature was found in this review; it does not rule out external or deployment-specific behavior.

## Contents

1. [Summary of the modernization](#1-summary-of-the-modernization)
2. [Module-by-module comparison](#2-module-by-module-comparison)
3. [New capabilities in the current codebase](#3-new-capabilities-in-the-current-codebase)
4. [Architecture and data changes](#4-architecture-and-data-changes)
5. [Items to treat as partial or not migrated](#5-items-to-treat-as-partial-or-not-migrated)
6. [Current module checklist](#6-current-module-checklist)
7. [References](#7-references)

## 1. Summary of the modernization

The project has moved from a CodeIgniter 3 / WireDesignz HMVC application with PHP views and jQuery plugins to a Laravel 12 application with Eloquent, Inertia, React, and TypeScript. The core office-based document tracking workflow continues, while the current code adds a separate document authoring and approval path, versioned templates/PDF output, office-scoped access, private file handling, HRIS account support, and structured legacy import commands.

Some former modules remain as summary pages or are consolidated into shared pages. The connected-system list does not mean every old integration behavior is migrated: the current Laravel pages fetch remote summaries, but the legacy PDMIS-to-DOTS linking workflow is not present in the active Laravel route/model set.

## 2. Module-by-module comparison

| Legacy module or behavior | Current implementation | Status and change |
|---|---|---|
| CodeIgniter HMVC app; module-local controllers/models/views | Laravel routes, controllers, services, Eloquent models, Inertia pages, React/TypeScript components | **Replaced.** The active runtime is Laravel. Legacy module names remain useful as business references, not as current directory structure. |
| Login, forgot password, reset password | Laravel authentication routes and React auth pages; email verification; optional reCAPTCHA; account cooldown/lock; HRIS verification for accounts without a local password | **Modernized and expanded.** Authentication is Laravel-based and account state is enforced by middleware. |
| Dashboard counters and incoming search | Office-aware dashboard statistics, incoming list, recent records, approval counters, document-type charts, processing-time charts, and privileged office filtering | **Modernized and expanded.** Charts are deferred for page responsiveness. No separate full analytics/reporting route was found. |
| Documents list, office scoping, search and filters | `/documents` list/details with office/trail access scope, search, filters, paging, sorting, current status, trail, and file information | **Implemented with changed structure.** Office access is applied through `DocumentAccess`; there is no separate legacy-style `DocumentsAll` module. |
| Documents All administrator screen | Privileged roles can see all documents through shared document access/query behavior | **Consolidated.** All-office visibility is a permission scope, not a separate screen/module. |
| Latest Documents | `/documents/latest` | **Implemented.** It is a mode of the document feature and shares its page/controller. |
| FileUpload module and public `assets/uploads` storage | Uploads are part of document registration/release; new files are private and served through an authorized download controller | **Replaced and expanded.** The dedicated batch-upload page is not present. Legacy attachments may be represented as imported metadata; physical files are not copied by the importer. |
| Document status and routing trails | `documents` plus `document_trails`, with release, receive, terminal, archive, and restore actions | **Implemented and extended.** Current transitions are checked against role, holding office, range, active destination accounts, and archive/review state. |
| Annual archive modules and fixed year-specific pages | One `/archives` area with year/search/sort filters, office filter for privileged roles, signed tracking links, and restore action | **Consolidated and extended.** Terminal records can be restored by their current holding office. |
| Public TrackDocument page | Signed `/track/{trackingNumber}` read-only page for finalized records; rate limited | **Implemented with tighter access.** The route is public to the recipient of a signed URL rather than an unrestricted tracking-number endpoint. |
| AuditTrail server-side DataTables | Native `audit_trails` page with actor/action/details, pagination and office filtering; legacy audit import | **Modernized and extended.** Authentication, document workflow, administration, and import actions are recorded where the application calls the audit writer. |
| DocumentType, ActionType, PurposeType libraries | Administrator pages and Laravel controllers; “Others” values supported in document forms | **Implemented.** Document types can also reference a default document template. |
| Office, Range, and Setup modules | Office hierarchy/range records, divisions, admin setup/library navigation, and dedicated office/range controllers | **Modernized.** The Laravel data model carries new office/division structure while retaining legacy office identity fields for import/reconciliation. |
| UserAccount CRUD and account email | Administrator account management, HRIS employee lookup, office/division assignment, role and active-state management, plus account notification support | **Modernized and expanded.** User records also carry HRIS identifiers and local lockout state. |
| HRIS/employee directory | HRIS service for eligible credential verification and employee/office lookup | **Added/current integration.** External operation depends on HRIS configuration; test fixture mode is available. |
| DRIP document listing | `/drip` fetches and normalizes configured `/dots-summary` data | **Partial/current summary integration.** Current page is read-only summary display; external endpoint/configuration is required. |
| iPLuma document listing | `/ipluma` fetches and normalizes configured `/dots-summary` data | **Partial/current summary integration.** The active page shows document/signing summaries; legacy cache/pagination behavior is not established by the Laravel source. |
| PDMIS document listing and public tracking APIs | `/pdmis` fetches configured `/dots-summary` data | **Partial/current summary integration.** Current code does not reproduce all legacy endpoints/helpers described in the old analysis. |
| PDMIS ↔ DOTS links, suggestions, and link history | No active Laravel link routes/models/tables for the old `document_links`, suggestions, or history workflow were found | **Not found in current app.** The older feature and its ERD remain legacy references. |
| Legacy PHPMailer / Office 365 mail | Laravel notification/jobs and Gmail API mailer with administrator-managed OAuth sender | **Replaced/expanded.** Gmail configuration and queue execution are required for delivery; do not assume the old SMTP configuration is in use. |
| Document authoring and approval | Rich-text editor, saved drafts, immutable submitted versions, approver decisions, revision resubmission, PDF preview, and official registration | **New current module.** This workflow is distinct from ordinary document registration and routing. |
| Document templates | Versioned document template records/assets, template selection on document types, imported/seeded template support | **New current module.** Template snapshots are used in saved/submitted output so later template changes do not rewrite old versions. |
| Excel/report export noted in old plans | Laravel Excel package is installed, but no equivalent current export workflow was found in the inspected routes/pages | **Not confirmed as implemented.** Package presence alone does not establish a user-facing export module. |

## 3. New capabilities in the current codebase

The following features are visible in current Laravel source and were not part of the legacy module list as described in `PROJECT_ANALYSIS.md`:

1. **Authored document workflow:** document drafting, submission, review decisions, revision rounds, approval queue, and registration as an official DOTS record.
2. **Versioned templates and assets:** template versions associated with document types, controlled asset import, template snapshots, and browser/PDF rendering.
3. **Rich-text editing and PDF preview:** Tiptap editing with tables and formatting, Letter-size page layout, generated PDF previews, and font handling.
4. **Approved document reuse:** approved generated output can be registered as an original or attached as a version while forwarding another document.
5. **Office-aware access and workflow checks:** document visibility follows office assignment and routing trails; release destinations must be in-range and staffed by active accounts.
6. **Archive lifecycle:** terminal tagging archives records, current-holder restoration reopens them with a new trail, and generated drafts have their own archive view.
7. **Private document storage:** new uploads use private storage and authorization-controlled downloads.
8. **HRIS-backed account support:** employee-code lookup and credential verification for first password setup.
9. **Gmail OAuth sender connection:** administrator-managed connection for approval and receipt notices.
10. **Structured migration tools:** preview/apply import commands for directory, documents/trails/attachment metadata, and audit history, with identity mapping, reports, and exception handling.
11. **Login protection and account state:** failed-login counters, progressive cooldowns, permanent lock state after repeated failures, and active-account enforcement.
12. **Dashboard processing performance:** median weekday duration charts for document routing and approval history.

## 4. Architecture and data changes

| Topic | Legacy shape | Current shape |
|---|---|---|
| Backend | CodeIgniter 3, HMVC extension, custom base controller | Laravel 12 routes/controllers/services and middleware |
| Frontend | PHP-rendered pages, AdminLTE/Bootstrap, jQuery, DataTables | Inertia page responses, React/TypeScript, Tailwind, Vite |
| Domain access | CodeIgniter query builder and shared model helpers | Eloquent models and explicit application services such as `DocumentAccess` and `AuditTrailWriter` |
| Main tables | Legacy singular names such as `document`, `document_trail`, `user`, `bureau` | New Laravel tables such as `documents`, `document_trails`, `users`, `offices`, and `divisions`, with legacy identity/source fields during transition |
| Schema evolution | Ad hoc SQL/migration scripts described in the legacy analysis | Ordered Laravel migrations and seeders |
| Files | Legacy upload folders under web-root assets | New private-disk storage and database file metadata; read-only compatibility disk for older public files |
| Legacy data | Directly used in the old application | Separate `legacy` connection, adapters, explicit import plan, and source identity mapping |
| Roles/access | Session checks and special-case role logic in the old app | Middleware, user role helpers, and office-aware document scopes; some role ID rules still differ between helpers |

Current primary data groups:

- **Organization and users:** `users`, `offices`, `divisions`, `ranges`, and `office_lists`.
- **Tracking:** `documents`, `document_trails`, and `document_files`.
- **Libraries:** `document_types`, `action_types`, and `purpose_types`.
- **Authoring:** `document_creation_drafts`, `document_creation_versions`, `document_creation_events`, `document_assets`, and `document_template_versions`.
- **Audit and transition:** `audit_trails`, `legacy_document_exceptions`, and legacy identity/source columns on migrated records.
- **Services:** `gmail_connections` and Laravel cache/job tables.

## 5. Items to treat as partial or not migrated

- **DRIP, iPLuma, and PDMIS:** The current pages can retrieve and show configured summaries. They do not, by themselves, prove that all former filtering, caching, API actions, or PDMIS tracking/linking behavior was carried over.
- **PDMIS document linking:** The legacy analysis describes links, suggestions, and link history. Those current Laravel models/routes were not found in the active source inventory.
- **Full analytics/reporting:** Dashboard counters, charts, and processing performance are implemented. A standalone analytics module, snapshot refresh, and planned export/report screens were not found in `routes/web.php`.
- **Document verification:** Some status values and UI labels exist, but no separate verification action was found in current routes.
- **Legacy attachment binaries:** The document import handles attachment metadata; it reports that physical legacy files remain unavailable until migrated separately.
- **Production integrations and configuration:** This source review did not inspect `.env` secrets, deployed database contents, API reachability, Gmail consent, storage ACLs, or production mail queue behavior.

## 6. Current module checklist

- [x] Authentication, password reset/update, email verification, active/locked account checks
- [x] Dashboard, office-scoped metrics, charts, recent and incoming document lists
- [x] Document register, details, search, latest view, attachments, and trail history
- [x] Release, receive, terminal, archive, and restore actions
- [x] Authored document editor, draft list, approval/revision/rejection, preview, and registration
- [x] Document template versions, assets, and PDF generation
- [x] Tracking archive and authoring-draft archive
- [x] Signed public tracking for finalized records
- [x] Native audit trail and legacy audit import
- [x] Office, range, document type, action type, purpose, and account administration
- [x] HRIS employee/account lookup; configured DRIP, iPLuma, and PDMIS summary views
- [x] Administrator Gmail OAuth connection and notification sender
- [x] Legacy directory/document/audit preview and import commands
- [ ] Separate authoring-document verification action
- [ ] Full legacy PDMIS document-linking workflow
- [ ] Separate analytics/report-export module
- [ ] Physical binary migration for legacy attachments

The unchecked entries describe boundaries found during this source review, not a release commitment.

## 7. References

- [Current project reference](PROJECT_CURRENT_STATE_2026-10-20.md)
- [Legacy system analysis](PROJECT_ANALYSIS.md)
- [Earlier Laravel project analysis](PROJECT_ANALYSIS_V2.md)
- [System analysis and end-to-end flow](SYSTEM_ANALYSIS_AND_FLOW.md)
- [Current/legacy document, trail, and user relationships](DOCUMENT_USER_TRAIL_RELATIONSHIPS.md)
- [Legacy database compatibility notes](LEGACY_DB_COMPATIBILITY.md)
- [Document generation change log](DOCUMENT_GENERATION_CHANGELOG_2026-10-16.md)

