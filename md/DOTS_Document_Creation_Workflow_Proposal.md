# DOTS Document Creation Workflow Proposal

**Status:** For review; this is a proposal, not an approved workflow.

This note explains how a document creation and approval module could fit alongside the current DOTS document tracking workflow. It focuses on who acts at each step, what “pending” means, and what the dashboard could show.

## 1. Two related workflows

The system would have two connected parts:

1. **Document Creation** handles preparing a file, submitting it for approval, recording the decision, and checking the returned file.
2. **Documents** handles the official DOTS record, tracking number, and routing history.

The current `documents` and `document_trails` tables serve official document registration and routing. A creation draft can be stored separately until it is ready to become an official tracked document. The verified final file can then be attached to the official record using the existing document file mechanism.

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
Creator edits and resubmits     Returned approved/signed file is received
                                     ↓
                              Staff checks and records verification
                                     ↓
                              Register as an official DOTS document
                                     ↓
                              Existing DOTS routing continues
```

The arrows describe a possible process. The office should confirm whether every approved document must return as a signed file and who is allowed to verify it.

## 3. Roles and actions

| Role | Possible actions |
|---|---|
| Creator | Create a draft, generate a version, submit it to an approver, revise it when returned, and view its progress. |
| Approver | Review an assigned submission and record an approval, rejection, or revision request, with a date and remarks. |
| Verifier | Record that the returned file was checked against the submitted version and preserve the result. This may be a separate staff member or an authorized creator, subject to office policy. |
| DOTS routing user | Register the verified document and continue with the existing release and receive workflow. |
| Administrator | Potentially view office-level totals or manage templates, depending on permissions approved for the module. |

An approver should be represented by an individual user account if the office confirms that approvals are assigned to named people and those people can be represented in DOTS. If approvals are delegated, shared, or performed by someone without a DOTS account, the workflow needs a way to record that person and the decision without pretending they acted inside the application.

## 4. What “pending” means

“Pending” should always identify whose action is outstanding. Suggested dashboard cards are:

- **Awaiting my approval** — submissions assigned to the signed-in user that have no decision yet. This card only applies to users who can act as approvers.
- **My submissions awaiting approval** — drafts submitted by the signed-in user that have no decision yet.
- **Returned for revision** — the signed-in creator has submissions to update.
- **Awaiting verification** — approved files have been received, but no verification result has been recorded.

These are creation-workflow counts. They are separate from the existing **Pending documents** count, which describes official DOTS documents waiting in routing. Keeping the labels distinct prevents a staff member from confusing an approval task with a routing task.

Cards should link to a filtered list of the matching items. The count and list must use the same access rules: an approver sees items assigned to them; a creator sees their own submissions; office-wide views require an explicitly authorized role.

## 5. Example

1. Ana creates a draft and submits version 1 to Ben, the named approver.
2. Ben sees it under **Awaiting my approval**. Ana sees it under **My submissions awaiting approval**.
3. Ben requests a revision and records a remark. The item leaves his approval queue and appears under Ana’s **Returned for revision** card.
4. Ana revises the file and submits version 2. Version 1 and Ben’s earlier decision remain in the history.
5. Ben approves version 2. The approval result and date are recorded.
6. The office receives the approved or signed file. An authorized verifier records the check and any differences or notes.
7. A DOTS user registers the verified file as an official document. DOTS creates the existing `documents` record and routing history, then staff use the established routing actions.

This example assumes the creator and approver have DOTS accounts. The process must be adjusted if the real approval happens outside DOTS or the approver has no account.

## 6. Relationship to existing project structure

The current Laravel application already has:

- `documents` for official tracked document metadata and status;
- `document_trails` for movement and routing history;
- `document_files` for file metadata associated with an official document;
- `audit_trails` for general user action records;
- a dashboard that currently counts incoming, pending, released, and archived official documents.

The creation workflow would need its own draft, version, approval, and verification records. Registration would connect the completed creation record to the official `documents` row. Routing should continue through the existing document trail actions rather than a second routing implementation.

## 7. Questions to resolve before implementation

1. Are approvers named individuals, roles/positions, or either depending on the document?
2. Must each approver have a DOTS user account? How should approvals by external or paper-based approvers be recorded?
3. Can a submission have one approver, sequential approvers, or multiple approvers at the same time?
4. Which decisions are valid: approve, reject, or return for revision? Can an approver change a recorded decision?
5. Who may verify the returned file, and what constitutes an acceptable comparison or difference?
6. Which templates and output formats are required? Are templates uploaded office files or DOTS-generated forms?
7. Should cards show only the signed-in user’s tasks, or do any roles need office-wide counts?
8. At what point should the official DOTS tracking number be assigned? This proposal assigns it at registration after verification.

## 8. Suggested implementation sequence

1. Confirm approval authority, decision rules, signature procedure, templates, and visibility rules.
2. Design creation-specific records for drafts, immutable generated/submitted versions, approval assignments and history, and verification results.
3. Build the Document Creation navigation area and creator screens for drafts, preview, and submission.
4. Build approver queues and decision recording, including revision and resubmission history.
5. Add returned-file upload and verification screens with access checks and preserved versions.
6. Add dashboard cards only for confirmed roles and task definitions, linking each card to its filtered queue.
7. Add registration that creates the official document, attaches the verified file, records the relationship, and initializes the existing routing flow.

No application code or database migrations have been changed as part of this proposal.
