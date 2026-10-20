# DOTS Changes from Legacy to Current

**Reviewed:** October 20, 2026 (Asia/Manila)  
**Scope:** Changes visible in the current workspace compared with the legacy system described in [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md). This is a source-code summary, not a production deployment audit.

For the full current module description, see [PROJECT_CURRENT_STATE_2026-10-20.md](PROJECT_CURRENT_STATE_2026-10-20.md). For the module-by-module status matrix, see [LEGACY_TO_CURRENT_COMPARISON_2026-10-20.md](LEGACY_TO_CURRENT_COMPARISON_2026-10-20.md).

## Platform and UI

- Replaced the CodeIgniter 3/HMVC application with Laravel 12, Eloquent, and Laravel middleware.
- Rebuilt the interface with Inertia, React, TypeScript, Tailwind CSS, and Vite instead of PHP views, AdminLTE, jQuery, and DataTables.
- Added shared React pages and components for navigation, forms, tables, dialogs, document editing, previews, and charts.

## Authentication and accounts

- Added Laravel login/logout, password reset and update, password confirmation, registration, and email verification.
- Added optional reCAPTCHA and failed-login tracking with progressive cooldowns and account locking after repeated failures.
- Added active and locked account checks.
- Added HRIS credential verification for eligible accounts that need to set a local password.
- Added administrator account creation and updates, HRIS employee lookup, office/division assignment, role management, and active status management.

## Dashboard and efficiency analysis

- Added office-scoped counts for incoming, pending, released, and archived documents.
- Added counts for items awaiting approval, submissions awaiting approval, returned revisions, and items awaiting verification.
- Added recent and incoming document lists.
- Added document-type charts and office filters for authorized users.
- Added processing charts for routing and approval times, measured as median elapsed weekdays.

## Document tracking and routing

- Added document search, status filters, sorting, paging, a details view, and a latest-documents view.
- Added direct document creation with tracking numbers, metadata, urgency, remarks, optional files, and draft/finalized states.
- Added office-based access to records and their routing history.
- Added release, receipt, and terminal actions with role, holding-office, range, and destination-office checks.
- Added “Others” values for document type, action, and purpose.
- Added the ability to include approved generated documents when registering or forwarding tracked documents.

## Document generation, approval, and drafts

- Added a rich-text document editor with formatting, lists, alignment, tables, and a paginated Letter-size layout.
- Added versioned templates and assets, with template assignment to document types.
- Added PDF previews for current drafts and submitted versions.
- Added saved drafts, version snapshots, and document creation event history.
- Added approval queues and approve, reject, and request-revision decisions.
- Added resubmission after revisions and optional email notification to approvers.
- Added registration of approved documents into the tracking workflow, with generated PDFs stored as document files.
- Added a drafts module and a separate queue for approved work.
- Added an archive view and restore flow for archived generated drafts.

## Archives, files, and public tracking

- Replaced separate annual archive pages with one archive view that supports year and text filters, sorting, and authorized office filtering.
- Added restore for eligible terminal documents, with a new trail event.
- Moved new document uploads to private storage and added authorized downloads.
- Added signed, rate-limited public tracking links for finalized documents.

## Audit, administration, and integrations

- Added structured audit records for application activity, including authentication and document workflow events.
- Added office filtering to audit history for authorized users.
- Added administrator pages for offices, ranges, document types, action types, purpose types, and user accounts.
- Added HRIS employee and office lookup.
- Added configured summary views for DRIP, iPLuma, and PDMIS.
- Added Gmail administration with OAuth connect/disconnect and queued email notifications for approval requests and document receipts.

## Legacy data and schema

- Added a separate legacy database connection and legacy model adapters.
- Added preview/apply import commands for legacy directory records, documents and trails, attachment metadata, and audit history.
- Added source identifiers and exception handling to support migration review.
- Added Laravel migrations for the modernized schema, including document authoring, templates, Gmail connections, and login tracking.

## Data optimization and reliability

- Added database indexes for common document, trail, archive, approval-queue, event-history, and audit-history queries, including office/status and chronology lookups.
- Optimized office-scoped document access by joining indexed ID branches instead of evaluating a correlated office-history query for every document.
- Calculate dashboard summaries and latest-trail status in database queries; eager-load related records for document, archive, audit, and approval lists.
- Paginate document, archive, audit, and approval lists; defer dashboard chart and processing calculations until after the summary cards render.
- Read large legacy imports and processing histories in bounded chunks rather than loading the complete history into memory.
- Run approval and receipt email notifications as queued jobs with retries and backoff.
- Store template assets under SHA-256-derived paths to reuse duplicates and verify file contents before rendering.

## Security and data protection

- Require authentication, active-account checks, and email verification for operational routes; apply additional administrator authorization to setup, account, and Gmail administration routes.
- Scope ordinary document access by office and routing history; enforce role/current-office rules for workflow actions, with restoration limited to the current holding office.
- Hash passwords and enforce a minimum password policy of eight characters with mixed case, numbers, and symbols.
- Track failed login attempts per account: apply a 60-second cooldown after the third failure, a 120-second cooldown after the fourth, and lock the account after five failures within the 24-hour tracking window.
- Support optional reCAPTCHA v3 login verification with a v2 challenge for low scores. Apply endpoint throttles to registration and password-reset requests (5/minute), email verification (6/minute), public tracking and document previews (30/minute), and HRIS employee lookup (20/minute).
- Regenerate the session after login and invalidate it at logout.
- Store new document files privately. Downloads verify office-based document access, reject unsafe paths, and send private/no-store and `nosniff` response headers.
- Restrict public tracking to finalized records through signed, rate-limited URLs.
- Validate generated document content against an allowlisted rich-text schema, escape text when rendering HTML, and limit content size, nesting, node count, and table dimensions.
- Validate template image type, file size, and dimensions; verify the stored image against its SHA-256 path before use.
- Protect Gmail OAuth with session-bound state validation, encrypt stored access and refresh tokens, request the Gmail send scope, and retain TLS verification for Google requests.
- Guard legacy imports with preview mode, an exact target-database requirement for apply mode, transactional writes, and retained reports/exceptions.

## Partial or not found in the current code

- The legacy PDMIS-to-DOTS linking, suggestions, and link-history workflow.
- A separate verification action for generated documents.
- A standalone analytics/export module beyond dashboard charts.
- Import of physical legacy attachment files; current document import handles attachment metadata.
- General query-result caching or a separate analytics snapshot store was not found in the current implementation.

