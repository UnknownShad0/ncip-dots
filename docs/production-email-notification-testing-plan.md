# Production Email Notification Testing and Delivery Logging Plan

**Status:** Proposal for review  
**Environment:** Production DOTS with existing active Gmail users  
**Primary goal:** Safely verify real email delivery without accidentally notifying unrelated users  
**Production behavior changed by this document:** None

## 1. Executive summary

DOTS currently has a global email delivery switch and an administrator test-email action. However, the current application does not keep a permanent database history of recipients and delivery attempts.

Testing with existing production users requires stronger safeguards because their email addresses are real and active. The recommended solution has two parts:

1. Add a controlled **Test mode** that permits only explicitly selected test recipients while normal workflow emails remain blocked.
2. Add a permanent `email_notification_deliveries` table that records queued, accepted, skipped, and failed attempts without storing OTP codes, password tokens, document bodies, or other sensitive content.

The recommended delivery modes are:

```text
Paused -> no outgoing email
Test   -> controlled test messages to approved recipients only
Live   -> normal DOTS workflow and account emails
```

Production testing should begin with the administrator's own inbox, then expand to a small group of users who were informed that they would receive a test message.

## 2. Current implementation

The current system has:

- an `email_notification_settings` table containing the global enabled/paused state;
- an administrator **Send test** action;
- queued document workflow notifications through the `jobs` table;
- failed queued jobs in `failed_jobs`;
- masked recipient information in application logs;
- no permanent database table listing successful email recipients.

Current limitations:

- successful jobs are removed from `jobs`;
- `failed_jobs` contains only failed queue payloads;
- application logs contain masked addresses and are not an administrator-friendly delivery report;
- a successful SMTP call means the provider accepted the message, not that the user opened it or that it reached the inbox;
- the global switch must currently be enabled before an administrator can send a test email.

The last limitation creates risk in production. While delivery is globally enabled, an unrelated workflow, account, OTP, verification, or password-reset email may also be sent.

## 3. Safety principles

Production email testing must follow these rules:

- Do not trigger real document workflows only to test email delivery.
- Do not send test messages to every active user.
- Do not assume an active Gmail address grants permission to send repeated tests.
- Start with the administrator's own controlled inbox.
- Add other users only after they are informed and selected explicitly.
- Use harmless test content with no real document information.
- Prefix the subject with a clear test label.
- Require explicit confirmation immediately before sending.
- Apply per-recipient and per-administrator rate limits.
- Keep normal automated notifications blocked during controlled testing.
- Record every attempted test, including blocked and failed attempts.
- Never store authentication secrets or security codes in the delivery log.

## 4. Proposed email delivery modes

Replace the single boolean concept with an explicit delivery mode:

| Mode | Administrative test email | Normal workflow email | Account/security email |
| --- | --- | --- | --- |
| `paused` | Blocked | Blocked | Blocked |
| `test` | Allowed only to approved recipients | Blocked | Blocked |
| `live` | Allowed | Allowed | Allowed |

### Paused mode

- Every outgoing email is blocked.
- The Admin page may preview a test message, but it cannot send it.
- Queued workflow jobs are skipped according to the existing pause behavior.

### Test mode

- Only the dedicated production-test endpoint may send.
- The recipient must be explicitly selected from the approved test-recipient list.
- Normal workflow, account, OTP, verification, and password-reset messages remain blocked.
- A special header alone must never bypass the delivery policy.
- The server must validate the message type and recipient through a centralized delivery policy before calling the mail transport.

### Live mode

- Existing normal email behavior operates.
- The delivery log records attempts and outcomes.
- The current global kill switch remains available by returning the mode to `paused`.

## 5. Approved test recipients

The first release should not permit unrestricted bulk recipient entry in production.

Recommended recipient rules:

- Default recipient is the signed-in administrator's own email.
- Additional recipients must be existing active DOTS users.
- The administrator selects recipients individually.
- Maximum of five recipients per test run.
- The UI shows the recipient's name, office, username, masked email, and active status.
- The confirmation dialog lists every recipient before sending.
- The administrator must enter a reason for the production test.
- The administrator must type `SEND TEST` to confirm a multi-recipient run.

Optional stricter first release:

- Allow only the administrator's own email.
- Add pilot recipients later after self-delivery is confirmed.

Recommended rollout starts with the stricter option.

## 6. Test message content

Suggested subject:

```text
[DOTS TEST - NO ACTION REQUIRED] Email delivery verification
```

Suggested heading:

> DOTS email delivery test

Suggested message:

> This controlled test message was sent by an authorized DOTS administrator to verify production email delivery. No document was routed, no approval is required, and no action is needed.

Suggested details:

```text
Environment: Production
Message type: Controlled delivery test
Requested by: Administrator name and office
Requested at: Philippine date and time
Reference ID: Non-sensitive test run identifier
```

Required footer:

> If you did not expect this test, please inform the DOTS administrator. Do not reply with passwords, verification codes, or confidential document information.

The message must not include:

- real document titles;
- real tracking numbers;
- document attachments;
- OTP codes;
- password-reset or verification links;
- confidential remarks;
- a button that performs a workflow action.

## 7. Administrator test flow

### Step 1: Preview

The administrator opens **Administration -> Email notifications -> Production test**.

The page shows:

- current delivery mode;
- SMTP configuration status;
- sender address;
- selected recipients;
- subject and message preview;
- rate-limit status;
- a warning that the recipients are real production users.

Previewing does not send or queue an email.

### Step 2: Select recipients

The administrator starts with their own account. Additional users may be selected only if the policy allows pilot recipients.

Inactive, locked, missing-email, invalid-email, or external free-form recipients should be unavailable by default.

### Step 3: Enter reason

Example:

> Verify Gmail delivery after production SMTP configuration update.

The reason is stored in the audit and test-run records but does not need to appear in the email.

### Step 4: Confirm

The confirmation dialog displays:

- exact number of recipients;
- names and masked addresses;
- subject;
- delivery mode;
- statement that no workflow action will occur.

Single-recipient tests require a confirmation button. Multi-recipient tests additionally require typing `SEND TEST`.

### Step 5: Send

Each recipient receives an independent queued job. One failure must not prevent the remaining selected recipients from being processed.

### Step 6: Review results

The Admin page shows one result per recipient:

```text
Queued
Sending
Accepted by SMTP
Skipped by policy
Failed
```

Do not display **Delivered** unless a trusted provider webhook confirms delivery.

### Step 7: Recipient confirmation

For the small pilot, manually confirm:

- message reached inbox or spam;
- sender and subject are correct;
- HTML and plain-text versions are readable;
- Philippine time is correct;
- no real document or security information appears;
- no duplicate message was received.

## 8. Permanent delivery log

Recommended table:

```text
email_notification_deliveries
```

Suggested fields:

```text
id                          bigint or UUID
test_run_id                 nullable test-run reference
notification_type           string
channel                     string, initially "mail"
recipient_user_id           nullable foreign key to users
recipient_email_hash        char(64)
recipient_email_masked      string
recipient_domain            nullable string
subject                     string
status                      queued/sending/accepted/skipped/failed
environment                 string
mailer                      nullable string
provider_message_id         nullable string
attempts                    unsigned integer
requested_by                nullable foreign key to users
reason                      nullable text
document_id                 nullable foreign key
tracking_number             nullable string
failure_category            nullable string
failure_message             nullable sanitized text
metadata                    nullable JSON
queued_at                   nullable timestamp
started_at                  nullable timestamp
accepted_at                 nullable timestamp
skipped_at                  nullable timestamp
failed_at                   nullable timestamp
created_at
updated_at
```

### Recipient privacy

Prefer storing:

- `recipient_user_id` for registered users;
- a SHA-256 normalized email hash for correlation;
- a masked address for display;
- the email domain for aggregate troubleshooting.

Avoid storing a second unnecessary plaintext copy of a user's email. The current address can be read through the user relationship when the administrator is authorized.

If free-form external test recipients are supported later, store the full address encrypted and keep the normalized hash for lookup.

### Sensitive-data exclusions

Never store in the delivery table:

- OTP or verification codes;
- password-reset tokens;
- signed URL secrets;
- complete document bodies;
- attachments;
- SMTP passwords;
- raw serialized jobs;
- full exception traces containing credentials or message content.

## 9. Optional test-run table

For multi-recipient testing, add:

```text
email_notification_test_runs
```

Suggested fields:

```text
id
requested_by
reason
recipient_count
delivery_mode
status: prepared/queued/completed/partially_failed/failed/cancelled
started_at
completed_at
created_at
updated_at
```

Each delivery row references its test run. This makes it easier to review one controlled production test without mixing it with normal workflow notifications.

## 10. Status semantics

Use precise terminology:

- `queued`: DOTS created a job but has not attempted SMTP delivery.
- `sending`: a worker has started the attempt.
- `accepted`: the SMTP provider accepted the message without returning an error.
- `skipped`: DOTS policy prevented the message from being sent.
- `failed`: the current attempt failed and no additional retry remains, or the operation was permanently rejected.

Do not infer:

- inbox placement;
- user reading/opening the email;
- link clicks;
- successful human receipt.

Gmail may accept a message and later classify it as spam or reject it asynchronously. True delivery and bounce status require a provider-supported webhook or mailbox-level verification.

## 11. Queue and retry behavior

- Use one queued job per recipient.
- Use the existing retry strategy only for transient failures.
- Do not retry permanent invalid-recipient or policy failures.
- Update the same delivery row for retries instead of creating misleading duplicate records.
- Increment `attempts` for every SMTP attempt.
- Mark the row `accepted` only after the mail call completes successfully.
- Mark the row `failed` in the job's final `failed()` handler.
- Use an idempotency key to prevent duplicate sends when the request or worker retries.

Suggested idempotency scope:

```text
test run ID + recipient email hash + notification type
```

## 12. Rate limits

Recommended initial limits:

- one test message per recipient every five minutes;
- maximum five recipients per test run;
- maximum twenty test recipients per administrator per day;
- maximum fifty production test messages system-wide per day;
- no bulk resend button.

Rate-limit violations should be recorded as `skipped` with reason `rate_limited`.

These limits should be configuration values so administrators can adjust them through deployment configuration, not ordinary UI controls.

## 13. Audit trail

Recommended audit events:

```text
email_test.prepared
email_test.queued
email_test.cancelled
email_delivery.mode_changed
```

Audit details should include:

- test run ID;
- administrator ID and office;
- reason;
- recipient user IDs;
- masked recipient addresses;
- recipient count;
- previous and new delivery mode when applicable.

Individual delivery outcomes belong in `email_notification_deliveries`; avoid writing one large audit entry containing sensitive failure traces.

## 14. Admin delivery-history page

Add a read-only **Delivery history** section to the existing Email notifications page.

Recommended columns:

```text
Time (PHT)
Type
Recipient
Subject
Status
Attempts
Requested by
Related DOTS No.
```

Recommended filters:

- status;
- notification type;
- date range;
- recipient user;
- tracking number;
- test run.

The detail panel may show sanitized failure information, timestamps, and audit references. It must not show SMTP credentials, OTP codes, tokens, or complete email bodies.

## 15. Permissions

Recommended permissions:

- View SMTP configuration status: existing email administrator permission.
- Change delivery mode: super-administrator or explicitly authorized email administrator.
- Send a production test to self: email administrator.
- Send to additional pilot users: super-administrator or dedicated `email_test.send_to_users` permission.
- View delivery history: authorized email administrators and auditors.
- View sanitized failure details: authorized email administrators only.

Do not base production-test permission only on a visible navigation item.

## 16. Interim procedure before Test mode exists

The safest option is to test in staging or with the administrator's own inbox after Test mode is implemented.

If a one-time production self-test is operationally required before implementation, use a controlled maintenance window:

1. Inform the responsible administrator and obtain authorization.
2. Restrict normal user activity through the existing maintenance mechanism.
3. Stop or pause the queue worker.
4. Inspect pending email jobs without deleting or modifying them.
5. Enable email delivery.
6. Send exactly one Admin test to the administrator's own controlled Gmail address.
7. Pause email delivery immediately after the request finishes.
8. Verify the message and application logs.
9. Restart the queue worker only after confirming the global mode is paused.
10. End the maintenance window.

Do not use this interim procedure for multiple production users. Do not trigger document routing, approval, password reset, verification, account creation, or OTP events as test messages.

## 17. Staged rollout

### Phase 0: Automated and local verification

- Run focused email feature tests.
- Verify HTML and plain-text rendering using the array mail transport.
- Confirm paused mode blocks all message categories.
- Confirm test-mode policy blocks normal workflow mail.

### Phase 1: Administrator self-test

- Enable Test mode.
- Select only the signed-in administrator.
- Send one controlled test.
- Confirm inbox/spam placement and content.
- Review the delivery row and audit record.

### Phase 2: Small informed pilot

- Select two to five informed users from different offices.
- Confirm their current DOTS email addresses before sending.
- Send one test run.
- Collect manual confirmation from each recipient.
- Investigate failures without immediate bulk resend.

### Phase 3: Limited real workflow

- Change to Live mode during a monitored window.
- Trigger one legitimate low-risk document notification through normal business activity.
- Verify recipient, delivery record, queue processing, and audit trail.
- Pause delivery immediately if an unexpected recipient or duplicate send appears.

### Phase 4: Normal operation

- Keep Live mode enabled only after the pilot is accepted.
- Monitor failed and skipped delivery counts.
- Review the first week of delivery history daily.

## 18. Failure handling

Recommended failure categories:

```text
policy_blocked
notifications_paused
test_recipient_not_approved
invalid_recipient
rate_limited
smtp_authentication
smtp_connection
smtp_rejected
temporary_provider_failure
unknown
```

User-facing messages should be actionable but must not expose credentials or raw server responses.

Examples:

- **Blocked:** Test mode allows only approved test recipients.
- **Rate limited:** Wait five minutes before sending another test to this recipient.
- **SMTP authentication:** The mail server rejected the configured credentials. Review the protected server logs.
- **Accepted:** SMTP accepted the message. Ask the recipient to check the inbox and spam folder.

## 19. Retention and privacy

Recommended retention:

- successful/accepted test deliveries: 180 days;
- failed and skipped deliveries: 365 days for troubleshooting and audit;
- sanitized aggregate counts may be retained longer;
- provider webhook payloads, if added later, should have a separate minimal retention policy.

Retention should be reviewed against the organization's privacy, records-management, and audit policies before implementation.

Deletion must not remove the related core document audit event. It should remove only email-delivery operational data after the approved retention period.

## 20. Test plan

### Delivery policy

- Paused mode blocks test, workflow, account, OTP, and password-reset emails.
- Test mode allows the dedicated test message only to approved recipients.
- Test mode blocks workflow and account/security messages even if they are queued.
- Live mode permits normal messages.
- A forged message header cannot bypass the policy.

### Authorization

- An authorized administrator can test their own email.
- An unauthorized user receives `403`.
- A self-test user cannot add arbitrary recipients.
- Pilot-recipient permission is enforced server-side.
- Inactive and invalid-email users cannot be selected.

### Confirmation and rate limits

- Preview never creates a mail job.
- Send requires a reason and confirmation.
- Multi-recipient send requires the exact confirmation phrase.
- Per-recipient, per-admin, and system-wide limits are enforced.
- Duplicate request retries do not produce duplicate messages.

### Delivery records

- Queued, sending, accepted, skipped, and failed transitions are recorded.
- Retry attempts update one delivery row.
- Recipient address is masked in the UI.
- OTP, password token, signed URL secrets, and email body are absent from the log.
- PHT is used for display while timestamps remain UTC in storage.

### Queue and failure behavior

- One recipient failure does not stop other recipients in the test run.
- Temporary errors retry according to policy.
- Permanent errors do not retry.
- Final failure stores only a sanitized message.
- Pausing delivery before a queued attempt causes it to be skipped.

### UI

- Delivery mode is prominent and unambiguous.
- Production warning is visible before recipient selection.
- Results distinguish SMTP acceptance from confirmed inbox delivery.
- Filters and pagination work without exposing unauthorized recipient information.

## 21. Acceptance criteria

The feature is ready when:

- normal notifications remain blocked throughout Test mode;
- a production test can reach only explicitly approved recipients;
- the administrator sees the exact recipient count before sending;
- every attempted recipient has a permanent delivery record;
- retries cannot create duplicate emails;
- no sensitive code, token, body, attachment, or credential enters the log;
- accepted messages are not mislabeled as delivered;
- the global pause immediately blocks all categories;
- rate limits and authorization are covered by feature tests;
- the administrator can review delivery history using PHT display times.

## 22. Out of scope for the first release

- Marketing or broadcast email.
- Sending to arbitrary uploaded recipient lists.
- Email open tracking.
- Link click tracking.
- Storing complete email bodies.
- Automatic resend to every failed address.
- Treating SMTP acceptance as inbox delivery.
- Provider bounce webhooks, unless the selected mail provider supports and requires them.
- Editing user email addresses from the delivery-history screen.

## 23. Recommended implementation order

1. Confirm the three delivery modes and production-test permissions.
2. Add the delivery and optional test-run tables.
3. Introduce one centralized email delivery policy.
4. Add delivery-record lifecycle updates to the mailer and queued jobs.
5. Build the self-test-only production test flow.
6. Add confirmation, rate limits, idempotency, and audit events.
7. Add delivery history and sanitized failure details.
8. Add informed pilot-user selection.
9. Run automated tests and staging verification.
10. Perform the administrator self-test, followed by the small pilot.

## 24. Items for review

Please confirm these decisions before implementation:

1. Should the first release allow only administrator self-tests, or up to five informed users?
2. Who may change delivery mode from Test to Live?
3. Should recipient BCC be prohibited entirely? The recommendation is yes; use one independent message per recipient.
4. Should accepted and failed delivery records be retained for 180 or 365 days?
5. Should the recipient email be displayed only through the current user record, with masked snapshots in the delivery table?
6. Should Office B or the user's supervisor receive notice that a controlled email test was performed? The recommendation is no unless required by internal policy.

## 25. Related documents

- `docs/email-notification-testing-guide.md`
- `docs/email-notification-message-review.md`

The existing testing guide remains useful for staging and controlled workflow verification. This proposal adds the production safeguards and permanent recipient-delivery history needed before testing with real user accounts.
