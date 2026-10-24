# Wet Signing and Official Signed-Copy Plan

**Status:** Deferred proposal  
**Date:** October 24, 2026  
**Current priority:** iPluma electronic signing; retain this plan for a later wet-signing implementation

## Goal

Support documents that are approved and signed on paper without requiring the approver to use a personal phone camera as the source of the final government record.

The physical handoff and approval should remain fast, while the official digital copy is produced through a controlled records process.

## Recommended decision

- Only the primary document requires a signature by default.
- Supporting files remain unsigned unless a later policy explicitly marks an individual supporting file as requiring a signature.
- A wet-signing confirmation and the uploaded signed copy are separate events.
- The approver may confirm the decision and physical signature immediately after QR and OTP authentication.
- The final digital copy should normally be scanned and uploaded by authorized records or administrative staff using an office scanner.
- A personal-phone photo or ordinary gallery upload should not be the default source of the official signed copy.
- The record must not be considered signing-complete or eligible for final archival closure until the signed primary document has been uploaded and quality-checked.

## Proposed workflow

```text
Requestor presents the physical packet
        |
Approver scans any packet QR and verifies through OTP
        |
DOTS records physical receipt
        |
Approver reviews and signs the primary document on paper
        |
Approver selects "Approve and confirm wet signature"
        |
DOTS records approval and wet-signing confirmation
        |
Status: Signed copy pending official scan
        |
Authorized staff scans the complete signed primary document
        |
Staff uploads and quality-checks the signed PDF
        |
Status: Wet-signed copy verified
```

The physical packet may continue through the authorized routing process while the official scan is pending if agency policy permits. Final completion, terminal closure, or archival acceptance must remain blocked until the verified signed copy is on file.

## File scope

### Primary document

The complete signed primary document should be scanned, not only the page containing the signature. This preserves the relationship between the signature and the exact document version that was approved.

Store the signed scan as a new immutable file version. Preserve the original reviewed PDF alongside it.

Suggested file classification:

```text
type: signed_wet
signature_method: wet_ink
source_document_file_id: <approved primary file>
signed_by: <user id>
signed_at: <confirmation time>
uploaded_by: <user id>
uploaded_at: <upload time>
verified_by: <user id>
verified_at: <quality-check time>
```

Do not overwrite the original primary file. Do not add or alter a tracking stamp after the physical signature has been applied. Store a checksum for the uploaded signed copy and retain the upload and verification audit history.

### Supporting files

Supporting files are reference or evidentiary attachments and may already contain their own signatures. They are not included in the default DOTS signing requirement and do not need to be uploaded again after the primary document is wet-signed.

### Disposition form

The disposition form remains a representation of the authoritative DOTS routing history. It is not part of the signed-copy upload unless an approved records policy later requires a separately signed disposition form.

## Proposed states

Keep approval and signing state separate.

Suggested signing states:

| State | Meaning |
| --- | --- |
| `not_required` | No signature is required. |
| `needs_wet_signature` | The primary document must be signed on paper. |
| `signed_copy_pending_scan` | The authenticated approver confirmed the physical signature, but no official scanned copy is on file. |
| `signed_copy_uploaded` | A signed scan was uploaded and is waiting for quality review. |
| `wet_signed_copy_verified` | Authorized staff accepted the signed scan as complete and readable. |
| `signed_copy_rejected` | Quality review found a missing, unreadable, incomplete, or incorrect scan. |

An approval decision must not itself imply that the signed digital copy exists.

## Scan and quality requirements

The upload workflow should require:

- the complete primary document in the correct page order;
- a readable PDF with no missing or cropped content;
- visible signatures, initials, dates, stamps, and annotations;
- no glare, heavy shadows, blur, or perspective distortion;
- confirmation that the scan belongs to the approved primary-document version;
- uploader and verifier identities and timestamps;
- an immutable stored copy and checksum; and
- an audit entry for upload, acceptance, rejection, and replacement.

The agency records officer should set the authoritative resolution, color, file-format, retention, and quality-assurance rules. A practical internal baseline may use PDF/A and at least 300 DPI, subject to the agency's approved records policy.

## Mobile capture policy

Mobile capture may be considered later as an expedited or contingency method, but it should use a controlled in-application document scanner rather than an ordinary camera or gallery upload.

If enabled, require:

- agency authorization for the device and workflow;
- automatic page-edge and page-count detection;
- blur, glare, crop, and resolution checks;
- perspective correction and page-order preview;
- secure direct upload;
- deletion of temporary local copies where technically possible; and
- records-staff quality verification before the capture becomes the official signed copy.

Until those controls and an agency policy exist, use an office scanner for the final official copy.

## Authorization and audit rules

- Only an eligible approver at the active route office may confirm the wet signature.
- Only authorized records or administrative staff may upload or verify the official signed scan.
- The uploader may not silently replace an accepted signed copy. Corrections create a new immutable version and retain the rejected version and reason.
- Record receipt, approval, physical-signature confirmation, scan upload, quality verification, and final completion as separate audit events.
- Do not expose the signed file or private audit information through the public QR tracking page.

Suggested audit events:

```text
document.wet_signature_confirmed
document.signed_copy_uploaded
document.signed_copy_rejected
document.signed_copy_verified
```

## Routing and closure rules

- Receipt changes the active route step from waiting for delivery to received/in progress.
- Approval records the approver's decision.
- Wet-signing confirmation records that the physical primary document was signed.
- Upload and verification establish that the official digital signed copy is on file.
- If policy permits, physical routing may continue while the scan is pending.
- Terminal tagging, final completion, and archival closure must be blocked while a required signed copy remains pending or rejected.

## Deferred implementation sequence

1. Confirm the agency's records and wet-signing policy with the records officer.
2. Add explicit signing method and wet-signing states.
3. Add the authenticated wet-signature confirmation action.
4. Add signed-primary upload as a new immutable document-file version.
5. Add records-staff quality review and rejection/replacement handling.
6. Gate final closure and archival actions on verified signed-copy status.
7. Add authorization, concurrency, file-integrity, routing, and audit tests.
8. Consider controlled mobile capture only after the office-scanner workflow is stable.

## Acceptance criteria

- Only the primary document requires wet signing by default.
- The approver can confirm a wet signature without uploading from a personal phone.
- Approval does not falsely indicate that a signed digital copy is already stored.
- The original reviewed PDF and the scanned signed PDF remain separate immutable versions.
- Supporting files do not need to be uploaded again.
- Only an authorized user can upload or verify the signed copy.
- An incomplete or unreadable scan can be rejected without losing audit history.
- Final closure and archival acceptance are unavailable until the signed primary copy is verified.

## External policy references

- Republic Act No. 8792 requires electronic records to remain reliable, complete, authenticatable, and usable for subsequent reference: <https://lawphil.net/statutes/repacts/ra2000/ra_8792_2000.html>
- The National Archives of the Philippines Electronic Records Management Policy emphasizes preserving electronic-record content and metadata: <https://nationalarchives.gov.ph/wp-content/uploads/2025/04/ERMP-PRIMER25.pdf>
- National Privacy Commission Circular No. 16-01 requires government agencies to control authorized devices and safeguard personal data: <https://privacy.gov.ph/npc-circular-16-01-security-of-personal-data-in-government-agencies/>
