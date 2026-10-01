# DOTS Document Creation Module

## 1. Document Generation

Create standardized documents using reusable templates and export them
as PDF files.

**Key functions** - Select an approved document template. - Enter the
required document details and content. - Preview the document before
generating the PDF. - Save drafts and generate a printable PDF.

## 2. Approval Tracking

Record the approval process, including when approval happens outside
DOTS or on paper.

**Key functions** - Record the assigned approver. - Record the
submission date. - Track the approval decision and date. - Save approver
remarks or revision requests. - Maintain an auditable history of
approval-related actions.

## 3. Final Document Verification

Receive the signed or approved file, preserve it, and check that it
corresponds to the version submitted for approval.

**Key functions** - Upload and retain the returned signed or approved
file. - Associate the file with the correct draft and approval record. -
Compare it with the submitted version and flag unexpected changes. -
Record verification results and the person who performed the
verification. - Preserve the approved file as a distinct, final version.

> Verification should follow the office's accepted approval and
> signature procedures. Uploading a file alone does not establish that
> an approval or signature is valid.

## 4. Existing DOTS Routing

Register the finalized document in the existing Document Tracking System
and continue using the routing functionality already implemented.

**Key functions** - Create or link the official document record using
the existing registration process. - Attach or associate the verified
final file with the correct document record. - Populate required
metadata and tracking information. - Initialize routing through the
existing workflow rather than duplicating routing logic. - Preserve the
relationship between the created document, approval evidence, final
file, and routing history.

## Proposed Workflow

1.  Generate the document.
2.  Submit it to the authorized approver.
3.  Receive the signed or approved file.
4.  Verify and preserve the final version.
5.  Register the document and route it through the existing DOTS
    workflow.

## Implementation Note

Before implementation, inspect the existing document registration
process and the relevant database relationships. Reuse the current
document, file, document-trail, and audit-trail mechanisms where
appropriate. Confirm the office's accepted approval and signature
procedures before deciding whether approval should be paper-based,
electronic, or digitally signed.
