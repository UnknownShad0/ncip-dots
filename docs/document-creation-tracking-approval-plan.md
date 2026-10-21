# Document Creation, Tracking, and Routing Approval Plan

## Goal

Let staff create and edit a document, finalize its content, and list it in Document Workflow as ready to attach in Routing. Attaching it in Routing creates the DOTS tracking record and assigns its DOTS tracking number. The routing already has its disposition form, which records the routing history. The user attaches one source document to that routing, either generated in Document Creation or uploaded. Approval and any required signing happen from the tracked routing record.

## Agreed direction

- **Document Creation** is for editing, previewing, generating, and saving drafts.
- A creator can edit a draft without approval.
- Finalizing a generated document places it in Document Workflow as ready to attach. It is not yet an approved document or a tracked DOTS record.
- When a user attaches that generated document in Routing, DOTS creates the tracking/routing record and assigns its DOTS tracking number.
- After the tracking number is assigned, print it on the generated PDF before approval and signing.
- The disposition form is part of the routing record and carries its tracking and routing history; it is not a separate file the user attaches.
- The user attaches one source document to the routing. It carries the content being reviewed, approved, and, when required, signed. It can be generated or uploaded.
- Approvers act on the document in **Tracking/Routing**. The approval decision and remarks are part of that document's history.
- The page currently called **Approved Documents** becomes a **Document Workflow** list page. It holds My Submissions, Approval Tasks, and approved records as useful views. Those lists link to the tracked document; approval actions remain in Tracking/Routing.
- Revisions use the same tracked document and tracking number, with a new version in its history.
- At a routing step, the assigned office views and approves the document. If it needs a signature, an authorized user can then choose **Sign with iPluma** to send the attached PDF for signing.
- Record whether the attached PDF is **Needs signing** or **Not required**. After the office approves a PDF marked **Needs signing**, enable the iPluma signing action.
- Show signing progress separately from the routing and approval status, so staff can tell whether the PDF needs signing, was sent to iPluma, or has been signed.
- Staff should have separate **View** and **Download** actions for attached files. View opens supported PDFs and images in the browser; Download saves the original attachment.

## Previous flow (before implementation)

1. Document Creation saves a `DocumentCreationDraft` and sends it through a separate approval queue.
2. After approval, the creator registers it. `DocumentCreationController::register` creates a `Document`, assigns a tracking number, and adds its first `DocumentTrail`.
3. The Documents page also has an **Add Document** modal with an option to select an already-approved generated document.
4. Tracking and routing then use the `Document` and its `DocumentTrail` records. The public `/track/{trackingNumber}` page reads the finalized document and its trail history.

This order means approval currently happens before a generated document gets its tracking record. The target flow reverses that handoff.

## Target workflow

```text
Create/edit draft
       |
       v
Finalize generated document
       |
       v
List it in Document Workflow as ready to attach
       |
       v
Attach generated document in Routing
       |
       v
Create DOTS tracking/routing record and assign DOTS tracking number
       |
       v
Routing includes its disposition form;
attach source document and stamp generated PDF
       |
       v
Forwarded to Office A
       |
       v
Office A views and approves the PDF
       |                         |
Signature needed?          Changes requested
   |       |                     |
  Yes      No                    v
   |       |              Edit a new version
   v       |                     |
Sign with iPluma            Resubmit on same record
   |
   v
Continue routing after signing
```

An approver can also reject the submission. The rejection and remarks remain in the tracked document's history.

At a routing step, the assigned office views and approves the attached PDF. If it needs a signature, an authorized user can then select **Sign with iPluma**. The record shows the signing status and keeps the returned signed PDF with that same tracking number. Signing status is tracked separately from approval and routing status.

## Page responsibilities

### Document Creation

- Keep the editor, draft save, preview, and generated-file actions.
- Remove the **My Submissions** and **Approval Tasks** sections from this page.
- When the creator finalizes a generated document, list it in Document Workflow as **Ready for Routing**. Do not assign a DOTS tracking number at this stage.
- Keep editing available while the document is a draft or ready for routing. After a request for changes on a tracked document, let the creator revise it and submit a new version against the same tracked item.

### Document Workflow

- Rename the user-facing **Approved Documents** label and heading to **Document Workflow**.
- Move **My Submissions** and **Approval Tasks** here, alongside an approved-record view or status filter.
- Show finalized generated files as **Ready for Routing** until a user attaches them to a routing record. Show approval tasks only after a tracked record is awaiting approval.
- Preserve search, pagination, and permission rules.
- Make each row link to the document in Tracking/Routing. Keep approval buttons off this list page so the tracked record remains the place where approval happens.

### Tracking/Routing

- Let a user attach a generated document from Document Workflow, or upload a source file, to start a routing record.
- On attachment, create the DOTS tracking record, assign its DOTS tracking number, and stamp that number on generated PDFs. The routing record has its disposition form; attach the selected source document to the record.
- Show the resulting record with an **Awaiting Approval** status.
- Give the assigned office separate **View** and **Download** actions for the attached source file. Open supported PDFs and images inline in the browser; keep Download available for all available attachments.
- Add approve, request changes, and reject actions for authorized approvers.
- Show the attached PDF to the assigned office for review and approval. If the file needs an electronic signature, enable **Sign with iPluma** after approval for an authorized signer.
- Set the signing requirement when the routing record is created or let an authorized user set it during routing; display **Needs signing** or **Not required** on the record.
- Track whether the attached document is **Not required**, **Needs signing**, **Sent to iPluma**, **Signed**, or has a signing error. Show the returned signed PDF on the same tracking record. Keep this state distinct from approval and routing status.
- Record every submission, revision, decision, and routing action in the document trail with the acting user, time, and remarks.
- After approval, allow the normal office routing, receipt, and terminal actions to continue.
- Keep the same tracking number when a document is revised. Add a new file/version and return the tracked record to **Awaiting Approval**.

### Add Document modal

- Keep this modal for manually uploaded or received documents.
- Keep a **Use generated document** option that selects a finalized file marked **Ready for Routing** in Document Workflow. It does not require prior approval.
- A manual upload or generated file becomes the source document for one routing record. The disposition form is already part of that routing record.
- A finalized manual upload should enter Tracking/Routing with **Awaiting Approval**, using the same approval process as generated documents where that routing policy requires approval.
- Remove the old approved-only generated-document filter and all **Approved Document** labels. The generated-document picker should list completed files that are ready to attach.
- Replace **Finalize** with a clear submission action such as **Create Routing Record** or **Submit for Approval**. This action assigns the DOTS tracking number and attaches the selected source document to the routing record.
- For an existing tracked document, a replacement file should create a revision on that same record and require approval again.

## Routing form and source document

- **Disposition form:** this is part of the routing record. It shows the tracking number, offices, actions, dates, and routing history. Keep its underlying event history in `DocumentTrail`; render or refresh the form from that history so it stays current. The user does not attach it as a second document.
- **Source document:** this is the one content file attached to the routing, either generated in Document Creation or uploaded. Stamp the tracking number onto generated PDFs after assigning it. Preserve uploaded source files as received unless stamping them is specifically required.

Revisions and signed outputs can be retained as versions of the source document without creating another routing record or changing its tracking number. Approval applies to the submitted source-document version. The disposition form reflects routing and approval history.

## Data and status rules

- Keep `Document` as the official tracked record and source of the DOTS tracking number. Create it when the generated file is attached in Routing, not when the creator first finalizes the file.
- Link the originating `DocumentCreationDraft` and selected generated version to that record. Reuse the existing `official_document_id` relationship if it supports the needed lifecycle cleanly; otherwise add an explicit relationship.
- Attach generated and uploaded files to the tracked document through `DocumentFile`.
- Render the tracking number into the generated PDF after assigning the number, then store that stamped file as the submitted version.
- Associate the disposition form and source document with the same `Document` and tracking number. Regenerate the form from the authoritative trail when routing changes.
- Use the tracked document and its trail as the authoritative approval and routing history. Keep draft status in sync or derive the creator's list status from the linked document so the two records cannot disagree.
- Use clear lifecycle states, for example: `draft`, `awaiting_approval`, `changes_requested`, `rejected`, `approved`, then the existing routing states. Track signature state separately, for example: `not_required`, `needs_signature`, `sent_to_ipluma`, `signed`, or `signature_issue`.
- When the user attaches a source file in Routing, create the tracking record, tracking number, initial trail, source-file association, and draft link in one database transaction. The disposition form is provided by the routing record and reflects its trail. Make the action safe to retry without creating duplicate tracked records.
- Preserve the current permission rule that the creator cannot approve their own submission. Only designated approvers can decide.

## Public tracking and privacy

- Staff tracking should show a submitted record while it awaits approval.
- Recommended default: enable public tracking after approval. If public tracking must show earlier progress, show only a minimal status such as **Awaiting Approval**; do not show draft contents, attachments, or internal approval remarks.
- Keep the signed tracking URL tied to the tracking number and finalized state, and review that condition when the new earlier tracking record is introduced.

## iPluma signing from Tracking/Routing

- The current iPluma page reads `/dots-summary` and displays signing status and signer history; it does not submit documents for signing.
- The current attachment UI has **View** and **Download** actions. It also shows a disabled **Sign with iPluma** button for PDF attachments with a note that iPluma upload is not connected yet. Keep the control disabled until the PDF submission endpoint and payload are confirmed and implemented.
- Stamping the tracking number is feasible in DOTS: the app already renders generated PDFs server-side through `DocumentPdf`. Pass the assigned tracking number into the renderer and place it in a reserved footer or header area. A QR code linking to the public tracking page can be considered later, subject to the public-tracking privacy rules.
- Include the tracking number on the PDF the office reviews. After the assigned office approves a file marked as needing a signature, enable **Sign with iPluma** for an authorized signer.
- Send only the attached, tracking-number-stamped source PDF to iPluma. The disposition form remains part of the DOTS routing record and is not part of this PDF upload.
- Show the signature state on the tracked record: **Not required**, **Needs signing**, **Sent to iPluma**, **Signed**, or an error/action-needed state. Keep this independent of the document's approval and routing status.
- Correlate iPluma activity with the DOTS tracking number and store iPluma's document/transaction identifier.
- Record who sent the PDF, when it was sent, signer progress, and completion or failure events in the DOTS trail. Approval decisions and signing events remain distinct.
- When iPluma supports it, receive status through callbacks/webhooks; otherwise poll its status endpoint. Make retries idempotent and record signing events in the DOTS trail.
- Attach the signed output as a new immutable version of the source document and show it on the same tracked record. Keep the original submitted PDF as well. Do not add or change the tracking-number stamp after signing; a revised document should get a new stamped version and go through the required approval and signing steps again.
- iPluma signing requires a PDF. Confirm the exact PDF upload field, signer setup, status callback, and signed-file download API before implementing this integration. Keep API credentials on the server. Only offer the signing action for a PDF source file unless a reliable conversion flow is added.

## Implementation status

- **Implemented:** Document Creation is an editor for drafts and finalized generated files. Finalizing creates a `Ready for Routing` item without a DOTS tracking number.
- **Implemented:** Document Workflow contains Ready for Routing, My Submissions, Approval Tasks, and Approved Documents. Its rows open the related editor or tracked record.
- **Implemented:** Creating a routing record from a ready generated file or uploaded source assigns the DOTS tracking number, creates the routing trail, attaches one source document, and prints the number on generated PDFs.
- **Implemented:** Tracked records have separate approval and signing states. Authorized office administrators can approve, request changes, or reject from the Tracking/Routing details. A requested generated-document revision keeps the same tracking number and returns to approval.
- **Implemented:** Public tracking hides records while approval is pending or changes are requested. Existing records with no approval requirement remain viewable.
- **Implemented:** A PDF can be marked as needing iPluma signing when the routing record is created. The status appears with the attachment; the signing button stays disabled because the current integration has no PDF submission endpoint.
- **Still pending:** Connect iPluma PDF submission, signer setup, status callbacks or polling, returned signed PDF storage, and signing event history after the API contract is confirmed.

## Suggested implementation order

1. **Done:** Finalize generated files as **Ready for Routing**, then attach them or upload a source file when creating the DOTS routing record.
2. **Done:** Stamp the assigned tracking number on generated PDFs and keep the disposition form represented by the routing record and its trail.
3. **Done:** Move approval actions to the tracked record in Tracking/Routing and record decisions in its history.
4. **Done:** Make Document Creation editor-only and move workflow lists to Document Workflow.
5. **Done:** Add separate View and Download actions and mark PDF signing needs on the tracking record.
6. **Done:** Hide newly submitted records from public tracking until approval.
7. **Pending iPluma contract:** Add server-side PDF submission, signer setup, status updates, and signed-file version handling; enable the action after office approval.

## Acceptance criteria

- A creator can edit and preview a draft without triggering approval.
- Finalizing a generated file lists it in Document Workflow as **Ready for Routing**, without assigning a DOTS tracking number yet.
- Attaching that generated file in Routing creates one tracking record and assigns its DOTS tracking number.
- Every routing record has its disposition form and one current source document, either generated or uploaded. The form reflects the route; the source document is the file attached by the user.
- The generated PDF includes its assigned tracking number before the approver reviews it and before it is sent to iPluma.
- Staff can view supported attached PDFs and images in the browser and can download available attachments.
- Approval and routing events appear in the tracked document history and the disposition form.
- The **Sign with iPluma** control stays unavailable until PDF upload/signing is connected; afterward, an authorized signer can use it after the assigned office approves a PDF marked as needing a signature.
- The tracked record shows whether signing is not required, needed, in progress, or complete, separately from approval and routing status.
- When iPluma returns a signed PDF, it is available as a new version on the same tracking record, and the signing event is recorded in its history.
- The record appears in staff Tracking/Routing as awaiting approval.
- Approval, revision request, and rejection happen on the tracked document and are recorded in its history.
- A requested revision keeps the tracking number, adds a new version, and returns to approval.
- My Submissions and Approval Tasks are absent from Document Creation and available from Document Workflow.
- Manual uploads use the same tracking and approval process.
- Public tracking does not expose draft content or attachments before approval.
- iPluma status, when added, is distinct from internal approval and is connected to the same tracking record.

## Remaining decisions for iPluma integration

- Which role should be allowed to mark a PDF as **Needs signing**, and which authorized signer should submit it after approval?
- Confirm the iPluma PDF upload field, signer payload, status callback or polling endpoint, and signed-file download mechanism.
- Confirm whether public tracking should later show a minimal **Awaiting Approval** status. Current implementation hides the record until approval.
- File replacements require approval again and retain the existing tracking number.
- Approved records have their own section in Document Workflow, separate from My Submissions.

## Status

The tracking-first workflow, Document Workflow page, approval actions, tracking-number PDF stamp, public-tracking gate, and attachment View/Download controls are implemented. iPluma PDF submission and signed-file handling remain unavailable until the service API contract is confirmed; the UI records signing need and displays status separately.
