# DOTS System-Wide Module Opportunity and Improvement Roadmap

**Reviewed:** October 25, 2026 (Asia/Manila)  
**System:** NCIP Document Tracking System (DOTS)  
**Review type:** Static source-code, schema, documentation, test, build, and recent local-log review, supplemented by Philippine government and security references  
**Production behavior changed by this document:** None

## 1. Executive recommendation

DOTS already has a substantial core: document registration, office routing, sequential and parallel approvals, document authoring and PDF generation, QR/email-OTP receiving, wet-signed file handling, archives, audit trails, HRIS synchronization, email notification controls, dashboards, and read-only connected-system views.

The highest-value next step is **not** to add many unrelated screens immediately. The recommended sequence is:

1. Stabilize the release baseline, database migrations, authorization structure, queues, file security, backups, and automated tests.
2. Build an **SLA, deadline, and escalation module** because it directly reduces delayed transactions and makes routing performance actionable.
3. Build **records classification, retention, legal hold, and authorized disposition** because DOTS manages government records and the current archive is a lifecycle status, not a records-management program.
4. Add **access-aware full-text search and OCR** so the accumulated records become genuinely retrievable.
5. Complete the **notification center and email audit**, then add delegation, workflow templates, digital-signature verification, and a reliable integration hub.

### Recommended top five

| Rank | Module                                                         | Main benefit                                                           | Priority               | Relative effort |
| ---: | -------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------- | --------------- |
|    1 | SLA, deadline, and escalation management                       | Prevents stalled documents and supports Citizen's Charter reporting    | P0 after stabilization | Medium          |
|    2 | Records classification, retention, legal hold, and disposition | Protects government records and creates a defensible archive lifecycle | P0/P1                  | High            |
|    3 | Security classification and document-level access control      | Prevents overexposure of sensitive records beyond simple office scope  | P0/P1                  | High            |
|    4 | Enterprise search, OCR, and duplicate detection                | Makes scanned and historical documents searchable and reusable         | P1                     | High            |
|    5 | Unified notifications, reminders, escalation, and email audit  | Reduces missed assignments and provides delivery accountability        | P1                     | Medium          |

The best first business module is the SLA module, but it should only be released after the stabilization gates in Section 5 are met.

## 2. Scope and limitations

### Reviewed

- Laravel routes, controllers, middleware, models, services, jobs, console commands, and configuration;
- React/TypeScript pages and shared components;
- database migrations and legacy-import support;
- feature, unit, and JavaScript test inventory;
- project plans and current-state documents under `docs/` and `md/`;
- recent entries in `storage/logs/laravel.log`;
- a production frontend/SSR/document-renderer build;
- a full PHP automated-test run;
- official or primary external references listed in Section 12.

### Not verified

- live production database contents and migration state;
- production web server, TLS, firewall, object storage, queue worker, cron, and backup configuration;
- actual availability or contract of HRIS, DRIP, iPluma, and PDMIS services;
- production performance under realistic concurrent load;
- organizational policies, approved records-disposition schedules, Citizen's Charter entries, and NCIP data-classification rules.

Recommendations involving legal retention, public disclosure, electronic signatures, or personal data require confirmation by the Records Officer, Data Protection Officer, Legal Office, and business process owners.

## 3. Current system map

| Area                           | Current state found in the repository                                                                                     | Assessment                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Authentication                 | Local login, HRIS credential verification for password setup, reCAPTCHA support, failed-attempt cooldown and account lock | Strong base; public self-registration and lack of MFA/SSO need a policy decision                       |
| User and office administration | Users, roles, offices, divisions, ranges, HRIS employee library and sync                                                  | Live; role rules are partly hard-coded and navigation visibility is separate from action authorization |
| Document register              | Registration, metadata, attachments, finalization, tracking numbers, receive/release/terminal actions                     | Live and central to the system                                                                         |
| Routing and approvals          | Sequential/parallel multi-office routes, child routes, route editing, approve/reject/request changes                      | Live; complexity is concentrated in a very large controller and page                                   |
| Document authoring             | Rich-text templates, version snapshots, preview, approval, generated PDF reuse                                            | Live; valuable differentiator                                                                          |
| QR workflow                    | Signed public tracking URL, OTP verification, receive/decision/forward, wet-signed PDF upload                             | Implemented; policy and security hardening remain important                                            |
| File management                | Private storage for new files, authorized download/view, version metadata, SHA-256 for signed files                       | Good base; no malware quarantine/scanning was found                                                    |
| Archive                        | Tracking archive, generated-document archive, restore flows                                                               | Live; not yet a complete retention/disposition system                                                  |
| Audit                          | Actor/office snapshots, action, subject model, result, IP and user agent                                                  | Live; needs tamper-resistance, monitoring, retention rules, and consistent event taxonomy              |
| Email                          | SMTP configuration/status, pause/resume automation, test email, queued document notifications                             | Live; recipient/outcome audit is still a proposal                                                      |
| Dashboard                      | Office-scoped counts, recent/incoming work, document-type and processing-time charts                                      | Live; lacks SLA, aging, workload, and executive compliance views                                       |
| Connected systems              | DRIP, iPluma, and PDMIS summary fetching and display                                                                      | Read-oriented integration; no durable sync/outbox/webhook framework was found                          |
| Maintenance and navigation     | Maintenance modes and role-based navigation visibility                                                                    | Live; navigation visibility must not be treated as the primary authorization layer                     |
| Legacy migration               | Directory, document, audit, and asset import commands plus legacy models                                                  | Extensive; migration closure and reconciliation still need an explicit exit plan                       |

Existing proposal documents should be treated as backlog inputs, not duplicated as new ideas:

- [Early next office activation](early-next-office-activation-proposal.md)
- [Email notification audit](email-notification-audit-plan.md)
- [Wet-signing plan](wet-signing-plan.md)
- [Editable sequential approval route](editable-sequential-approval-route-plan.md)
- [QR/email OTP receiving](qr-email-otp-document-receiving-plan.md)

## 4. Evidence-based findings

### Strengths worth preserving

- New files use private storage and are served through authorized routes; public tracking does not directly expose attachments.
- Signed-document metadata already includes `signature_method` and `sha256`, which is a useful foundation for verification.
- Routing supports sequential, parallel, and child-route workflows instead of only a single destination.
- Document creation versions and template snapshots preserve what was reviewed and approved.
- Audit events capture actor and office snapshots, reducing dependence on mutable user assignments.
- Time display has explicit Asia/Manila handling in the frontend.
- The production build completed successfully for the client bundle, SSR bundle, and document renderer.

### Release risks found during this review

1. **Automated test baseline is not green.** The full run ended with **117 passed, 94 failed, 1,076 assertions**. Failures included inactive default test users, missing `system_maintenance_settings` in partial test schemas, and Chromium PDF-rendering failures. Some failures are test-environment problems, but they still prevent the suite from reliably detecting regressions.
2. **Recent local logs show schema/query drift.** Examples include library queries expecting an `id` column and an audit query referencing a non-existent `subject_id`. The latter appears to come from an ad-hoc command rather than an application request, but both demonstrate the need for schema-version checks and reproducible environments.
3. **Public self-registration remains enabled** in `routes/auth.php`. For an internal government workflow, administrator/HRIS provisioning is normally safer unless an approved enrollment process exists.
4. **No application scheduler jobs are defined.** `routes/console.php` only contains the default `inspire` command. Deadline reminders, escalation, retention review, integration reconciliation, queue health, and backup verification will need a real scheduler.
5. **No repository CI or deployment definition was found.** There is no visible `.github` workflow, container/deploy definition, or worker/scheduler process configuration.
6. **Authorization is difficult to maintain.** No Laravel policy classes were found, only two Form Request classes exist, and most validation/authorization is embedded in controllers and services. `spatie/laravel-permission` and Sanctum are installed, but no active role/permission or API-token usage was found.
7. **Core files are too large.** `DocumentController.php` is about 2,494 lines, `Documents/Index.tsx` about 2,018 lines, `DocumentCreation/Index.tsx` about 1,331 lines, and `DocumentCreationController.php` about 984 lines. This raises regression and review risk.
8. **File security is incomplete.** Extension/type/size checks and private storage exist, but no malware scanning, quarantine state, or content-disarm flow was found. Some document uploads allow files up to 100 MB.
9. **The frontend build has large chunks.** A generated chunk exceeded 500 kB and Vite recommended code splitting. The build still passed.
10. **Archive does not equal disposition.** `is_archived` and `archived_at` support operational archiving/restoration, but no record series, retention trigger, legal hold, transfer, destruction authority, or disposition certificate was found.

## 5. Stabilization gates before major expansion

These are prerequisites, not optional cleanup. Adding complex modules on top of an unreliable release baseline will make future failures harder to isolate.

### Gate A — Reproducible database and green test baseline

- Make every test use the complete migration set or an explicitly maintained schema fixture.
- Update factories so active accounts are active by default where appropriate.
- Provide a deterministic PDF-renderer test mode or a documented Chromium dependency for CI.
- Add a schema-health command that checks the migration batch, required columns/indexes, storage access, queue tables, and scheduler heartbeat.
- Resolve or formally explain every failing test; do not merely reduce the reported test set.
- Minimum release rule: unit, feature, and JavaScript tests pass in CI from a clean database.

### Gate B — Authorization and account provisioning

- Decide whether public registration is allowed. If not, remove the GET/POST registration routes and use administrator/HRIS provisioning only.
- Introduce Laravel Policies for Document, Route, RouteStep, File, Audit, User, and administration actions.
- Use one permission source of truth. Either fully adopt the installed Spatie permission package with migrated roles/permissions or remove it and formalize the current role service; avoid two competing systems.
- Separate **menu visibility** from **server authorization** in naming, testing, and documentation.
- Add MFA for privileged users; consider organizational SSO if an approved identity provider is available.
- Add session/device management, forced logout after account/role changes, and periodic privileged-access review.

### Gate C — Safe file ingestion and storage

- Upload to a quarantine area first, validate extension and file signature, scan for malware, then promote to permanent private storage.
- Use generated storage names; retain the original name only as metadata.
- Block active content where unnecessary and define how DOC/DOCX files are safely previewed or converted.
- Add file-integrity hashes to every stored version, not only signed versions.
- Define encryption-at-rest, key rotation, storage quota, and immutable/locked backup requirements with infrastructure owners.

### Gate D — Queues, scheduler, and observability

- Add queue-worker supervision, retry/backoff standards, dead-letter review, queue-age alerts, and idempotent jobs.
- Run Laravel's scheduler every minute and implement a scheduler heartbeat.
- Use structured logs with a request/correlation ID, document ID, route ID, safe user ID, event name, outcome, and latency.
- Never log OTPs, passwords, tokens, full sensitive document titles, full email addresses, attachment contents, or raw third-party payloads.
- Add health checks for database, cache, queue, private storage, mail, PDF renderer, HRIS, and connected systems.

### Gate E — Backup and disaster recovery

- Approve recovery point and recovery time objectives for database, files, configuration, and audit data.
- Maintain encrypted off-site or logically isolated backups.
- Test restoration using sampled records and attachments, then record the evidence and elapsed recovery time.
- Include queue state, encryption keys, templates, and system documentation in recovery planning.

### Gate F — CI/CD and release governance

- On every change: install from lockfiles, run PHP tests, JS tests, TypeScript, production build, formatting, dependency audit, and migration checks.
- Use a staging environment with production-like queue, scheduler, storage, and PDF rendering.
- Require database backup and rollback/runbook review before risky migrations.
- Add post-deployment smoke tests for login, registration policy, document search, receive/release, approval, download authorization, email queueing, and QR access.

## 6. Recommended modules in detail

### 6.1 SLA, deadline, and escalation management

**Priority:** P0 after stabilization  
**Impact:** Very high  
**Why it matters:** DOTS measures some processing duration, but it does not assign enforceable due dates to a document or each route step. A workflow can therefore show where a document is without actively preventing delay.

Republic Act No. 11032 requires unique identification/acknowledgment and prescribes processing-time expectations for covered government transactions, subject to the agency's Citizen's Charter and transaction classification. DOTS should not assume that every internal document is directly covered; it should allow policy owners to configure which service or document type is covered and what clock applies.

**Core features**

- service/transaction catalog: simple, complex, highly technical, internal, or custom;
- versioned SLA rules by document type, purpose, action, office, and service;
- Philippine working-day calendar with holidays, suspensions, office closures, and cut-off times;
- `due_at`, warning threshold, breach time, completion time, and pause/resume reason;
- per-route-step deadlines and an overall document deadline;
- automatic reminders and escalating notifications to assignee, office administrator, and process owner;
- extension request and approval with written reason, old/new due date, actor, and timestamp;
- aging buckets, breached items, at-risk items, average/median/P90 duration, and bottleneck reports;
- SLA history that survives later rule changes.

**Suggested data**

- `service_catalogs`
- `sla_policy_versions`
- `business_calendars` and `calendar_exceptions`
- `document_deadlines`
- `deadline_events`
- `escalation_rules`

**Important rules**

- Snapshot the SLA policy used when the document enters the process.
- Define whether the clock starts at first receipt, completeness validation, or another approved event.
- Never silently recalculate historical deadlines when a policy changes.
- Pauses and extensions require authorized reasons and audit entries.
- Scheduler jobs must be idempotent so a reminder is not sent repeatedly after retries.

**Minimum acceptance criteria**

- Users can see “due in,” “at risk,” and “overdue” states using Manila time.
- Authorized users can explain every paused or extended clock.
- Management reports reconcile to raw deadline events.
- Holiday and suspension tests cover boundary cases.

### 6.2 Records classification, retention, legal hold, and disposition

**Priority:** P0/P1  
**Impact:** Very high  
**Why it matters:** The current archive is reversible operational storage. Government records management additionally needs record series, approved retention, preservation/transfer, legal hold, and authorized disposition.

The National Archives of the Philippines states that agencies need Records Disposition Schedules and that public records must not be disposed of without the required written authority. The module must therefore create a review-and-authorization workflow, not an automatic delete timer.

**Core features**

- record-series catalog mapped to document types and business processes;
- versioned ARDS/GRDS references and retention triggers;
- active, semi-active, inactive, permanent, archival, transfer-ready, and disposition-review states;
- legal/administrative/audit hold with scope, authority, reason, start/end, and custodian;
- vital-record flag and protection priority;
- disposition review batch with Records Officer and required approving authorities;
- transfer manifest, destruction authority reference, witnessed destruction record, and certificate;
- integrity manifest containing file hashes and record counts;
- retention exception report for unclassified records.

**Suggested data**

- `record_series`
- `retention_schedule_versions`
- `document_record_classifications`
- `legal_holds` and `legal_hold_items`
- `disposition_batches`, `disposition_approvals`, and `disposition_certificates`
- `records_transfers`

**Important rules**

- No automatic permanent deletion merely because a date has passed.
- A hold overrides disposition eligibility.
- Soft-deleted application rows are not proof of compliant disposition.
- Metadata and audit evidence required to prove disposition must follow an approved retention rule of their own.
- Legacy imports need classification and exception queues before final migration closure.

### 6.3 Security classification and document-level access control

**Priority:** P0/P1  
**Impact:** Very high  
**Why it matters:** Current access is largely based on office, role, ownership, and route participation. That is useful, but sensitive legal, personnel, financial, ancestral-domain, or case-related documents may require need-to-know restrictions within the same office.

**Core features**

- configurable classifications such as Public, Internal, Confidential, and Restricted;
- classification defaults by document type with authorized override;
- named-user, office, role, case-team, and time-limited access grants;
- document owner/custodian and access-review date;
- request-access workflow with reason and approval;
- field-level redaction or a separately generated disclosure copy;
- dynamic watermark for sensitive previews/downloads;
- view, download, print, share-link, classification-change, and access-grant audit events;
- periodic access certification by the data owner.

**Suggested data**

- `security_classifications`
- `document_access_grants`
- `document_access_requests`
- `document_custodians`
- `document_disclosure_versions`

**Important rules**

- Enforce access on the server for metadata, routes, search results, files, exports, notifications, and connected-system payloads.
- Search must never reveal a title or snippet for an inaccessible record.
- Navigation visibility is not authorization.
- Public tracking fields should depend on classification and an approved disclosure profile.

### 6.4 Enterprise search, OCR, and duplicate detection

**Priority:** P1  
**Impact:** High  
**Why it matters:** Current search is metadata/trail-oriented. Scanned PDFs and images remain difficult to discover, and the value of a document system declines if staff cannot find earlier decisions or related records.

**Core features**

- full-text search over authorized metadata, authored content, and extracted attachment text;
- OCR for scanned PDF/JPEG/PNG uploads;
- filters for office, document type, date, status, creator, route participant, classification, and record series;
- exact, phrase, prefix, and typo-tolerant search where appropriate;
- related-document links and duplicate/similar-document warning;
- saved searches and optional alerts;
- OCR status, confidence, language, page count, and failure reason;
- re-index command and index-consistency dashboard.

**Suggested data/services**

- `document_search_contents`
- `file_extractions`
- `saved_searches`
- queue-based OCR/extraction jobs;
- an access-aware search index, with database full-text search as a smaller first step.

**Important rules**

- Scan for malware before OCR or conversion.
- Do not send restricted documents to an external OCR service without an approved data-processing arrangement.
- Treat OCR text as derived data governed by the same classification and retention as the source file.
- Highlighted snippets must be generated only after authorization filtering.

### 6.5 Unified notification center, reminders, escalation, and email audit

**Priority:** P1  
**Impact:** High  
**Why it matters:** Email jobs exist, but users need one in-application inbox for assignments, deadlines, revision requests, route changes, and failures. Administrators also need a safe recipient/outcome history.

**Core features**

- in-app unread/read notification center;
- event preferences by channel and urgency;
- immediate, daily-digest, and escalation delivery modes;
- reminder de-duplication and quiet-hour policy;
- grouped notifications for multi-office routes;
- safe email audit: queued, accepted by SMTP, skipped, retry scheduled, and finally failed;
- masked email address and user/office identity snapshots;
- per-notification correlation/delivery reference;
- queue and notification-health dashboard.

**Build on the existing proposal**

Use [Email Notification Audit Plan](email-notification-audit-plan.md) as the detailed security design. In particular, jobs should carry user/document identifiers instead of plaintext email addresses where possible, and “accepted by SMTP” must not be labeled “delivered.”

### 6.6 Delegation, out-of-office, and workload balancing

**Priority:** P1  
**Impact:** High  
**Why it matters:** A workflow can stall when the only eligible receiver or approver is absent, transferred, inactive, or overloaded.

**Core features**

- time-bounded delegation with delegator, delegate, scope, reason, and approver;
- out-of-office period and substitute routing;
- office-level receiving pool instead of dependence on one individual;
- capacity/workload view by office and eligible approver;
- automatic expiration and revocation;
- conflict-of-interest and separation-of-duties rules;
- explicit “acting for” display and audit trail.

**Important rules**

- Delegation must not copy the delegator's entire role by default.
- Every decision must retain both the acting user and the authority source.
- A delegate must never approve their own authored/submitted document where policy prohibits it.

### 6.7 Versioned workflow templates and routing rules

**Priority:** P1  
**Impact:** High  
**Why it matters:** Users currently build routes during transactions. Reusable templates reduce mistakes, standardize approval paths, and make policy changes governable.

**Core features**

- named workflow templates by document type, action, purpose, originating office, and classification;
- sequential, parallel, and conditional stages;
- required/optional office steps and quorum rules;
- default SLA per stage;
- template draft, review, publish, retire, and version history;
- route simulation/preview before publishing;
- snapshot of the selected template into each document route;
- controlled exceptions with justification.

**Suggested data**

- `workflow_templates`
- `workflow_template_versions`
- `workflow_template_steps`
- `workflow_conditions`
- `document_route_template_snapshots`

**Important rule:** Never mutate an active route merely because its source template was edited.

### 6.8 Digital-signature trust and verification

**Priority:** P1/P2  
**Impact:** High  
**Why it matters:** Wet-signed upload and SHA-256 metadata exist, while iPluma signing is still future-facing. DOTS can evolve from merely storing a signed PDF to proving what was signed, by whom, when, and whether the signed bytes remain valid.

**Core features**

- signature request, callback, verification, expiry, cancellation, and failure states;
- signer identity and authority snapshot;
- pre-sign and signed-file hash comparison chain;
- certificate/signature validation metadata where supported;
- timestamp and provider transaction reference;
- human-readable signature evidence report;
- public or staff verification page that reveals only approved fields;
- revocation/revalidation process without altering historical evidence.

**Important rules**

- Obtain legal and records-management approval for each signature method and document class.
- Never treat an image of a signature as equivalent to a cryptographically verifiable signature.
- Preserve the exact signed bytes as immutable evidence.
- Use RA 8792 and approved agency rules as legal context, not as automatic certification that every implementation is valid.

### 6.9 External intake and acknowledgment portal

**Priority:** P2  
**Impact:** High for citizen-facing or inter-agency transactions  
**Why it matters:** External requests currently depend on internal registration or shared links. A controlled intake portal can provide a complete-requirements check, acknowledgment receipt, and status visibility while reducing encoding work.

**Core features**

- configurable submission forms by service;
- requirements checklist and file validation;
- privacy notice and lawful-basis/purpose notice;
- submission reference and acknowledgment receipt containing responsible unit and receipt timestamp;
- completeness review, deficiency notice, resubmission, and withdrawal;
- duplicate detection;
- OTP-authenticated status access with strict rate limits;
- conversion of an accepted submission into an internal DOTS record without re-encoding.

**Important rules**

- Build this only for approved Citizen's Charter services and data fields.
- Do not expose internal route remarks or restricted metadata to external submitters.
- Define anti-spam, malware scanning, retention, identity assurance, and accessibility before launch.

### 6.10 Integration hub, API, webhooks, and reconciliation

**Priority:** P2  
**Impact:** High  
**Why it matters:** Connected-system pages currently fetch summary data. A proper integration layer is needed before two-way synchronization or automated state changes.

**Core features**

- versioned API contracts and service accounts;
- scoped tokens, rotation, expiry, and revocation;
- signed webhooks with timestamp/replay protection;
- outbox/inbox pattern for durable messages;
- idempotency keys and duplicate-event handling;
- retry/backoff, dead-letter queue, and manual replay;
- field mapping and source-of-truth rules;
- reconciliation dashboard showing missing, duplicate, conflicting, and delayed records;
- integration audit that stores safe metadata, not secrets or raw sensitive payloads.

**Suggested data**

- `integration_connections`
- `integration_outbox`
- `integration_inbox`
- `integration_deliveries`
- `integration_reconciliations`

### 6.11 Management analytics and compliance reporting

**Priority:** P2  
**Impact:** Medium/high  
**Why it matters:** Current counts and charts are useful, but management needs actionable operational and compliance measures.

**Core reports**

- SLA compliance by service, office, document type, and period;
- aging and bottleneck analysis;
- office workload and completion throughput;
- rejection/revision reasons;
- route-edit, early-activation, extension, and override frequency;
- records awaiting classification, retention review, transfer, or disposition;
- audit completeness and suspicious access patterns;
- integration and notification success/failure trends;
- export jobs with access controls, watermarking, purpose, expiry, and audit.

**Important rule:** Reports must use a documented metric dictionary so “pending,” “processing time,” “completed,” and “overdue” mean the same thing across screens and exports.

### 6.12 Security incident and operational control center

**Priority:** P1/P2  
**Impact:** High for risk reduction  
**Why it matters:** Audit records exist, but there is no visible workflow for detecting, triaging, containing, and documenting security or privacy incidents.

**Core features**

- security event rules for repeated login failures, privilege changes, unusual downloads, failed authorization, malware detections, and bulk exports;
- incident case, severity, owner, timeline, affected records/data subjects, containment, and corrective action;
- immutable evidence attachments and chain-of-custody metadata;
- notification-deadline tracker for reportable privacy incidents;
- linkage to audit events without copying secrets;
- annual security-incident report support;
- operational health for queue, scheduler, mail, storage, integrations, PDF renderer, and backup verification.

This module supports response; it does not replace the organization's Security Incident Management Policy, breach response team, or official NPC reporting process.

### 6.13 Collaboration, tasks, annotations, and checklists

**Priority:** P2  
**Impact:** Medium  
**Why it matters:** Remarks attached only to routing decisions are insufficient for structured collaboration during longer reviews.

**Core features**

- internal comments with mentions;
- task/checklist assignments with due dates;
- page/section annotation for drafts or PDF versions;
- resolved/unresolved discussions;
- decision-ready checklist by document type;
- restricted internal notes separated from external/public remarks.

**Important rule:** Comments and annotations must never modify an approved or signed file. They are separate records with their own access, retention, and audit trail.

### 6.14 Batch receiving, barcode scanning, and optional PWA

**Priority:** P3  
**Impact:** Medium, potentially high for records desks  
**Why it matters:** High-volume receiving desks benefit from scanning instead of typing individual tracking numbers.

**Core features**

- camera/USB barcode or QR scanning;
- batch receive and batch routing preparation with per-item validation;
- printable routing labels;
- duplicate and wrong-office warnings;
- resumable upload for large files;
- optional installable PWA with online-first behavior.

Avoid offline approval or offline document storage in the first release. Offline handling greatly increases synchronization, device-loss, and privacy risk.

### 6.15 Disclosure, redaction, and FOI support

**Priority:** P2/P3, subject to Legal/FOI policy  
**Impact:** Medium  
**Why it matters:** A controlled disclosure copy prevents staff from manually editing the official source file when responding to an authorized request.

**Core features**

- disclosure request and approval workflow;
- page-level and area redaction with irreversible output rendering;
- redaction reason/exemption code;
- disclosure copy hash and linkage to the source version;
- release log, recipient, purpose, authority, and expiry where applicable;
- quality-control preview that detects hidden text layers remaining under visual redactions.

## 7. Cross-cutting technical improvements

### 7.1 Split the core domain into application services

Refactor the large controllers and pages incrementally, protected by characterization tests.

Suggested backend boundaries:

- `RegisterDocument`
- `ReleaseDocument`
- `ReceiveRouteStep`
- `DecideRouteStep`
- `ForwardDocument`
- `EditRemainingRoute`
- `StoreDocumentFile`
- `AuthorizeDocumentAccess`
- `CompleteRoute`
- `DispatchNotification`

Suggested frontend boundaries:

- document list/filter state;
- document detail drawer;
- release/route builder;
- decision and wet-sign dialogs;
- route timeline/tree;
- file version panel;
- dedicated typed API/form hooks.

Move request validation to Form Requests and action authorization to Policies. Keep database transactions inside application actions, not React or route definitions.

### 7.2 Formalize workflow states

- Define backed enums or central constants for document, route, step, approval, signature, archive, notification, and OCR states.
- Document allowed transitions and reject impossible transitions on the server.
- Add optimistic concurrency/revision tokens to high-risk actions beyond remaining-route editing.
- Add database constraints where supported, while keeping cross-database tests compatible.
- Use append-only domain events for important transitions and derive notification/analytics work from committed events.

### 7.3 Close the legacy migration program

- Publish counts and hashes for source, imported, skipped, quarantined, and reconciled records.
- Assign owners and resolution status to every import exception.
- Prove that legacy-to-modern IDs and attachments reconcile.
- Make old connections read-only after cutover.
- Define a retirement date for compatibility models and public-storage fallback.
- Prevent new functionality from writing to legacy tables.

### 7.4 Performance and scaling

- Capture query count and P50/P95 latency for dashboard, document list, details, archive, audit, and workflow queues.
- Add pagination to all potentially unbounded lists and avoid loading complete office/user datasets into every page.
- Cache stable libraries with explicit invalidation.
- Move OCR, conversion, notification, report export, external sync, and hash verification to queues.
- Add frontend route/component code splitting, especially for the 500 kB-plus document page chunk.
- Load-test concurrent receives/approvals to verify row locking prevents duplicate decisions.

### 7.5 Accessibility and usability

- Target WCAG 2.2 AA for staff and public pages.
- Test keyboard-only operation, visible focus, dialog focus trapping/restoration, screen-reader labels, errors, status announcements, contrast, zoom, and reduced motion.
- Provide non-chart tables for every chart and avoid color-only status meaning.
- Use consistent labels for receive, release, approve, forward, archive, and dispose; these terms have different legal and operational effects.
- Add contextual help for sensitive actions and explain why an action is unavailable.

### 7.6 Documentation and ownership

- Replace the generic Laravel README with DOTS setup, architecture, queue/scheduler, storage, PDF renderer, testing, deployment, and recovery instructions.
- Maintain a data dictionary, status-transition catalog, permission matrix, notification catalog, audit-event catalog, and metric dictionary.
- Assign a business owner and technical owner to every module.
- Record architecture decisions for public tracking, OTP, classification, retention, signatures, and integration source-of-truth rules.

## 8. Suggested delivery roadmap

The durations below are planning ranges, not commitments. They assume a small cross-functional team and timely policy decisions.

### Phase 0 — Stabilize and secure, approximately 3–6 weeks

- Fix the migration/test baseline until CI is green.
- Resolve production schema drift and add schema health checks.
- Decide and enforce the registration policy.
- Add Policies/Form Requests around the highest-risk document and file actions.
- Add file quarantine/malware scanning.
- Configure scheduler, supervised queues, health checks, and alerting.
- Document and test backup restoration.
- Add CI/CD gates and a staging release checklist.

**Exit criteria:** clean deployment from scratch; green tests/build; verified private-file access; queue/scheduler heartbeat; successful restore drill; no unexplained schema errors.

### Phase 1 — Make delays visible and actionable, approximately 6–10 weeks

- SLA/service catalog and working calendar.
- Route-step and overall deadlines.
- In-app notification center, reminders, and escalation.
- Implement the existing email-audit proposal.
- SLA/aging dashboards and reports.

**Exit criteria:** every in-scope document has a traceable clock; reminders are idempotent; management totals reconcile to event data.

### Phase 2 — Records and access governance, approximately 8–14 weeks

- Security classification and document-level grants.
- Record-series and retention schedule catalog.
- Legal holds and disposition-review workflow.
- Access/download auditing and periodic access review.

**Exit criteria:** no unclassified in-scope record; held records cannot be disposed; disposition requires recorded authority; search/export honor classification.

### Phase 3 — Retrieval and standardized processing, approximately 8–12 weeks

- Full-text metadata/content search.
- Malware-safe OCR and extraction pipeline.
- Workflow template/rules engine.
- Delegation and out-of-office support.
- Duplicate/related-document assistance.

### Phase 4 — Trust and ecosystem expansion, incremental

- iPluma/digital-signature verification.
- Durable integration hub and reconciliation.
- Approved external intake services.
- Advanced analytics, disclosure/redaction, collaboration, and batch scanning.

## 9. Product backlog scoring

Use a simple score before accepting a module into a release:

```text
Priority score = (public-service impact + compliance/risk reduction + staff time saved + frequency) - (delivery complexity + policy uncertainty + operational burden)
```

Score each factor from 1 to 5 and require written evidence. A high-visibility feature should not outrank a quieter control that prevents record loss, data exposure, or recurring delay.

Recommended decision questions:

1. Which users and offices experience the problem, and how often?
2. What measurable delay, rework, risk, or cost exists today?
3. Is the process approved and stable enough to automate?
4. Which system is the source of truth?
5. What information classification and retention rule applies?
6. What is the fallback when email, HRIS, storage, signing, or another system is unavailable?
7. How will the module be monitored and supported after launch?

## 10. Features to defer for now

These may be useful later but should not displace the foundation and top modules:

- **Generative-AI auto-routing or automatic approval recommendations.** Begin only after classification, high-quality historical outcomes, human review, privacy impact assessment, and bias/error monitoring exist.
- **AI summaries of restricted documents.** Derived text can leak the same sensitive information as the original and requires the same access and retention controls.
- **Blockchain document tracking.** Hashes, immutable evidence, strong audit controls, and reliable backups solve the immediate needs with less complexity.
- **Native mobile apps.** A responsive/PWA workflow is a lower-cost first validation unless device-specific offline or scanning requirements are proven.
- **Open-ended workflow designer for all users.** Start with administrator-managed, versioned templates to prevent invalid or ungoverned routes.
- **Automatic record deletion.** Disposition requires approved schedules, holds checks, review, and appropriate authority.

## 11. Immediate action list

### Do now

- [ ] Reconcile the 94 failing tests and make the result reproducible in CI.
- [ ] Verify all production migrations and investigate library-table schema mismatches.
- [ ] Disable public registration unless there is an approved enrollment requirement.
- [ ] Confirm no legacy attachment remains accessible through a public storage link.
- [ ] Add malware quarantine/scanning before processing uploads.
- [ ] Configure and monitor queue workers and Laravel scheduler.
- [ ] Complete a database-and-file restore drill.
- [ ] Refactor the highest-risk DocumentController actions behind Policies, Form Requests, and application services.
- [ ] Approve a document classification scheme and records-retention governance process.

### Build next

- [ ] SLA/deadline/escalation module.
- [ ] In-app notification center and the existing email-audit proposal.
- [ ] Classification/document-level access controls.
- [ ] Records retention/legal-hold/disposition module.
- [ ] Access-aware full-text search and OCR.

### Measure from the start

- percentage of transactions completed within SLA;
- median and P90 processing time;
- documents with no activity for defined aging thresholds;
- queue age and failed jobs;
- notification accepted/skipped/failed rate;
- unclassified records and retention exceptions;
- unauthorized-access attempts and sensitive-file downloads;
- successful backup restore time and last verified restore date;
- integration reconciliation exceptions;
- user task completion time and support incidents.

## 12. External basis and references

These references support the direction of the recommendations; the agency must still obtain its own legal, records, privacy, and security approvals.

### Philippine government and legal references

- [Republic Act No. 11032 — Ease of Doing Business and Efficient Government Service Delivery Act](https://lawphil.net/statutes/repacts/ra2018/ra_11032_2018.html): unique identification/acknowledgment and prescribed processing-time framework for covered transactions.
- [Republic Act No. 9470 — National Archives of the Philippines Act](https://lawphil.net/statutes/repacts/ra2007/ra_9470_2007.html): management, preservation, transfer, and authorized disposition of public records.
- [NAP Implementing Rules and Regulations of RA 9470](https://nationalarchives.gov.ph/wp-content/uploads/2024/09/IRR-of-R.A.-9470.pdf): records disposition schedules and written authority for disposition.
- [NAP Electronic Records Management Policy Primer](https://nationalarchives.gov.ph/wp-content/uploads/2025/04/ERMP-PRIMER25.pdf): electronic-record retention and Agency Records Disposition Schedule guidance.
- [Republic Act No. 8792 — Electronic Commerce Act](https://lawphil.net/statutes/repacts/ra2000/ra_8792_2000.html): legal recognition and government use of electronic documents and signatures, subject to integrity, authentication, security, and agency procedures.
- [Republic Act No. 10173 — Data Privacy Act](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html): legitimate purpose, proportionality, accuracy, and retention limitations for personal data.
- [NPC security requirements overview](https://privacy.gov.ph/npc-issues-circulars-to-strengthen-personal-data-protection-in-ph/): privacy management, access, authentication, business continuity, backup, and restoration expectations.
- [NPC breach reporting](https://privacy.gov.ph/pips-and-pics/breach-reporting/): incident-response responsibilities and official breach-reporting process.

### Engineering and accessibility references

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html): allowlisting, type validation, generated names, authorization, safe storage, limits, and malware-related controls.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html): security-event coverage, sensitive-data exclusion, protection, monitoring, and retention of logs.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final): backup protection, reliability testing, restoration sampling, audit review, and broader security/privacy controls.
- [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/): perceivable, operable, understandable, and robust web content with testable conformance criteria.

## 13. Final decision summary

DOTS should evolve from a capable tracking application into a governed records-and-workflow platform. The largest practical gains will come from making deadlines enforceable, records searchable, access more precise, retention lawful, notifications accountable, and integrations reliable.

The recommended first implementation sequence is:

```text
Stabilize release baseline
  -> SLA and escalation
  -> notifications and email audit
  -> classification and document-level access
  -> retention/legal hold/disposition
  -> search/OCR
  -> workflow templates and delegation
  -> digital-signature verification and integration hub
```

This sequence produces visible operational value early while establishing the controls required for sensitive government records.
