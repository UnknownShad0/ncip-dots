# DOTS Document Creation Workflow Proposal

**Status:** For review; this is a proposal, not an approved workflow.

This note explains how a document creation and approval module could fit alongside the current DOTS document tracking workflow. It focuses on who acts at each step, what “pending” means, and what the dashboard could show.

## 1. Two related workflows

The system would have two connected parts:

1. **Document Creation** handles preparing a file, submitting it for approval, and recording the decision.
2. **Documents** handles the official DOTS record, tracking number, and routing history.

The current `documents` and `document_trails` tables serve official document registration and routing. A creation draft can be stored separately until it is approved and ready to become an official tracked document.

## 2. Proposed workflow

```text
Creator prepares draft from an approved template
                    ↓
Creator saves and previews a generated version
                    ↓
Creator submits that version to a named approver
                    ↓
Approver reviews it and records a decision
          ↙                         ↘
Needs revision                   Approved
     ↓                               ↓
Creator edits and resubmits     Approved document awaits registration
                                     ↓
                              Register as an official DOTS document
                                     ↓
                              Existing DOTS routing continues
```

The arrows describe the in-system approval and registration process.

## 3. Roles and actions

| Role | Possible actions |
|---|---|
| Creator | Create a draft, generate a version, submit it to an approver, revise it when returned, and view its progress. |
| Approver | Review an assigned submission and record an approval, rejection, or revision request, with a date and remarks. |
| DOTS registration user | The creator/file owner selects an approved document from their Approved Documents list and registers it as an official DOTS document. |
| DOTS routing user | Continue with the existing release and receive workflow after registration. |
| Administrator | Potentially view office-level totals or manage templates, depending on permissions approved for the module. |

An approver should be represented by an individual user account if the office confirms that approvals are assigned to named people and those people can be represented in DOTS. If approvals are delegated, shared, or performed by someone without a DOTS account, the workflow needs a way to record that person and the decision without pretending they acted inside the application.

## 4. What “pending” means

“Pending” should always identify whose action is outstanding. Suggested dashboard cards are:

- **Awaiting my approval** — submissions assigned to the signed-in user that have no decision yet. This card only applies to users who can act as approvers.
- **My submissions awaiting approval** — drafts submitted by the signed-in user that have no decision yet.
- **Returned for revision** — the signed-in creator has submissions to update.
- **Approved documents awaiting registration** — approval was recorded inside DOTS, but the document has not yet been registered in the official document list.

These are creation-workflow counts. They are separate from the existing **Pending documents** count, which describes official DOTS documents waiting in routing. Keeping the labels distinct prevents a staff member from confusing an approval task with a routing task.

Cards should link to a filtered list of the matching items. The count and list must use the same access rules: an approver sees items assigned to them; a creator sees their own submissions; office-wide views require an explicitly authorized role.

## 5. Example

1. Ana creates a draft and submits version 1 to Ben, the named approver.
2. Ben sees it under **Awaiting my approval**. Ana sees it under **My submissions awaiting approval**.
3. Ben requests a revision and records a remark. The item leaves his approval queue and appears under Ana’s **Returned for revision** card.
4. Ana revises the file and submits version 2. Version 1 and Ben’s earlier decision remain in the history.
5. Ben approves version 2. The approval result and date are recorded.
6. The approved document appears in the available approved-document list.
7. Ana selects it when adding an official document. DOTS creates the existing `documents` record and routing history, then staff use the established routing actions.

This example assumes the creator and approver have DOTS accounts. The process must be adjusted if the real approval happens outside DOTS or the approver has no account.

## 6. Relationship to existing project structure

The current Laravel application already has:

- `documents` for official tracked document metadata and status;
- `document_trails` for movement and routing history;
- `document_files` for file metadata associated with an official document;
- `audit_trails` for general user action records;
- a dashboard that currently counts incoming, pending, released, and archived official documents.

The creation workflow needs its own draft, version, and approval records. Registration connects the approved creation record to the official `documents` row. Routing continues through the existing document trail actions rather than a second routing implementation.

## 7. Questions to resolve before implementation

1. Are approvers named individuals, roles/positions, or either depending on the document?
2. Must each approver have a DOTS user account? How should approvals by external or paper-based approvers be recorded?
3. Can a submission have one approver, sequential approvers, or multiple approvers at the same time?
4. Which decisions are valid: approve, reject, or return for revision? Can an approver change a recorded decision?
5. Which templates and output formats are required? Are templates uploaded office files or DOTS-generated forms?
6. The creator/file owner registers an approved document. Approvers can view the approval history but do not register it unless office policy explicitly allows delegation.
7. Should cards show only the signed-in user’s tasks, or do any roles need office-wide counts?
8. At what point should the official DOTS tracking number be assigned? This proposal assigns it at registration after approval.

## 8. Suggested implementation sequence

1. Confirm approval authority, decision rules, signature procedure, templates, and visibility rules.
2. Design creation-specific records for drafts, immutable generated/submitted versions, and approval assignments and history.
3. Build the Document Creation navigation area and creator screens for drafts, preview, and submission.
4. Build approver queues and decision recording, including revision and resubmission history.
5. Add an approved-document registration list with access checks and one-time registration.
6. Add dashboard cards only for confirmed roles and task definitions, linking each card to its filtered queue.
7. Add registration that creates the official document, records the creation relationship, and initializes the existing routing flow.

The current implementation uses the existing document and document-trail records when an approved creation draft is registered.
