# Concept Paper: Document Tracking and Routing System (DOTS)

**Status:** Working draft for review  
**Prepared for:** Project sponsors and business stakeholders  
**Prepared by:** [Name / unit]  
**Date:** [Insert date]

> This draft describes the overall DOTS project. Confirm the project name, business rules, audience, and any required agency template before formal submission.

## 1. Project overview

The Document Tracking and Routing System (DOTS) is a web-based application intended to help offices prepare, register, route, and track official documents. It gives authorized staff a shared view of a document's tracking number, current status, responsible office, and recorded routing history.

DOTS supports both generated documents and uploaded files. When a document is submitted for routing, the system creates a tracking record and number. Staff can then review the item, record approval decisions and routing actions, and follow its progress. Access is controlled according to user roles and office responsibilities.

## 2. Background and problem

Documents that move between offices need a reliable way to identify the current responsible office, record actions, and answer status inquiries. When these steps depend on separate or manual processes, staff may have difficulty finding the latest status, confirming a document's movement, and retrieving its history.

DOTS addresses this need by keeping the tracking record, routing events, approvals, and related files together in one system. The specific workflow and records policies should be confirmed with the participating offices.

## 3. Proposed solution

Develop and operate DOTS as a central application for document preparation and routing. The system will:

- provide a tracking number for each registered routing record;
- record the offices involved, actions taken, dates, and current status;
- support document creation or file upload as the source document;
- provide office-scoped views and role-based access to records and actions;
- preserve a history of routing and approval activity;
- help staff find work through dashboards, lists, and status notifications; and
- provide limited public tracking for eligible records, subject to approved disclosure rules.

## 4. Objectives

DOTS aims to:

1. Make it easier for authorized staff to find a document's current status and routing history.
2. Give offices a consistent way to register, route, receive, and act on documents.
3. Keep the tracking record, source file, and recorded decisions associated with the same tracking number.
4. Limit access to records and actions according to user roles and office responsibilities.
5. Improve accountability through recorded actions and audit history.
6. Reduce avoidable status inquiries by making approved status information easier to find.

## 5. Intended users and beneficiaries

- **Submitting staff:** prepare or upload documents and follow their submissions.
- **Receiving and approving staff:** review documents assigned to their office, record decisions, and continue routing.
- **Office administrators and executives:** oversee document activity within their authorized scope.
- **System administrators:** manage accounts, reference data, access settings, and system operations.
- **Public users:** check limited status information for records made available through public tracking.

Final user groups and permissions must follow the agency's approved roles and records-access policies.

## 6. Proposed scope

### Included

- User accounts, roles, and office-based access controls.
- Office and document reference data needed for routing.
- Document creation and file upload workflows.
- Tracking-number assignment and routing records.
- Receiving, approval, return-for-revision, rejection, and other approved routing actions.
- Document attachments and version history where supported by the workflow.
- Dashboards, work queues, search, and status notifications.
- Audit history for significant user and document actions.
- Public tracking of approved records using only information approved for disclosure.
- Import or reference of legacy records where migration requirements are approved.

### Outside the initial scope or subject to separate approval

- Replacing formal records-retention, archival, or disposal policies.
- Exposing internal remarks, drafts, or attachments through public tracking.
- Electronic signing through iPluma until the service contract, API, and signing process are confirmed.
- Other external integrations not yet approved or technically specified.

## 7. High-level workflow

1. A staff member prepares a document in DOTS or uploads a source file.
2. The staff member submits the file to routing. DOTS creates a tracking record and assigns its tracking number.
3. DOTS sends the record to the next office according to the selected routing.
4. Authorized staff review the document and record the required decision or action.
5. DOTS updates the status and preserves the routing history as the document moves between offices.
6. Eligible records may appear in public tracking after approval, showing only approved status information.

The detailed workflow, decision authority, and terminal statuses should be validated with business owners before rollout.

## 8. Expected outcomes and measures

Expected outcomes include improved visibility of document status, more consistent routing records, easier retrieval of document history, and clearer accountability for actions between offices.

Suggested measures for a pilot include:

- time required for staff to locate a document and confirm its status;
- percentage of routed records with complete tracking and action history;
- time spent in each routing step, where reliable timestamps are available;
- notification delivery and failure rates; and
- feedback from submitting, receiving, and approving staff.

Baseline values and target improvements should be set with participating offices before the pilot.

## 9. Implementation approach

The following phased approach is proposed; dates and participating offices remain to be agreed:

1. **Confirm requirements:** validate workflows, roles, records policies, public information rules, and success measures.
2. **Prepare the system:** configure reference data, access, notifications, deployment, backups, and support procedures.
3. **Pilot:** introduce DOTS to selected offices, provide user orientation, and collect feedback against the agreed measures.
4. **Review and expand:** resolve pilot issues, approve any workflow changes, and expand to additional offices in planned stages.
5. **Operate and improve:** monitor availability, security, data quality, support requests, and user feedback.

## 10. Resources and dependencies

Implementation and operation may require:

- a business owner and representatives from participating offices;
- a project lead, developers, and quality assurance support;
- hosting, database, backup, and monitoring services;
- an email service for status notifications;
- accurate office, user, and document reference data;
- user training and operational support; and
- approved API details and coordination for any future external signing integration.

Detailed costs, staffing, hosting specifications, and schedule should be estimated after requirements and deployment arrangements are confirmed.

## 11. Risks and considerations

| Consideration | Proposed response |
| --- | --- |
| Offices use different routing practices | Agree on the common workflow and document any approved office-specific rules. |
| Legacy data is incomplete or inconsistent | Profile the source data, define migration rules, and validate imported records with data owners. |
| Users see records outside their responsibility | Review role and office permissions and verify access rules during the pilot. |
| Public status could reveal sensitive information | Approve the exact fields shown publicly and keep internal remarks and files private. |
| Email or external services are unavailable | Provide visible in-system status and define support and retry procedures. |
| Users need help adopting the workflow | Provide orientation, job aids, and a clear channel for reporting issues. |

## 12. Decisions requested

Project sponsors and business owners are asked to:

1. Confirm DOTS as the project name and identify its business owner.
2. Approve the participating offices and the initial scope for a pilot.
3. Validate document routing, approval authority, and records policies.
4. Decide what information, if any, may be shown through public tracking.
5. Confirm deployment, support, data migration, and training responsibilities.
6. Approve preparation of a detailed requirements and implementation plan.

## 13. Conclusion

DOTS is intended to provide a consistent way for authorized offices to register and follow official documents through routing, review, and action. With agreed workflows, access rules, and records policies, the system can improve status visibility and accountability while giving stakeholders a clearer history of document movement. Sponsor review is requested to confirm the project direction and authorize detailed planning.
