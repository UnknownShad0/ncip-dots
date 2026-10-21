# Document Creation Template Enhancements Plan

## Goal

Make the Document Creation editor clearer and more flexible by separating the document's **type** from its page **template**, keeping optional Memo fields out of the way until needed, and allowing an optional signature block at the bottom of the document.

## Current behavior

- The editor's control labeled **Template** currently selects a document type (`document_type_id`). These are separate concepts and should have separate controls.
- The current page layout is the Memo layout.
- The Memo editor always shows the **THRU** and **ATTENTION** rows, even when their values are blank. The generated PDF already omits either row when its name and position are blank.
- The current generated-document signing flow is separate: an attached PDF can be marked as needing iPluma signing in Routing, but PDF submission and signed-file return are not connected yet.

## Proposed editor behavior

### Separate document type and page template

- Keep **Document type** as the selector for the document's classification and existing `document_type_id` value.
- Add a separate **Template** selector with **Memo** and **Letter** options.
- Keep the current page design as **Memo** and select it by default for new documents.
- Add a simple sample **Letter** layout so users can preview and select it. The Letter layout can be refined later.
- Save the selected page template with the draft and its generated version so reopening or previewing a document uses the same layout.

### Optional THRU and ATTENTION fields in Memo

- Hide **THRU** and **ATTENTION** fields by default in the Memo editor.
- Show a brief hint such as “Optional fields — add only if needed” and small **+ Add THRU** and **+ Add ATTENTION** controls.
- Clicking a control reveals that field's existing name and position/designation inputs.
- Give each added field a **Remove** action. Removing it clears the name and position and hides the row; adding it again starts blank.
- If a saved draft already contains a value or position for one of these fields, show it automatically when the draft opens.
- Keep blank optional rows out of the generated PDF, matching the current rendering behavior.

### Optional signature block

- Add **+ Add signature block** to the editor and allow multiple signatories.
- Give every signature block a **Remove** action. Removing a block deletes it from the current draft; there is no Undo control.
- Each block has a signature area and fields for the signatory's name and position/title. Arrange multiple blocks in two columns, wrapping to another row as needed.
- Include enough blank space above the printed name and position for a signature. Let the blocks flow with the document content so they do not overlap the page footer or other content.
- Restore saved blocks when reopening a draft. Convert an existing saved single signature block into one item in the new list.
- Keep the printed signature block as a place for a signature; do not treat typed signer details or a blank line as a completed digital signature.

### Optional CC field

- Hide **CC** initially and show **+ Add CC**.
- When added, show the existing recipient list field and a **Remove CC** action.
- Removing CC clears its recipients and hides the field. Adding it again starts with an empty list.
- Show CC automatically when a saved draft already contains recipients. Omit an empty CC row from the generated PDF.

## iPluma relationship

- The signature block is part of the document layout. The iPluma action remains part of Tracking/Routing after the office approves a PDF marked as needing a signature.
- Keep approval status and signing status separate.
- The current iPluma PDF submission and signed-file return are still pending. Before placing an iPluma signature automatically in the reserved area, confirm that the iPluma API supports the required placement coordinates or signature field behavior.
- Until that API behavior is confirmed and implemented, the signature block only reserves space in the generated PDF; it does not apply or imply an electronic signature.

## Data and rendering considerations

- Store the selected page template independently from `document_type_id` so choosing Memo or Letter does not change the document's classification.
- Preserve the selected template and optional-field values in draft saves, preview requests, generated PDFs, and finalized versions.
- Store CC visibility separately from its recipient list. Store signature blocks as a validated list of signer names and positions/titles in the draft content.
- Update the React editor and the server-rendered PDF template together so the editor preview and generated PDF agree.
- Retain backward compatibility: existing drafts without a saved page-template choice should open as Memo, and existing THRU/ATTENTION values should remain visible.

## Suggested implementation order

1. Separate the page-template selection from the existing Document type selector; default existing and new drafts to Memo.
2. Add a sample Letter layout and save the selected page template with each draft/version.
3. Add the optional THRU and ATTENTION controls in the Memo editor and restore fields from saved values.
4. Add the optional signature block with signer name and position/title fields, and render it consistently in the editor and generated PDF.
5. Keep iPluma integration as a separate Routing task, pending confirmation of PDF submission, signature placement, status, and signed-file return behavior.

## Acceptance criteria

- Document type selection remains available and independent of the Memo/Letter page-template selection.
- New drafts use Memo by default; users can choose the sample Letter layout.
- THRU and ATTENTION are hidden initially in Memo, can be added independently, and appear automatically when saved values exist.
- Empty THRU and ATTENTION fields are omitted from generated PDFs.
- Users can add a signature block at the end of the document and enter the signatory's name and position/title.
- Users can add multiple signature blocks and remove any one of them. Removed blocks are not restored.
- Users can add or remove THRU and ATTENTION independently. Removing either clears its values and hides the row.
- Users can add or remove the optional CC field. Removing it clears its recipients.
- Saved page-template, optional-field, CC, and signature-block choices are restored when reopening a draft.
- The generated PDF matches the selected layout and optional fields shown in the editor.
- The signature block does not indicate that the document has been digitally signed; iPluma signing status remains on the tracked routing record.

## Status

The separate Document type and Memo/Letter selectors, sample Letter layout, optional Memo fields, optional CC field, and multiple removable signature blocks are implemented in the editor and PDF renderers. Older drafts default to Memo, and existing THRU/ATTENTION values and single signature blocks are preserved. Signature blocks only reserve space and display signer details; they do not apply digital signatures. iPluma PDF submission and signed-file handling remain pending confirmation of the API contract.
