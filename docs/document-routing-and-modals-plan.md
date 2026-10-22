# Document Routing and Modals Improvement Plan

**Status:** In progress  
**Scope:** Documents index, Create Routing Record modal, generated-document PDF, and View/Forward dialogs

## Goal

Make the Documents page simpler to use, allow supporting files to accompany a routing record, improve the generated PDF's tracking details, and make document information easier to scan in the View and Forward dialogs.

## Baseline before implementation

- The Documents index toolbar has a Print button.
- The Create Routing Record modal accepts one source: an uploaded file or a generated document.
- The generated PDF currently shows the DOTS tracking number near the top of the page.
- View and Forward both use the shared `DocumentReferenceDetails` component for record information and attachments.
- The application has a signed, throttled `/track/{trackingNumber}` route for public tracking. It accepts finalized records regardless of approval status; the approval-status filter was removed from the tracking query.

## Progress

- The Documents index toolbar Print button has been removed; disposition-form printing remains on the document action menu.
- The routing form and server now accept up to five supporting files and store them separately from the primary document.
- Generated PDFs now include a QR code for the signed public tracking URL and place the DOTS tracking number in the footer.
- View metadata and transaction history now use table layouts.
- iPluma document submission is still unavailable; signing status and actions are limited to the primary file.

## Proposed changes

### 1. Documents index

- Remove the toolbar Print button from the Documents index.
- Keep disposition-form printing available from its existing document action.

### 2. Supporting files in Create Routing Record

- Add an optional multiple-file picker to the Create Routing Record modal.
- Make it available with either source choice: **Upload a document** or **Use generated document**.
- Keep the primary source file or selected generated document separate from the supporting files.
- Allow up to five supporting files. Validate each file using the existing accepted file types and size limit.
- Keep supporting files separate and unsigned. Only the primary source document (uploaded or generated) is eligible for iPluma signing.
- The current iPluma connection only reads signing summaries; it has no document-submission endpoint. Actual submission for signing remains dependent on the iPluma API contract being available.
- Store each supporting file as its own document attachment with a distinct `supporting` type so it is identified correctly in document details.
- Display the uploaded supporting files with the existing attachment view and download actions.
- Validate each file on the server using the accepted file types and size limit, with a maximum of five supporting files.
- Store the files privately, associate them with the new routing record, and clean up stored files if record creation fails.

### 3. Generated-document PDF layout

- Move the generated PDF's DOTS tracking number from its current top position to the lower-left footer.
- Add a QR code near the top of the generated PDF.
- Render the QR code with a white background and black modules for reliable scanning and printing.
- Link the QR code to the intended disposition/tracking destination for the record.

#### QR destination decision

- Use the existing signed `/track/{trackingNumber}` public tracking URL as the QR destination. A separate printable disposition-form route is not part of this plan.
- Generate the signed URL for the record and encode the complete URL, including its signature, in the QR code.
- The public tracking query requires the record to be finalized but does not require `approval_status` to be `approved` or `not_required`. This behavior is already implemented in `PublicDocumentTrackingController`.
- Treat the full signed URL as the access link: anyone who receives or scans it can view the public tracking information, even if the record is still awaiting approval. The tracking number by itself is not enough to access the signed route.

### 4. View and Forward dialogs

- Present the shared document metadata as a responsive label/value table in both dialogs.
- Present transaction history in a table with action, status, office movement, user, and date columns where available.
- Keep attachments in a separate section so their View and Download controls remain easy to use.

## Validation and access considerations

- Enforce multiple-file validation on the server as well as in the browser.
- Preserve the distinction between the primary document and supporting attachments.
- Keep iPluma signing eligibility limited to the primary source document; supporting attachments must remain unchanged and unsigned. Actual iPluma submission is not yet connected.
- Use the existing private storage and authorized attachment endpoints for supporting files.
- The signed QR link can be shared by anyone who has it. Keep the public page limited to its intended tracking fields; do not expose internal remarks or private attachments through the QR link.
- Public tracking is available for finalized records regardless of approval status. Revisit this visibility rule if pending-approval records should not be visible to signed-link holders.
- Keep document role and office access rules in force in both dialogs and attachment actions.

## Likely implementation areas

- `resources/js/Pages/Documents/Index.tsx` — remove the toolbar button, add the multiple-file picker, and update the View/Forward details presentation.
- `app/Http/Controllers/DocumentController.php` — validate and store multiple supporting files during routing-record creation.
- `app/Models/DocumentFile.php` and existing document-file relationships — categorize and expose supporting attachments.
- `app/Services/DocumentPdf.php` and `resources/js/Components/PaginatedDocument.tsx` — pass tracking and QR details to the generated PDF and render the footer and QR code.
- `app/Http/Controllers/PublicDocumentTrackingController.php` — the approval-status restriction has been removed; keep the finalized-record check and public-field scope aligned with this plan.
- iPluma integration — only signing-summary retrieval is connected; document submission needs the iPluma signing endpoint contract.
- Use the existing signed tracking route for the QR destination; no separate disposition-form endpoint is planned.

## Acceptance criteria

- The Documents index no longer shows the toolbar Print button.
- Users can add multiple supporting files in either source mode when creating a routing record.
- The selected source remains the primary document, and supporting files appear as separate attachments in record details.
- Only the primary document is eligible for iPluma signing; supporting files remain separate unsigned attachments. Actual submission is pending an iPluma signing endpoint.
- The generated PDF shows the DOTS tracking number at the lower-left footer and a scannable black-on-white QR code near the top.
- The QR code opens the full signed public tracking URL and respects its access rules.
- A finalized record can be viewed through its signed tracking URL regardless of approval status; the public page does not expose internal remarks or private attachments.
- View and Forward dialogs show document details in readable tables at desktop and narrow screen widths.
- Existing routing, approval, office access, and attachment authorization behavior remains intact.

## Implementation sequence

1. [x] Use the existing signed public tracking route as the QR destination; supporting uploads are limited to five files.
2. [x] Update the routing form and server-side attachment handling.
3. [x] Update the generated PDF layout and QR link.
4. [x] Convert document details and transaction history to responsive tables.
5. [x] Remove the Documents index toolbar Print button.
6. [ ] Connect iPluma document submission when the signing endpoint contract is available.
