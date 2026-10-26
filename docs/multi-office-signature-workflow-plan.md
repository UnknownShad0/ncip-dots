# Multi-office signature workflow plan

## Purpose

Allow a finalized document to require signatures from selected offices in its approval route. Each office reviews and, when required, signs its step; that signature records the office's approval. The document advances only after that step's required signature and approval are recorded together. Wet-signed PDF upload should be available inside authenticated DOTS. iPluma can be used when its integration is available.

## Current behavior and gaps

- The prior document-level **Needs signing after approval** option applies the same requirement to every office, so it cannot represent routes where only some offices must sign.
- A document has one `signature_status`, so it cannot represent progress such as two of three offices signed.
- Internal DOTS shows a disabled iPluma action and has no wet-signed upload form. The internal approval endpoint does not require a signed file.
- The public QR tracking workflow has a wet-signed upload that also approves the current step. The internal DOTS UI should use the same combined action.
- Route steps already have a `signed_document_file_id` reference, but there is no per-step signature requirement or completion state.
- iPluma submission is currently not connected.

## Proposed user flow

1. **Create/finalize:** The creator creates the routing record and attaches the source document. Signature requirements are chosen when the approval route is set.
2. **Forward:** The creator selects the receiving offices and their order, then checks **Requires signature** on each office that must sign. If any office requires a signature, use sequential routing so each signer receives the latest PDF.
3. **Office receives the step:** DOTS exposes the current document version and shows the office's approval and signature requirements.
4. **Office signs and approves:** An authorized user uploads a wet-signed PDF, or completes iPluma signing once connected. This action records the office's approval and signature together. The signed file is attached to that office's route step.
5. **Advance:** After the signature and approval are recorded, DOTS activates the next office and makes the latest signed PDF available to it.
6. **Complete:** After all required signatures and all office approvals are recorded, DOTS marks the route complete and derives the document's signing progress from the required steps.

If an office rejects the document or requests changes, the route stops and follows the existing revision flow. A later route edit that adds an office must record whether that office requires a signature. Parallel routing should be unavailable while cumulative signatures are required unless a separate, explicit merge/order policy is designed.

## UI

### Create and forward

- Keep document creation focused on the document and source file; set signature requirements per office during forwarding.
- When forwarding, show the route order before submission and let the creator choose which office steps require a signature.
- Show a **Requires signature** checkbox for every selected office in the route preview.
- If any office is marked for signing, switch to sequential routing and explain that each signer receives the latest PDF.

### Internal DOTS document view

- In **Approval and Signing**, show a summary such as **Signatures: 2 of 3 complete**.
- Show the progress for each office in the route timeline, including pending, signed, and signer details.
- For the active office, show the available signature actions: upload a wet-signed PDF and approve, or use iPluma when connected.
- Keep the route paused until the office's required signature and approval are recorded together. Then show the next office as active.

### Public QR tracking

- Keep the public workflow available for eligible users and use the same signature rules and service as internal DOTS.
- Keep the public UI's combined "Upload signed PDF and approve" behavior and apply the same per-office signature requirements as internal DOTS.

### Attached files and signed versions

- Show the original PDF and one signed PDF for each office that signs. For a three-office route, the list should contain one original plus three signed PDFs.
- Each office signs the latest signed PDF from the previous step. Therefore, the third office's PDF contains the signatures from offices A, B, and C; earlier signed PDFs remain available as the record of each step.
- Keep each signed PDF linked to its route step and show which office/step produced it. Apply the same version sequence if signing is completed through iPluma.

## Data and audit record

Persist signature data against each `DocumentRouteStep`, rather than relying on a single document-level status:

- whether this step requires a signature;
- signature state and completion timestamp;
- signed `DocumentFile` reference;
- signer user, signing method, and file SHA-256.

Keep each uploaded signed PDF as a private, immutable document file linked to its route step and the PDF it was based on. Add an audit event for each signature, including document, route, office step, signer, method, file ID, and hash. Derive the document summary from required route steps, for example `2 of 3`.

## Server-side rules

- Only an authorized active user at the current office step can approve or sign that step.
- A required step's signing action must record its approval and signature atomically; the route cannot advance until both are saved.
- Enforce these rules in the server endpoints and transactions; hiding or disabling buttons is not sufficient.
- Validate uploads as PDFs, enforce the configured size limit, store them on the private disk, and preserve the original and every signed version.
- Prevent a stale or replaced source PDF from being signed for the active step.
- If iPluma is unavailable, do not show it as a working signing option. Record wet-ink upload as its own method.

## Acceptance checks

- With A, B, and C marked **Requires signature** on a sequential route, progress starts at 0 of 3.
- With A and C marked **Requires signature** and B left unchecked, progress starts at 0 of 2. A and C upload signed PDFs with approval; B uses ordinary approval.
- A's signed-and-approved action does not activate B until the signature file and approval are saved. The same rule applies from B to C.
- Each signature is linked to the correct step, user, method, timestamp, and immutable file hash.
- The final status reaches 3 of 3 only after all required signatures are recorded.
- A step with no signature requirement can follow the ordinary approval flow.
- Internal DOTS and public QR tracking enforce the same server-side rules.
- Rejections, revision requests, route edits, missing uploads, and upload failures cannot incorrectly mark the route or document fully signed.

## Review decisions

- Confirm that signature requirements are selected per office while forwarding, so a route can require signatures from some offices and ordinary approval from others.
- Confirm that an office's signature is its approval, and the route advances after the signed file and approval are saved.
- Confirm that signature-required routes must be sequential.
- Confirm who is authorized to sign for an office and whether signing can be performed by a user other than the approver.
- Confirm that the public QR workflow should retain wet-signed uploads with the same step rules.
- Confirm that Attached files should show the original plus one cumulative signed PDF per signing office, retaining earlier signed versions for the audit trail.
