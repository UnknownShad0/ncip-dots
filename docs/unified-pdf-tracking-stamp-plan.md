# Unified PDF QR and DOTS Number Stamp Plan

## Goal

Use one consistent tracking layout for every PDF associated with a DOTS routing record. Its two tracking elements must always appear in their assigned positions:

- A QR code in a fixed white panel at the top-right that opens the document's public tracking page.
- `DOTS No.: <tracking number>` in the same footer-left position on every PDF, with an opaque white backing for contrast.

The phrase `Scan to track this document` and the label `DOTS Tracking No.` will be removed.

## Scope

The unified stamp will apply to:

1. Primary PDFs uploaded while creating a routing record.
2. PDF supporting files uploaded with the routing record.
3. PDFs generated from Document Creation drafts and attached to a routing record.
4. Replacement or version PDFs uploaded later in the workflow.
5. Generated revision PDFs submitted after changes are requested.

JPG, PNG, DOC, and DOCX files will remain unchanged. They are not PDF pages and cannot safely receive the same PDF overlay without first converting their format.

The disposition form is outside this change. It already has its own QR code and `DOTS No.` field as part of the form layout.

## Standard stamp layout

The tracking elements will be placed on the **first page only**:

- The QR code will be placed in the top-right corner.
- `DOTS No.: <tracking number>` will appear in the same footer-left position on generated, uploaded primary, supporting, version, and revision PDFs. The current generated-document position will be the shared reference position.

All stamped PDFs will use the same physical measurements rather than screen pixels:

- Fixed distance from the top and right edges.
- Fixed white, opaque background.
- Fixed internal padding.
- Fixed QR dimensions.
- Fixed footer-left placement for `DOTS No.` across every PDF type, using the current generated-document position as the shared reference and a small opaque white backing for readability over any source color.
- Black QR and text for reliable printing and scanning.
- No border unless testing shows that a subtle border is needed to distinguish the white panel on a white page.

Positioning will be calculated from the actual PDF page width so it remains consistent on portrait, landscape, Letter, A4, and other valid page sizes.

## Single stamping pipeline

### 1. Replace the text-only stamper

Refactor `TrackingNumberPdfStamper` into a service responsible for the complete tracking stamp. The service will receive:

- Source PDF bytes or file path.
- DOTS tracking number.
- Public tracking URL.

It will import the existing PDF, preserve every page, and overlay the QR at the top-right plus `DOTS No.` at the footer-left of page one. The same placement rules will apply to generated, uploaded primary, supporting, version, and revision PDFs.

A backend QR encoder will be used so uploaded and generated PDFs pass through the same server-side implementation. This prevents the React renderer and PHP stamper from producing different positions.

### 2. Uploaded primary and version PDFs

Keep `storeRoutedDocumentFile()` as the common entry point, but make it call the new unified stamper for every PDF. Non-PDF uploads will continue through normal storage unchanged.

### 3. Supporting PDFs

Change supporting-file storage so PDF supporting files also pass through `storeRoutedDocumentFile()` instead of being stored directly through `storeDocumentFile()`.

All supporting files belonging to the routing record will use the same DOTS number and public tracking URL as the primary document.

### 4. Generated PDFs

Remove the QR, `Scan to track this document`, and footer `DOTS Tracking No.` output from the generated-document renderer when producing the official tracked PDF.

The generated PDF will first be rendered as a clean base PDF, then passed through the same unified server-side stamper used for uploaded PDFs. This avoids duplicate QR codes and guarantees identical placement.

The editable draft preview may remain free of a tracking stamp because no official DOTS number exists yet. The stamp is added only when the generated document is connected to an official routing record.

### 5. Generated revisions

Generated revisions currently saved after a changes-requested decision must also pass through the same stamper before being stored as document versions.

## Tracking URL

The QR code will contain the signed public tracking URL for the routing record, using the existing `documents.track` route and the document's DOTS number.

The service should generate the URL from the document record rather than accept an arbitrary URL from the browser. This prevents incorrect or untrusted QR destinations.

## Failure handling

If a PDF is encrypted, damaged, or uses a format that FPDI cannot import:

- Do not silently store an unstamped copy.
- Reject the upload with a clear validation error identifying whether the primary or supporting PDF failed.
- Roll back the routing record and any files already stored during that request.

For multiple supporting files, the validation message should include the original filename that could not be stamped.

## Existing records

This implementation will affect new uploads and newly generated PDFs only.

Previously stored PDFs will not be rewritten automatically because that would alter existing document files. If historical files must be updated, that should be handled later through a separate, auditable migration or administrator command.

## Tests

Add automated coverage for the following:

1. A primary uploaded PDF is passed through the unified stamper.
2. Every PDF supporting file is passed through the same stamper.
3. Non-PDF supporting files remain unchanged.
4. A generated official document is stamped once, with no renderer-provided duplicate QR or tracking label.
5. A generated revision is stamped through the same service.
6. Uploaded version PDFs are stamped.
7. The public tracking URL in the QR belongs to the correct routing record.
8. The visible label is exactly `DOTS No.` and `DOTS Tracking No.` no longer appears.
9. `Scan to track this document` no longer appears in generated output.
10. A protected or unsupported primary PDF returns the existing clear validation error.
11. A protected or unsupported supporting PDF identifies the failing file and leaves no partial routing record or orphaned files.

Visual verification should cover at least:

- A4 portrait.
- Letter portrait.
- Landscape PDF.
- A dark or colored area underneath the white stamp.
- A multi-page PDF, confirming that only page one is stamped.
- QR scanning from both screen and printed output.

## Acceptance criteria

- Every new DOTS-related PDF uses one server-side stamping implementation.
- The QR code appears in the fixed top-right position.
- `DOTS No.` appears in the same footer-left position on generated, uploaded primary, supporting, version, and revision PDFs.
- The stamp has an opaque white background.
- The QR resolves to the correct public tracking page.
- `Scan to track this document` is absent.
- `DOTS Tracking No.` is absent from official generated and stamped PDFs.
- Supporting PDFs receive the same stamp as the primary PDF.
- Non-PDF files are preserved unchanged.
- No duplicate QR code or DOTS number is present.
- Existing routing, approval, file-download, and revision tests continue to pass.

## Proposed implementation order

1. Add or select the backend QR encoder.
2. Refactor the PDF stamper and establish the fixed physical layout.
3. Route primary, version, and supporting PDF uploads through it.
4. Remove the generated renderer's existing tracking elements.
5. Stamp official generated PDFs and generated revisions after rendering.
6. Add feature and service tests.
7. Build the frontend and run the relevant test suites.
8. Render sample PDFs and visually verify placement and QR readability.
