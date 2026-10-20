# DOTS Current Project Reference

**Reviewed:** October 20, 2026 (Asia/Manila)  
**Scope:** Current workspace source code: routes, controllers, middleware, services, models, migrations, seeders, and React pages. This is a codebase review; it does not confirm production configuration, live database contents, or external service availability.

> This document describes the Laravel application in this repository. The earlier [legacy Project Analysis](PROJECT_ANALYSIS.md) describes the CodeIgniter 3 application and remains a historical reference. [PROJECT_ANALYSIS_V2.md](PROJECT_ANALYSIS_V2.md) and [CURRENT_PROJECT_CONTEXT.md](CURRENT_PROJECT_CONTEXT.md) are earlier summaries and may not include the features listed here.

## Contents

1. [At a glance](#1-at-a-glance)
2. [Technology and architecture](#2-technology-and-architecture)
3. [Functional modules](#3-functional-modules)
4. [Document lifecycle](#4-document-lifecycle)
5. [Access and account rules](#5-access-and-account-rules)
6. [Main data areas](#6-main-data-areas)
7. [Integrations and notifications](#7-integrations-and-notifications)
8. [Legacy migration support](#8-legacy-migration-support)
9. [Implementation boundaries](#9-implementation-boundaries)
10. [Source map](#10-source-map)

## 1. At a glance

DOTS is NCIP's office-based document registration, routing, receipt, tracking, and archiving application. It also has a document authoring and approval workflow that produces versioned PDF documents before they are registered into the main tracking workflow.

The active application is a Laravel 12 project using Eloquent, Inertia, React, and TypeScript. It is not the old CodeIgniter HMVC application. The Laravel app keeps a separate legacy database connection and import tools for staged migration of directory, document, and audit records.

## 2. Technology and architecture

| Area | Current implementation |
|---|---|
| Backend | PHP 8.2+, Laravel 12, Eloquent ORM |
| Web interface | Inertia 2, React 18, TypeScript, Vite, Tailwind CSS |
| Document authoring | Tiptap rich text editor, shared browser/PDF rendering, Dompdf |
| Charts | Recharts-based dashboard chart components and server-side chart services |
| Data stores | Laravel migrations support SQLite and MySQL; a separate `legacy` MySQL connection is configured for old data |
| File storage | New document files use a private local storage disk and an authorized download route; legacy public storage is retained as a compatibility disk |
| Email | Gmail OAuth/API integration for application notices; connection and credentials are environment-configured |
| Imports | Artisan commands preview or apply legacy directory, document, and audit imports |

Typical request path:

```text
Browser (React/TypeScript)
  -> Laravel route and middleware
  -> Controller / application service
  -> Eloquent model and database
  -> Inertia page response
  -> React page update
```

The main route and page map is maintained in [`routes/web.php`](../routes/web.php) and [`resources/js/Pages/`](../resources/js/Pages/).

## 3. Functional modules

### 3.1 Authentication and profile

- Login and logout, registration routes, password reset, password change, password confirmation, and email verification.
- HRIS credential verification can be used for imported accounts that do not yet have a local password; successful HRIS verification sends the user through local password setup.
- Optional reCAPTCHA v2/v3 verification and per-account failed-login counters, cooldowns, and lock state are implemented.
- Inactive or locked accounts are denied access. The authenticated application routes require a verified account.
- Users can update profile information and password through the profile area.

### 3.2 Dashboard

- Office-scoped or privileged all-office document counts for incoming, pending, released, and archived records.
- Counts for authored-document approval work: awaiting the user's approval, the user's submissions awaiting approval, returned revisions, and awaiting verification.
- Recent documents and an incoming-documents list, subject to office and role access.
- Document-type charts and processing-time charts for routing and document approval. Privileged users can filter chart data by office.
- Chart calculations are deferred from the first page response to keep the initial dashboard responsive.

### 3.3 Document register and routing

The `/documents` area provides the main operational document list. Its behavior includes:

- Search matches tracking number, title, status, origin, office, document type, and latest trail/action details. The list also provides status, paging, and sorting controls.
- A latest-documents view at `/documents/latest` (limited to records created within the recent 15-day window).
- Document detail and trail history, including file metadata and available download links.
- Direct document registration with document type, action, purpose, origin, remarks, urgency, notification preference, finalization state, and an optional file.
- Draft records can be edited by their creator or an authorized administrator. Finalized records receive a generated tracking number and an initial pending trail.
- Release to a destination office in the current user's routing range. The destination must have an active user. Release records an `available` trail and may include a new file version.
- Receipt of an incoming record by an eligible receiver at its destination office. Receipt records a `pending` trail and updates receipt metadata.
- Terminal tagging by the current holding office, with a matching archive state and audit events.
- Approved authored documents may be registered as official records or attached as later versions when forwarding an existing document.
- “Others” selections for action, document type, and purpose collect their custom text.

Document attachments are stored privately for new uploads. Downloads pass through a controller route, rather than a public storage URL. Allowed upload formats and maximum size are validated in the application.

### 3.4 Document creation, approval, and PDF output

This is a separate workflow from directly registering an incoming or existing document.

- Authors create and edit saved document drafts, including rich-text body content and document metadata.
- A document type can have a default template version. Templates support a header asset/layout and are versioned so saved and submitted content keeps the correct template snapshot.
- The editor supports common formatting, lists, alignment, and tables on a paginated Letter-size writing surface.
- Users can preview the current content as PDF without saving a draft; submitted-version previews are also available.
- Submission snapshots a version and routes it to an approver office with an active administrator. The author can opt to notify approvers by email.
- Eligible approvers can approve, reject, or request revisions. Revision requests return the work to the author for another version.
- Approved content can be registered into the main document register. A generated PDF is saved as the original document file. Approved output can also be reused as a forwarding version.
- Separate pages/queues expose the author's drafts, review queue, and approved work.

### 3.5 Archives and draft recovery

- `/archives` provides a paginated archive for tracking records with year, text, office (where permitted), and sort filters.
- A holding office can restore its own terminal document. Restoration clears the archive fields, writes a new pending trail, and records an audit event.
- Generated/authoring drafts with an archive timestamp can be viewed through the generation archive and restored to the authoring workflow.

### 3.6 Public document tracking

- A finalized tracking record can be viewed on a read-only public page using a signed tracking URL.
- The public route is rate-limited. It shows selected document metadata and the document routing timeline; it does not expose draft records.
- Archive pages generate signed tracking links for finalized archived records.

### 3.7 Audit trail

- The audit page lists application events with actor and office context, action details, and pagination/filtering.
- Application events include authentication, document creation/routing/receipt/archive actions, authoring decisions, account/library changes, and import activity where recorded.
- Legacy audit history can be imported and displayed with native audit records.

### 3.8 Administration and reference libraries

Administrator-protected features include:

- Offices and routing ranges.
- Document types, action types, and purpose types.
- Document type template assignment.
- User account creation and updates, including role, office/division assignment, active state, and HRIS employee lookup.
- Setup/library navigation pages for agency/office and library views.

These are Laravel feature areas composed of routes, controllers, and React pages; the current project does not use the old CodeIgniter HMVC module folders.

### 3.9 Connected systems

- `/connected-systems` provides a connected-systems landing page.
- `/drip`, `/ipluma`, and `/pdmis` fetch configured `/dots-summary` API data and display normalized document/signing summaries when credentials and endpoints are configured.
- The iPLuma page has its own controller/page; DRIP and PDMIS use the shared integrations controller/page.
- `/admin/gmail` lets an administrator connect or disconnect the system Gmail sender through Google OAuth.

### 3.10 Personal settings

The profile area supports profile edits, password updates, and account deletion through the Laravel profile flow.

## 4. Document lifecycle

### Main tracking record

| Event | Main record state | Trail event |
|---|---|---|
| Saved without finalizing | `draft` | No initial finalized trail |
| Finalized/registered | `pending` | `Finalized` |
| Released to another office | `available` | Release action and destination office |
| Received by destination | `pending` | `Received` |
| Marked complete by holding office | `terminal`, archived | `Tagged as Terminal` |
| Restored by holding office | `pending`, not archived | `Restored from archive` |

The document record and latest trail both contain status information. New workflow changes should preserve their consistency.

### Authored document

The implemented authoring states include `draft`, `pending_approval`, `revision_requested`, `approved`, `rejected`, and `registered`. Verification-related fields and `awaiting_verification`/`verified` states appear in the model/UI and are accepted in some reuse paths, but the inspected routes do not expose a separate verification action. Treat verification as a reserved/incomplete step.

## 5. Access and account rules

- Authenticated operational routes use `auth`, `active.user`, and `verified` middleware. Administrative library/account and Gmail routes also use `administrator` middleware.
- `DocumentAccess` scopes ordinary users to their office and documents that appear in that office's routing trails. Configured privileged roles can view all documents and use office filters.
- Receiving is role-gated. Releasing and terminal tagging require the user's office to be the document's current holding office. A destination must be in the user's range and have an active account.
- The application stores role information in user fields and applies checks through `User` methods. The Spatie permission package is installed, but the inspected gates use these custom role methods.
- Role checks are not fully centralized: `canManageLibraries()`, `isAdministrator()`, `canReceiveDocuments()`, and `DocumentAccess::canViewAllDocuments()` use different role ID/name rules. Confirm intended role mappings when changing permissions.
- Legacy records marked as needing review and archived records are blocked from routine receive/release actions.

## 6. Main data areas

| Data area | Main tables/models | Purpose |
|---|---|---|
| Accounts and organization | `users`, `offices`, `divisions`, `ranges`, `office_lists` | User identity, role, HRIS fields, office/division assignment, and routing organization |
| Document tracking | `documents`, `document_trails`, `document_files` | Official record, movement/receipt history, and protected file metadata |
| Reference data | `document_types`, `action_types`, `purpose_types` | Values used by registration and routing forms |
| Document authoring | `document_creation_drafts`, `document_creation_versions`, `document_creation_events`, `document_assets`, `document_template_versions` | Draft content, immutable submission versions, decisions, template assets, and template history |
| Audit and migration | `audit_trails`, `legacy_document_exceptions`, legacy identity/source columns | Native activity history, import exceptions, and source record identity |
| System services | `gmail_connections`, Laravel cache/jobs tables | Gmail sender connection and queued/background application work |

Legacy-specific Eloquent adapters remain under `app/Models/*Legacy.php`. The current operational models use Laravel's pluralized tables, while the `legacy` database connection accesses the older source schema.

## 7. Integrations and notifications

| Service | Current code behavior | Requirements/limits |
|---|---|---|
| HRIS | Credential verification during eligible first login; employee-code lookup for account setup; office lookup by division | Requires configured HRIS endpoints/token unless sample-fixture mode is enabled |
| DRIP | Fetches and displays document/signing summary data from `/dots-summary` | Endpoint and API key must be configured; API failures or missing config result in an empty list |
| iPLuma | Fetches and displays document/signing summary data from `/dots-summary` | Endpoint and API key must be configured; page is a summary view |
| PDMIS | Fetches and displays document/signing summary data from `/dots-summary` | Endpoint/token must be configured; current Laravel source does not include the legacy DOTS↔PDMIS linking workflow |
| Gmail | Administrator OAuth connection for the system sender; Gmail API mailer supports approval and document-receipt notices | OAuth client credentials, redirect URI, and connected sender are required; actual delivery also depends on queue/runtime configuration |

Email notification options exist for authored-document approval and document receipt. Integrations are environment-dependent; this review did not make live API calls.

## 8. Legacy migration support

The repository contains a `legacy` MySQL connection, legacy model adapters, import services, and Artisan commands:

- `legacy:import-directory` — ranges, offices, divisions, and users.
- `legacy:import-documents` — documents, trails, and attachment metadata.
- `legacy:import-audit` — historical audit entries.
- `legacy:import-all` — runs directory, document, and audit work in dependency order.

Commands support preview mode and guarded apply mode; applying requires the exact target database name. Reports are written as JSON when storage is available. Imported records keep source identifiers and source labels to support reconciliation. Legacy document exceptions can be retained for review instead of being treated as ordinary records.

The document import currently imports attachment metadata; it does not copy the original physical legacy file binaries into the new private storage.

## 9. Implementation boundaries

The following distinctions prevent planned or partial work from being mistaken for a completed module:

- Dashboard charts and processing summaries exist. A separate analytics/reporting route, scheduled analytics snapshots, and the larger report-export plan described in [ANALYTICS_IMPLEMENTATION.md](ANALYTICS_IMPLEMENTATION.md) were not found in the current web routes.
- DRIP, iPLuma, and PDMIS screens display remote summaries; current Laravel code does not show the legacy PDMIS document-link suggestions and link-history workflow.
- Verification status labels/data exist, but a distinct reviewer verification action is not wired in the inspected routes.
- Legacy file rows can be imported as metadata, but import does not migrate the physical files.
- The `setup` library subroutes largely render the shared setup page; offices, ranges, types, actions, purposes, and accounts have their own operational controllers/pages.
- The source review cannot establish what credentials, feature flags, database data, or remote API behavior are active in a deployed environment.

## 10. Source map

| Area | Source |
|---|---|
| Web routes and middleware | [`routes/web.php`](../routes/web.php), [`routes/auth.php`](../routes/auth.php), [`bootstrap/app.php`](../bootstrap/app.php), [`app/Http/Middleware/`](../app/Http/Middleware/) |
| Main tracking | [`DocumentController.php`](../app/Http/Controllers/DocumentController.php), [`Document.php`](../app/Models/Document.php), [`DocumentTrail.php`](../app/Models/DocumentTrail.php) |
| Document authoring | [`DocumentCreationController.php`](../app/Http/Controllers/DocumentCreationController.php), [`DocumentTemplates.php`](../app/Services/DocumentTemplates.php), [`DocumentPdf.php`](../app/Services/DocumentPdf.php), [`resources/js/Pages/DocumentCreation/`](../resources/js/Pages/DocumentCreation/) |
| Dashboard and access | [`DashboardController.php`](../app/Http/Controllers/DashboardController.php), [`DashboardCharts.php`](../app/Services/DashboardCharts.php), [`ProcessingPerformance.php`](../app/Services/ProcessingPerformance.php), [`DocumentAccess.php`](../app/Services/DocumentAccess.php) |
| Archives and public tracking | [`ArchiveController.php`](../app/Http/Controllers/ArchiveController.php), [`PublicDocumentTrackingController.php`](../app/Http/Controllers/PublicDocumentTrackingController.php) |
| Audit | [`AuditTrailController.php`](../app/Http/Controllers/AuditTrailController.php), [`AuditTrailWriter.php`](../app/Services/AuditTrailWriter.php) |
| Accounts and HRIS | [`UserAccountController.php`](../app/Http/Controllers/UserAccountController.php), [`HrisDirectory.php`](../app/Services/HrisDirectory.php), [`LoginRequest.php`](../app/Http/Requests/Auth/LoginRequest.php) |
| External systems and email | [`IntegrationController.php`](../app/Http/Controllers/IntegrationController.php), [`IplumaController.php`](../app/Http/Controllers/IplumaController.php), [`GmailIntegrationController.php`](../app/Http/Controllers/GmailIntegrationController.php), [`GmailApiMailer.php`](../app/Services/GmailApiMailer.php) |
| Legacy imports | [`app/Console/Commands/`](../app/Console/Commands/), [`app/Services/LegacyDirectoryImport.php`](../app/Services/LegacyDirectoryImport.php), [`app/Services/LegacyDocumentImport.php`](../app/Services/LegacyDocumentImport.php), [`app/Services/LegacyAuditImport.php`](../app/Services/LegacyAuditImport.php) |
| Schema | [`database/migrations/`](../database/migrations/) |

