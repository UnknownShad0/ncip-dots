# QR + Email OTP Document Workflow — Step-by-Step Testing Guide

This guide covers the implemented QR workflow for receiving, reviewing, approving, wet-signing, and forwarding a DOTS document.

## 1. What is implemented

- Existing DOTS users only; the entered email must match `users.email`.
- The account must be active, unlocked, and assigned to the office of the active route step. A successful OTP verifies an imported account whose `email_verified_at` is still empty.
- Six-digit email OTP with a 10-minute lifetime and a maximum of five failed attempts.
- A new code cannot be requested until the 60-second resend countdown finishes; the backend enforces the same cooldown.
- A successful OTP creates a 20-minute, document-scoped QR session. It is not a full DOTS login.
- Receipt is allowed only when the office route step is `available` and the user has a receiving role.
- Approve, request changes, and reject are allowed only when the step is `in_progress` and the user has an administrator/approver role.
- Forwarding is available to an authorized administrator at the active office.
- A document marked `needs_signature` cannot use ordinary approval. A PDF wet-signed copy must be uploaded first.
- The wet-signed PDF is stored as a new `signed` version with its source file, route step, signer/uploader, and SHA-256 hash recorded.
- iPluma is shown as unavailable because live iPluma signing is not connected yet.

## 2. One-time setup

Run the new migrations:

```bash
php artisan migrate
```

For local testing without sending a real email, set these values in `.env`:

```dotenv
MAIL_MAILER=log
MAIL_FROM_ADDRESS=dots@example.test
MAIL_FROM_NAME="DOTS"
```

Then run `php artisan config:clear`. With the log mailer, find the six-digit code in `storage/logs/laravel.log`.

For a real email test, configure the normal SMTP variables instead. OTP delivery is a security email and still works when optional automated document notifications are paused.

## 3. Prepare the test records

Use a finalized document with a pending route. Confirm all of the following:

1. The current office route step has status `available`.
2. The test user already exists in the DOTS users list.
3. The user's email is correct. It may initially have an empty `email_verified_at`; successful OTP verification fills it.
4. The user is active, not locked, and assigned to the same office as the active route step.
5. For a complete receive-and-approve test, use an Admin Staff account (`role_id = 3`).
6. For a receive-only test, use an Encoder account (`role_id = 14`).
7. The approver is not the document creator.

Use the QR code already stamped on the document/PDF. It must open a valid signed `/track/{trackingNumber}` link.

## 4. Test A — Receive and approve without signing

Use a document whose `signature_status` is `not_required`.

Before this test, open a finalized document that has not been forwarded. The entire **Secure QR processing** card must be hidden. It should appear only after an office route step becomes `available` or `in_progress`.

1. Scan the QR code and confirm the public tracking details and route map.
2. Under **Secure QR processing**, enter the registered official email.
3. Click **Send verification code**.
4. Get the code from the email or `storage/logs/laravel.log`.
5. Enter the six-digit code and click **Verify and continue**.
6. Confirm the user's name, office, and `Waiting to receive` step.
7. Click **Mark physical document as received**.
8. Confirm the route step changes to `In progress` and the activity timeline contains **Received for approval**.
9. Confirm that the authenticated card shows only the available **Review and Decide** and **Forward** actions, not the complete forms.
10. Click **Review and Decide** and review the files in the DOTS-style dialog.
11. Enter optional remarks and click **Approve**.
12. Confirm the step becomes `Approved`. For a sequential route, the next step should become `Waiting to receive`; for the final step, the route/document should become approved.

Expected audit actions include `document.qr_otp_authenticated`, `document.route_step_received`, and `document.approval.approved`.

## 5. Test B — Wet-signed PDF approval

Use a document whose `signature_status` is `needs_signature`.

1. Complete OTP verification and receipt as in Test A.
2. Click **Review and Decide** and confirm ordinary **Approve** is not offered. Beside **View** and **Download** on the primary PDF row, the **Sign with iPluma** button must be visible but disabled while the integration is unavailable.
3. Sign the physical document using a wet signature.
4. Scan the complete signed paper using any device or office scanner.
5. Save the result as a clear PDF. Do not upload a photo or editable Word file.
6. Choose the PDF under **A signed copy is required** in the review dialog.
7. Click **Upload signed PDF and approve**.
8. Confirm a new file with type `signed` appears.
9. Confirm the green **Signed** badge appears on the uploaded signed file, not on the original primary file.
10. Confirm the route step is approved and `signature_status` is `signed`.

Expected version metadata:

- `document_files.type = signed`
- `signature_method = wet_ink`
- `source_document_file_id` points to the version that was signed
- `route_step_id` points to the approving route step
- `sha256` contains a 64-character file hash
- `document_route_steps.signed_document_file_id` points to the signed PDF

Negative checks:

- Ordinary approval on a `needs_signature` document must fail.
- JPG, PNG, or DOCX upload must fail.
- Upload by a non-approver must return `403 Forbidden`.

## 6. Test C — Separate receiver and approver

1. Authenticate as an Encoder (`role_id = 14`).
2. Receive the document and confirm approval buttons are not shown.
3. End the secure QR session.
4. Open the QR again and authenticate as a registered approver in the same office.
5. Confirm the step is already `In progress` and approval actions are shown.
6. Approve, request changes, reject, or upload the required wet-signed PDF.

This verifies that OTP identifies the DOTS user while the user's role still controls every action.

## 7. Test D — Forward to another office

1. Authenticate as the authorized approver of the office holding the document.
2. Receive the document if it is still `available`.
3. Click **Forward** to open the DOTS-style forwarding dialog.
4. Select an action type and one or more offices in the same configured range.
5. Choose `Sequential` or `Parallel`. For sequential routing, verify that the selected offices can be reordered.
6. Choose **Keep current document** or **Upload new version**, add optional remarks, and click **Forward document**.
7. Confirm a child route appears and the parent step becomes `Waiting on branch`.
8. Complete the child route and confirm the parent office returns to `In progress` for its final decision.

Existing DOTS rules still apply: no forwarding to the same office, no branch loop to an ancestor office, and every target office must have an active approver.

## 8. Security and failure tests

- **Unknown email:** use an email outside DOTS. The page must show that the email is not registered, remain on the email form, and send no OTP.
- **Existing but ineligible account:** use an account from another office or an inactive, locked, or unauthorized account. The page must show that the DOTS account is not eligible for the current route step and send no OTP.
- **Wrong OTP:** enter a wrong code five times. The challenge becomes invalid; request a new code.
- **Resend cooldown:** immediately after requesting a code, the button must count down from about 60 seconds. A manual resend request during the cooldown must also be rejected.
- **Expired OTP:** wait longer than 10 minutes. The code must be rejected.
- **Expired QR session:** wait longer than 20 minutes after verification. A new OTP must be required.
- **Document isolation:** authenticate for Document A, then try an action or file URL for Document B. DOTS must return `403 Forbidden`.
- **Signed-link protection:** alter or remove the `signature` value in the original tracking URL. DOTS must reject it.

## 9. Automated verification

Run the focused workflow suite:

```bash
php artisan test tests/Feature/QrDocumentWorkflowTest.php
```

Run the complete backend suite and frontend build:

```bash
php artisan test
npm run build
```

The focused suite verifies eligible-user OTP creation, scoped authentication, receive-and-approve, receiver-only denial, wet-signed PDF versioning, and cross-document isolation.

## 10. Troubleshooting

- **No OTP arrives:** check mail settings, `MAIL_FROM_ADDRESS`, and `storage/logs/laravel.log` when using the log mailer.
- **Email is reported as unregistered:** verify that the address exactly matches `users.email` after trimming spaces; matching is case-insensitive.
- **DOTS account is reported as ineligible:** verify `is_active`, `is_locked`, `office_id`, role, and current route-step status. A blank `email_verified_at` alone no longer blocks OTP.
- **Receive button is missing:** the step is not `available`, the office does not match, or the role cannot receive.
- **Approval buttons are missing:** the document has not been received, the user is not an approver, the approver created the document, or approval is no longer pending.
- **Forwarding has no office choices:** the user's office has no range, or no other office exists in that range.
- **PDF upload fails:** confirm it is a real PDF and below 100 MB.
- **Too many requests:** the QR page allows normal navigation traffic, while OTP requests, verification attempts, and resends have separate abuse limits. Wait about one minute when the inline rate-limit message appears; the page should not be replaced by a raw `429 Too Many Requests` screen.

