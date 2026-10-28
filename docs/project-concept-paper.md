# Concept Paper: NCIP Document Tracking and Routing System (DOTS)

**Status:** Updated working draft for sponsor and business-owner review
**Prepared for:** NCIP project sponsors and business stakeholders
**Prepared by:** [Name / unit]  
**Review date:** 28 October 2026
**System reviewed:** Current project source code in this repository

> This paper reflects features found in the current codebase. It does not confirm production deployment, live data, agency policy approval, or the availability of external services. Those items should be confirmed before formal submission.

## 1. Project overview

The National Commission on Indigenous Peoples (NCIP) Document Tracking and Routing System (DOTS) is a web application for registering official documents, routing them between offices, recording receipt and decisions, and following their progress through completion. It provides authorized staff with a shared record of document details, files, office actions, and routing history. A signed public tracking link can show selected tracking information without an internal account.

DOTS supports two related document paths. Staff can register an existing or uploaded source document directly into the tracking workflow. They can also prepare a document in the DOTS editor, save and finalize it as ready for routing, then create a tracking record for it. Tracking records receive their tracking number when they are registered; the number can be stamped on a generated PDF. Receipt, approval, routing, optional signature handling, and completion are recorded against the tracked record.

The current application also includes dashboards, archives, audit history, account and reference-data administration, HRIS employee support, email notifications, QR-based document actions, and summary views for selected connected systems.

## 2. Background and need

Official documents may pass through multiple offices and decision-makers. Staff need to know which office currently holds an item, what action has been taken, what remains to be done, and which version of a file was reviewed. Separate paper, spreadsheet, or email handoffs can make that history harder to find and reconcile.

DOTS addresses this need by connecting the tracking record, source-file versions, office route steps, decisions, and audit events. It provides office-based work views and a signed tracking page for approved public status information. The system is intended to support the agency's approved records and routing procedures; it does not replace those policies.

## 3. Objectives

DOTS aims to:

1. Give authorized staff a consistent way to register, receive, route, review, and complete official documents.
2. Make the current holding office, routing state, and recorded history easier to locate.
3. Keep the tracking number, source document and versions, route decisions, and related records connected.
4. Support generated documents as well as documents supplied as files.
5. Apply account, office, and role checks to internal records and workflow actions.
6. Improve accountability by recording office actions, decisions, and key system events.
7. Provide selected tracking information through signed links while protecting internal files and remarks.
8. Support a controlled transition from the legacy directory, document, and audit data where migration is approved.

## 4. Users and beneficiaries

- **Document originators and encoders:** prepare or register documents, attach source files, and follow their records.
- **Receiving-office staff:** verify receipt, review assigned work, and route documents onward.
- **Approvers and office administrators:** act on the route steps assigned to their office and monitor office work within their authorization.
- **Records, administrative, and system administrators:** maintain accounts, offices, routing ranges, reference data, templates, and system settings according to their assigned access.
- **Executives and authorized oversight users:** review cross-office work, dashboards, archives, or audit information where their access allows.
- **Recipients and other public users:** view limited status and routing information using a valid signed tracking link; QR action access may require email one-time-password verification.

Actual role assignments and access must follow NCIP-approved policies. The availability of a navigation item alone does not determine authorization to view or change a record.

## 5. Current system capabilities and scope

The following capabilities are present in the current project source. Live availability may depend on deployment configuration, user permissions, database setup, and external service credentials.

### 5.1 Document registration and routing

- Register a document with its type, purpose, origin, title, action information, remarks, urgency and notification preferences.
- Save an unfinished tracking record as a draft or finalize it to assign a tracking number and start the tracking history.
- Attach a source file and add later file versions while retaining the record's tracking identity.
- Search and filter document lists, review record details and trail history, and use the latest-documents view.
- Release a record to an eligible destination office, record receipt at that office, and route it onward.
- Define sequential or parallel office approval routes, display route progress, and support child routes from an active office step.
- Record office approval, request changes, or rejection against the tracked record. A replaced file version can return to approval.
- Mark a record terminal when processing is complete, archive it, and restore eligible records under the configured rules.
- Generate disposition and routing-history views from the tracking record and recorded events.

### 5.2 Document creation and PDF output

- Prepare documents in a rich-text editor using assigned, versioned templates and template assets.
- Save drafts, revise content, preview a PDF, and finalize a generated file as **Ready for Routing**.
- Create a tracking record later from the ready file. Finalizing the authored file alone does not assign the DOTS tracking number or complete routing approval.
- Stamp the assigned tracking number on eligible generated PDFs when they are registered.
- Reuse an approved or ready generated file as a source document or a later routed version where the workflow permits.
- Preserve authored-document versions and related events. The separate authoring workflow includes review states, but the current operational routing approval decision is recorded on the tracked document after the receiving office receives it.

### 5.3 QR and public tracking

- Provide a signed, rate-limited public tracking link for eligible finalized records, including QR access.
- Show selected metadata and route history while keeping internal remarks and private files behind access checks.
- Gate newly submitted records from public tracking while approval is pending or changes are requested.
- Support QR-accessible actions such as receipt, decision, forwarding, and wet-signed-file handling through a document-scoped session authenticated with an emailed one-time password, subject to account and route eligibility.

### 5.4 Dashboard, work queues, archives, and audit

- Show office-scoped or privileged cross-office counts for incoming, pending, released, and archived records, together with recent work and selected charts.
- Provide workflow lists for ready-to-route files, submissions, approval tasks, and approved documents.
- Search and filter tracking archives, including year and permitted office filters; restore eligible terminal records.
- Maintain a separate archive and restore path for generated-document drafts.
- Record significant application activity with actor and office context where the event is instrumented. The audit trail supports review but should not be treated as proof that every database-level change is captured.

### 5.5 Administration and connected services

- Maintain offices, routing ranges, document types, action types, purpose types, user accounts, and template assignments through protected administration features.
- Manage navigation visibility and system-maintenance settings through privileged controls.
- Use HRIS employee and office lookup or synchronization features when the relevant service is configured.
- Configure email notification automation and send queued notices for supported workflow events, subject to mail and queue configuration.
- Display configured summary information from DRIP, PDMIS, and iPLuma when those services are available.
- Preview and apply supported legacy directory, document/trail, and audit imports with guarded target-database checks and import reporting. Document attachment metadata can be imported; the physical legacy file binaries are not copied by that import flow.

## 6. High-level workflow

1. A staff member either registers an existing document or authors one in DOTS and finalizes it as ready for routing.
2. To begin tracking, the staff member creates a tracking record and attaches the generated PDF or an uploaded source file. DOTS assigns a tracking number; generated PDFs can receive that number as a stamp.
3. The record is released to one or more destination offices using the selected route. DOTS records the dispatch and route-step state.
4. The receiving office confirms receipt. Receipt and approval are separate actions.
5. Eligible staff review the current source-file version and approve it, request changes, or reject it. A replacement version may be submitted for another decision while retaining the tracking number.
6. Approved work can continue through sequential, parallel, or child route steps as configured. Staff can record signature-related handling where enabled; iPluma signing remains subject to the integration boundary below.
7. The holding office marks processing complete and archives the record when applicable. Eligible records may be viewed through a signed public tracking link.

Detailed decision authority, route templates, public disclosure, file replacement, and closure rules require business-owner approval.

## 7. Security, access, and records handling

The application includes account authentication, active-account and email-verification checks for operational routes, role and office-based access controls, login throttling and lockout protections, and optional reCAPTCHA. Administrative features have additional access checks. New document files use private storage and authorized view or download routes. Public tracking uses signed, rate-limited links and does not provide general document search.

These controls are application features, not a substitute for deployment security or agency governance. Production readiness also depends on TLS, secrets management, queue and scheduler operation, backups, database maintenance, monitoring, staff provisioning, and incident response. Public fields, access roles, retention periods, legal holds, and authorized disposal must be approved by the appropriate NCIP business and records authorities.

## 8. External integrations and implementation boundaries

- **HRIS:** employee lookup, office information, synchronization, and eligible credential checks depend on configured endpoints and credentials.
- **Email:** workflow notices depend on the configured sender, delivery service, queue workers, and recipient data.
- **DRIP, PDMIS, and iPLuma:** the current connected-system screens retrieve and display summary information when endpoints and credentials are configured. Repository review does not establish live service availability or full bidirectional synchronization.
- **iPLuma signing:** the system can track a signing need/status separately from route approval in supported flows. Submission of a PDF for signing, signer setup, return of the signed file, and reliable status updates still require a confirmed API contract and implementation. The control for this action remains unavailable until that work is complete.
- **Records management:** DOTS supports operational terminal/archive and restore actions. It is not a complete records-retention and disposition system; no approved retention schedule, legal-hold workflow, or destruction authorization is implied by the archive feature.
- **Analytics and reporting:** dashboards and selected processing charts exist. A separate comprehensive analytics, compliance-reporting, or scheduled escalation module should be treated as future work unless separately verified.
- **Legacy migration:** import tools support selected directory, document/trail, and audit records. Migration of physical legacy attachments and final reconciliation remain separate activities.

## 9. Expected outcomes and measures

Expected outcomes include more visible document status, more complete routing histories, easier retrieval of office actions, and clearer responsibility for work between offices. A pilot or operational review could measure:

- median time for staff to find a record and confirm its current status;
- percentage of routed records with complete required route and decision history;
- time between dispatch, receipt, decision, and onward routing, where timestamps are reliable;
- number and age of items awaiting receipt or action by office;
- email notification delivery, queue failures, and resolution time;
- public tracking usage and issues, using privacy-approved aggregate measures; and
- user feedback from originators, receiving staff, approvers, and administrators.

Set baseline values, targets, owners, and reporting intervals with participating offices. The current dashboard should not be assumed to provide every proposed performance or compliance measure.

## 10. Implementation and operational approach

The source code contains a substantial implementation of the core workflow. Further rollout or expansion should proceed through controlled operational stages:

1. **Confirm governance:** approve business ownership, participating offices, roles, routing and approval rules, public disclosure fields, and records policies.
2. **Establish the release baseline:** confirm migrations, account provisioning, file storage, email and queue operation, backups, monitoring, and support procedures in the target environment.
3. **Configure and pilot:** load verified office and reference data, onboard selected offices, train users, and exercise the end-to-end routes using approved test records.
4. **Review and improve:** assess operational measures, access and audit findings, integration failures, and user feedback; correct issues before expanding.
5. **Operate and govern:** maintain system configuration, access reviews, data quality, backups, change control, incident response, and support ownership.

No rollout dates or production status are asserted by this paper; these should be set by the project sponsor and system owner.

## 11. Resources and dependencies

Ongoing implementation and operation require:

- an NCIP business owner, records representative, data-protection/security representatives, and participating-office process owners;
- application development, database, infrastructure, quality assurance, and operational support;
- reliable hosting, database, private file storage, backups, monitoring, and deployment management;
- maintained office, user, route, document-type, and other reference data;
- a configured email sender and monitored queue workers;
- HRIS, DRIP, PDMIS, and iPLuma technical contacts, credentials, and API agreements where those integrations are required;
- user onboarding, training, help materials, and a support channel; and
- an approved data migration and reconciliation plan for historical records.

Costs, staffing, service levels, hosting requirements, and schedules need to be estimated against the approved deployment and rollout plan.

## 12. Risks and proposed responses

| Risk or consideration | Proposed response |
| --- | --- |
| Offices apply different routing and approval practices | Agree on common route rules and document approved office-specific variations before rollout. |
| Users are assigned incorrect offices or permissions | Establish account-provisioning ownership and regularly review user, role, office, and route access. |
| Public tracking reveals information that should remain internal | Approve public fields and eligibility rules; keep internal remarks and private files protected. |
| Email, HRIS, or connected systems are unavailable | Make service dependencies visible, provide an in-system workflow path where possible, and define support and retry procedures. |
| Legacy data or files are incomplete | Profile source data, record exceptions, validate imports with data owners, and plan physical-file migration separately. |
| Users mistake archive status for records disposition | Publish records schedules and keep retention, legal hold, and disposal decisions under authorized records procedures. |
| Required signature work is assumed to be fully automated | Keep signature status distinct from approval and do not represent iPluma PDF submission/return as complete before integration is delivered. |
| Production operations are not configured to support the application | Confirm backups, queue workers, monitoring, access review, incident response, and release controls before operational expansion. |

## 13. Decisions requested

Project sponsors and business owners are asked to:

1. Confirm the business owner and operational owner for DOTS.
2. Approve the offices and document processes covered by the next rollout or pilot stage.
3. Validate role assignments, route patterns, approval authority, receipt rules, and closure conditions.
4. Approve what information signed public tracking may display and which records are eligible.
5. Confirm records-retention, archival, legal-hold, and disposition responsibilities.
6. Confirm deployment, security, account provisioning, email, backup, support, and training responsibilities.
7. Decide whether and when to complete iPLuma signing integration and physical legacy-file migration.
8. Approve a baseline and target measures for operational review.

## 14. Conclusion

DOTS has evolved into an office-based document workflow application that combines document authoring, tracking, multi-office routing, receipt, approval, archives, audit history, and QR-enabled access. Its value depends on accurate office and role configuration, agreed routing and records rules, reliable operational services, and clear limits on public information. Sponsor review is requested to confirm ownership, governance, and rollout priorities, and to distinguish the capabilities already present in the codebase from the remaining integration and operational work.
