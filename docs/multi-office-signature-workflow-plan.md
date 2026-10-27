# Multi-office signature workflow plan

## Purpose

Allow a finalized document to route to multiple offices for parallel review, while requiring signatures from only selected offices. Offices without a signature requirement can approve at any time. Signature-required offices add their signatures to one cumulative PDF by taking turns with an exclusive signing claim on the latest version.

This is a hybrid workflow: review and ordinary approvals happen in parallel; uploads that change the cumulative signed PDF happen one at a time. It does not allow two offices to upload signed copies based on the same version and merge them afterward.

## Implementation notes

- Signature requirements and signed-file references are stored per route step; document-level signing status is derived from those steps.
- Parallel signature claims are stored in `document_signature_claims`, with one active claim per document. Claiming and upload transactions lock the document row and check the claimed source version.
- Internal DOTS and public QR tracking expose claim, release, and wet-signed upload actions. A successful signed upload also approves that office's step and releases the claim.
- Signed PDFs are stored privately as immutable `DocumentFile` rows linked to the step and source file. File lists identify the office, signer, and source version.
- iPluma submission is still not connected; this implementation supports wet-signed PDF uploads.

## Proposed user flow

1. **Create/finalize:** The creator creates the routing record and attaches the source document.
2. **Configure the route:** The creator selects receiving offices, chooses parallel review, and checks **Requires signature** for each office that must sign. Each office's signature requirement is stored on its route step.
3. **Dispatch:** DOTS sends all offices the same finalized source version. Offices can review concurrently. Each office sees the current version, its approval/signature requirements, the latest signer, and whether another office currently holds the signing claim.
4. **Ordinary approval:** An office that does not require a signature can approve at any time without changing the PDF. Its approval is recorded against the version it reviewed.
5. **Claim and sign:** A signature-required office claims the current latest PDF. While the claim is active, other offices may view the file and route progress, but cannot upload another signed PDF. The claiming office signs the claimed version and uploads it, or releases the claim if it cannot proceed.
6. **Advance the signed version:** DOTS verifies that the upload was based on the claimed latest version, then stores it as a new immutable signed version linked to the route step, signer, source version, and audit event. The new file becomes the latest version and the claim is released. Any remaining signature-required office can then claim that version.
7. **Complete:** DOTS marks the route complete after all offices have approved and every required signature is recorded. Signing progress is derived from the required route steps.

For example, if A and B require signatures and C does not, C may approve while A and B review or sign. A and B can sign in either order, but one at a time: if A signs first, B signs A's new version, producing a final file with both signatures.

If an office rejects the document or requests changes, pause the route and follow the existing revision flow. Preserve prior files and audit records as history; do not treat signatures on a superseded version as signatures on a revised document.

## Signing claim and concurrency behavior

- There is one active signing claim for the document's current signature chain.
- A claim records the office, authorized user, source file/version, and claim time. It is created atomically so two offices cannot claim the same current version at once.
- Other offices can view the current file and see who is processing it, but signed-file uploads are disabled while a claim is active.
- The upload endpoint rechecks the claim and source file inside a database transaction. A stale upload cannot replace the latest version.
- A successful upload advances the latest-file pointer and releases the claim in the same transaction as recording that office's signature and approval.
- The claimant can release a claim if they cannot continue. An authorized administrator can clear or reassign a stuck claim, with an audit event. Avoid a short automatic expiry because wet-ink signing may take time; any expiry policy should be configurable and must never allow a stale upload to become the latest version.
- If two offices have already downloaded the same version, the claim ensures only one can sign/upload against it. The other office waits, then signs the newly published latest version.

## UI

### Create and forward

- Keep document creation focused on the document and source file; set signature requirements per office during forwarding.
- Show the selected offices and **Requires signature** checkbox for each office in the route preview.
- Let the creator choose parallel review even when some offices require signatures. Explain that review and unsigned approvals happen in parallel, while signed-file uploads are one at a time so signatures accumulate on one PDF.

### Internal DOTS document view

- In **Approval and Signing**, show progress such as **Approvals: 1 of 3 complete** and **Signatures: 1 of 2 complete**.
- Show each office's review/approval status, signature requirement, signature status, signer, and signed-file link in the route timeline.
- Show the latest PDF version and latest signer prominently.
- When no claim is active, let an eligible signature-required office claim the latest version and upload a wet-signed PDF with approval. When claimed, show **Being processed by [office/user]** and disable competing uploads.
- Let the claimant release the claim. Provide an audited admin action to clear or reassign a stuck claim.
- Keep the route's office reviews active in parallel; only the signed-file mutation is held by the claim.

### Public QR tracking

- Keep the public workflow available for eligible users and use the same signature rules and service as internal DOTS.
- Keep the combined **Upload signed PDF and approve** behavior.
- Enforce claim ownership and latest-version checks server-side for public uploads as well as internal uploads.

### Attached files and signed versions

- Show the original PDF plus each signed version, labeled with the office, signer, and upload time. Preserve earlier signed versions for the audit trail.
- Each accepted signature is based on the latest signed version. For A, B, and C signing in that order, the chain is: original, A-signed version, A+B-signed version, A+B+C-signed version.
- Link every signed `DocumentFile` to its route step and the source `DocumentFile` it was based on. A rejected stale branch must not replace or be presented as the cumulative latest version.
- Apply the same version-chain rules to iPluma output if/when the integration is available. If iPluma offers a coordinated multi-signer envelope, assess whether that can satisfy the same single-chain requirement without the DOTS upload claim.

## Data and audit record

Persist signature data against each `DocumentRouteStep`, rather than relying on a single document-level status:

- whether this step requires a signature;
- signature state and completion timestamp;
- signed `DocumentFile` reference;
- signer user and signing method;
- source file ID and file SHA-256.

Persist the active signing claim against the document's current signature chain, including claimant office/user, claimed source file, and claim timestamp. Enforce one active claim for a chain.

Keep each uploaded signed PDF as a private, immutable document file linked to its route step and the PDF it was based on. Add audit events for claim, release/reassignment, and each signature upload. Signature audit data should include document, route, office step, signer, method, source file ID, signed file ID, and hash. Derive approval and signature summaries from route steps.

## Server-side rules

- Authorized users can review and decide only offices they are permitted to represent.
- An office without a signature requirement can approve without acquiring a signing claim or changing the current PDF.
- A signature-required office must hold the active claim to upload a signed PDF. Its signing action records approval and signature atomically.
- Claim acquisition must be atomic; a second office cannot claim the same latest version while another claim is active.
- Verify claim ownership and that the submitted `source_document_file_id` matches both the claimed version and the current latest version inside the upload transaction.
- On success, save the signed file privately, record its source file, route step, uploader, hash, and method, advance the current latest version, and release the claim atomically.
- Reject stale or competing uploads without changing the current latest version. Preserve them only as rejected audit/history records if needed; never count them as part of the cumulative signature chain.
- Validate uploads as PDFs, enforce the configured size limit, store them on the private disk, and preserve the original and every accepted signed version.
- If any office rejects or requests changes, stop advancement and follow the revision flow. Revisions create a new source version and require renewed review/signatures according to the revision policy.
- If iPluma is unavailable, do not show it as a working signing option. Record wet-ink upload as its own method.

## Acceptance checks

- A, B, and C can all review the same source version at the same time.
- With A and B marked **Requires signature** and C left unchecked, C can approve while A or B holds the signing claim.
- A and B can sign in either order, but only one office can hold the claim for the current version at a time.
- After A signs the original, B's accepted signature must be based on A's signed version; the final file contains A and B's signatures.
- A competing claim or upload based on a stale version cannot overwrite the current latest file or count as a completed signature.
- Claim, release, reassignment, upload, signer, source version, signed version, timestamp, method, and file hash are auditable.
- The route completes only when all offices approve and every required signature is recorded.
- Rejections, revision requests, route edits, missing uploads, claim release, and upload failures cannot incorrectly mark the route or document fully signed.
- Internal DOTS and public QR tracking enforce the same server-side rules.

## Review decisions

- Confirm the hybrid model: parallel office review/approval, with one-at-a-time signing claims for cumulative PDF signatures.
- Confirm whether a signature upload is always also that office's approval, or whether approval can be recorded separately before the office claims the signing slot.
- Confirm who may claim/release a signature slot and who may clear or reassign a stuck claim.
- Confirm whether a claim should have a configurable expiry or remain active until released or completed.
- Confirm that a signing office may claim the next turn in any order, unless the route creator sets a preferred order.
- Confirm that public QR tracking uses the same claim behavior.
- Confirm the revision rule for signatures on a superseded source version.
- Confirm the expected iPluma multi-signer behavior when integration work begins.
