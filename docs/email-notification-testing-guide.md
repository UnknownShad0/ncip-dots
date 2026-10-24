# Email Notification Testing Guide

**Date:** October 24, 2026

**Purpose:** Simple manual steps for testing each implemented DOTS email message

## Before testing

1. Use test accounts and email addresses that you can open.
2. Make sure the document creator and approver accounts have valid email addresses.
3. For office emails, use an active administrator account assigned to the receiving office and allowed to receive documents.
4. Sign in as an administrator, open **Administration → Email notifications**, and enable **Email delivery**.
5. Send the administrative test email first to confirm the SMTP settings. This test is sent immediately and does not require a queue worker.
6. Before testing document workflow emails, keep this running in another terminal:

```bash
php artisan queue:work
```

The application uses the `database` queue for document workflow emails. Actions such as submitting, approving, routing, and receiving a document place an email job in the queue; the worker processes and sends it. The **Send test** action is different because it sends directly during the web request.

If the application was started with `composer run dev`, a separate command is unnecessary because that script automatically starts `php artisan queue:listen` together with the Laravel server and Vite.

Use a new test document when testing a different final decision. Approval, changes requested, and rejection change the document state and cannot all be tested on the same submission.

## 1. Administrative email delivery test

Expected subject: `[DOTS] Email delivery test successful`

1. Sign in as an administrator.
2. Open **Administration → Email notifications**.
3. Enter your test email address.
4. Select **Send test**.
5. Confirm that the email contains the NCIP logo, `Document Tracking System`, delivery status, and sender address.

Pause check:

1. Select **Pause email delivery**.
2. Select **Send test** again.
3. Confirm that DOTS shows a toast saying the message was blocked.
4. Confirm that no new email arrived, then enable delivery again before continuing.

## 2. Document waiting for approval

Expected subject: `[DOTS] Approval needed: {Document title}`

1. Sign in as the document creator.
2. Open **Documents → Document creation**.
3. Create or continue a document, then select **Submit for approval**.
4. Choose an approver office.
5. Check **Email the approvers**.
6. Select **Submit for approval**.
7. Check the inbox of an active administrator in the selected office.

## 3. Submission approved

Expected subject: `[DOTS] Approved: {Document title}`

1. Complete the “Document waiting for approval” steps using a fresh document.
2. Sign in as an approver from the selected office.
3. Open **Documents → Document creation** and find **Approval tasks**.
4. Select **Review version**, then **Approve**.
5. Confirm the decision.
6. Check the document creator's inbox.

## 4. Changes requested

Expected subject: `[DOTS] Changes requested: {Document title}`

1. Submit a fresh document for approval.
2. Sign in as the assigned office approver.
3. Open the document from **Approval tasks**.
4. Select **Request revision**.
5. Enter test remarks and confirm the decision.
6. Check the document creator's inbox and confirm that the remarks appear.

## 5. Submission rejected

Expected subject: `[DOTS] Rejected: {Document title}`

1. Submit a fresh document for approval.
2. Sign in as the assigned office approver.
3. Open the document from **Approval tasks**.
4. Select **Reject**.
5. Enter test remarks and confirm the decision.
6. Check the document creator's inbox.

## 6. Document registered

Expected subject: `[DOTS] Document registered: {DOTS No.}`

The email job and design are implemented, but the current registration controller action is not connected to a UI route or button. For now, test it manually:

1. Ensure **Email delivery** is enabled and the queue worker is running.
2. Open a terminal in the project directory.
3. Run `php artisan tinker`.
4. Replace the sample email address, then run:

```php
App\Jobs\SendDocumentStatusEmail::dispatch(
    recipientEmail: 'your-test-email@example.com',
    recipientName: 'Test User',
    documentTitle: 'Email Test Document',
    status: 'registered',
    versionNumber: 1,
    remarks: null,
    trackingNumber: 'TEST-26-10-0001',
);
```

5. Type `exit` to close Tinker.
6. Check the test inbox.

## 7. Routed document requires office review

Expected subject: `[DOTS] Office review needed: {DOTS No.}`

1. Sign in as the document creator.
2. Open **Documents → All documents**.
3. Select **Route a document**.
4. Complete the required document fields and check **Email me**.
5. Select **Create Routing Record**.
6. Select the document's **Forward document** action.
7. Choose an action, approval flow, and receiving office, then select **Forward document**.
8. Check the inbox of an active administrator in the receiving office.

For a sequential route, only the currently active office is notified. For a parallel route, each selected office can receive a notification.

## 8. Document received

Expected subject: `[DOTS] Document received by {Office}: {DOTS No.}`

1. Create and forward a routed document using the previous steps. Make sure **Email me** was checked when the routing record was created.
2. Sign in as an eligible user from the receiving office.
3. Open **Documents → All documents** or the incoming list on the dashboard.
4. Select the **Receive document** inbox icon and confirm receipt.
5. Check the document creator's inbox.

## 9. Route approved by an office

Expected subject: `[DOTS] Route approved by {Office}: {DOTS No.}`

1. Create, forward, and receive a routed document with **Email me** enabled.
2. While signed in as the receiving-office approver, open the document's **Review and decide** action.
3. Select **Approve**.
4. Check the document creator's inbox.

## 10. Route changes requested by an office

Expected subject: `[DOTS] Route changes requested: {DOTS No.}`

1. Create, forward, and receive a fresh routed document with **Email me** enabled.
2. Open the document's **Review and decide** action as the receiving-office approver.
3. Enter test remarks and select **Request changes**.
4. Check the document creator's inbox and confirm that the remarks appear.

## 11. Route rejected by an office

Expected subject: `[DOTS] Route rejected by {Office}: {DOTS No.}`

1. Create, forward, and receive a fresh routed document with **Email me** enabled.
2. Open the document's **Review and decide** action as the receiving-office approver.
3. Enter test remarks and select **Reject**.
4. Check the document creator's inbox.

## Not yet testable

The **Receipt verification PIN** email is still proposed in the QR/email OTP plan and is not implemented yet.

## Quick email checklist

For every received email, check:

- The subject matches the expected event.
- The NCIP logo and `Document Tracking System` header are visible.
- The recipient, document title, DOTS No., office, version, and remarks are correct when applicable.
- Only one primary action button is shown.
- The button opens the correct DOTS page.
- No document attachment or confidential document body is included.
- The email remains understandable when images are blocked.

## Optional automated verification

Run the focused email tests:

```bash
php artisan test tests/Feature/EmailIntegrationTest.php
```

