# Email Notification Audit Plan

**Status:** Proposal for review  
**Access:** Super Administrator only  
**Scope:** Production email recipient auditing, queue safety, and masked delivery outcomes  
**Production behavior changed by this document:** None until implemented

## 1. Executive summary

DOTS needs a safe way for an authorized Super Administrator to answer:

- Who was selected to receive an email?
- Which office did the recipient belong to?
- What notification was sent?
- Which document or tracking number caused it?
- Was the message queued, accepted by SMTP, skipped, or failed?
- Was delivery blocked because email delivery was paused?

Add a **View Email Audit** button to the existing **Email notifications** administration page. The resulting page will read email-specific events from the existing audit trail and will be accessible only to Super Administrators.

Recipient addresses remain masked. The audit identifies the recipient through their DOTS user ID, name, office ID, and office name. Full email addresses, message bodies, OTP codes, reset tokens, and SMTP credentials must never be stored in audit details.

The audit reports **Accepted by SMTP**, not **Delivered**, unless a trusted provider webhook is implemented later. SMTP acceptance does not prove inbox placement or that the recipient opened the message.

## 2. Approved decisions

The first release will follow these decisions:

1. Only Super Administrators may open the Email Audit page or its API endpoint.
2. Email addresses are always masked in the audit UI and stored audit details.
3. There is no **Reveal full email** feature in the first release.
4. The recipient is identified primarily by `recipient_user_id` and `recipient_office_id`.
5. Production test recipients must be existing active DOTS users with valid email addresses.
6. One audit lifecycle is created for each recipient, even when a single office notification targets multiple administrators.
7. Paused, skipped, and failed attempts are recorded as well as accepted attempts.
8. Audit records never contain email bodies, attachments, OTP codes, password-reset tokens, signed URLs, or SMTP secrets.
9. Existing queued email jobs must not expose plaintext recipient addresses in `jobs.payload` or `failed_jobs.payload` after the safer job format is implemented.
10. An email queued before a pause must not unexpectedly send after a later re-enable.

## 3. Goals

- Give the Super Administrator a searchable history of email recipients.
- Identify recipients by user and office without exposing full email addresses.
- Correlate each notification with its document or tracking number when applicable.
- Distinguish queued, accepted, skipped, and failed outcomes.
- Explain why a notification was skipped or failed using sanitized reason codes.
- Preserve an immutable history of email delivery decisions.
- Prevent sensitive recipient data from leaking through the database queue, application logs, audit details, exports, or frontend payloads.
- Make paused-mode behavior predictable and auditable.

## 4. Out of scope

- Tracking whether a recipient opened an email.
- Claiming inbox delivery based only on a successful SMTP call.
- Displaying full recipient email addresses.
- Storing complete email content or attachments.
- Sending to uploaded, pasted, or arbitrary production email lists.
- Replacing the mail provider with a marketing or bulk-email platform.
- Allowing ordinary administrators, office administrators, or auditors to access this page in the first release.

## 5. Current implementation observations

The current system has:

- a global enabled/paused email setting;
- queued document notification jobs in the `jobs` table;
- permanently failed jobs in `failed_jobs`;
- masked recipient hints in some application logs;
- email jobs that recheck the paused setting when the worker handles them;
- no administrator-friendly list of successful recipients;
- no success log in the route-notification job;
- serialized queue payloads that may contain the full recipient address because email strings are currently passed directly to jobs.

The `jobs` table is not an appropriate administrator report. Successful jobs are deleted, payloads are serialized, and raw payloads may contain data that should not be exposed in the UI.

## 6. Navigation and authorization

Add the following button to **Administration -> Email notifications**:

> **View Email Audit**

Suggested endpoint:

```text
GET /admin/email/audit
```

Suggested route name:

```text
email-integration.audit.index
```

Authorization requirements:

- Require authentication.
- Require the existing administrator middleware.
- Additionally require `User::isSuperAdmin()` on the server.
- Return `403` for every other role, even if the user can see the normal system Audit Trail.
- Do not rely only on hiding the navigation button.

No ordinary Audit Trail link should expose email-recipient details to non-Super Administrators.

## 7. Email audit events

Use append-only audit actions:

```text
email.notification.queued
email.notification.accepted
email.notification.skipped
email.notification.failed
```

Optional retry event if individual attempts need to be visible:

```text
email.notification.retry_scheduled
```

Every event for one recipient delivery uses the same random `delivery_reference` so the Email Audit page can group the lifecycle without updating old audit records.

### Status meanings

- `queued`: DOTS created a queue job for the recipient.
- `accepted`: the SMTP call completed without returning an error.
- `skipped`: policy intentionally prevented the SMTP call.
- `failed`: the final attempt failed and no retry remains.
- `retry_scheduled`: a transient failure occurred and another attempt is scheduled.

Never label `accepted` as `delivered`.

## 8. Audit subject and details

For a registered recipient, use the recipient user as the audit subject where practical:

```text
model_type = App\Models\User
model_id   = recipient_user_id
```

The actor remains the authenticated user who initiated the action. Automated worker outcomes may have no authenticated actor; their initiator is preserved in `requested_by_user_id` inside the safe details.

Recommended audit details:

```json
{
  "delivery_reference": "random-uuid",
  "notification_type": "document_route_approval_required",
  "recipient_user_id": 430,
  "recipient_name": "Juan Dela Cruz",
  "recipient_office_id": 21,
  "recipient_office_name": "OPPR - Information and Communications Technology Division",
  "recipient_email_masked": "j***@gmail.com",
  "document_id": 62234,
  "tracking_number": "OPPR-ICTD-26-10-25-62234",
  "attempt": 1,
  "status": "accepted",
  "reason_code": null,
  "requested_by_user_id": 29,
  "queue": "default",
  "occurred_at": "2026-10-25T12:15:05+08:00"
}
```

### Required safe fields

- delivery reference;
- notification type;
- recipient user ID;
- recipient name snapshot;
- recipient office ID and office-name snapshot;
- masked recipient address;
- document ID and tracking number when applicable;
- attempt number;
- outcome/status;
- sanitized reason code;
- requesting user ID when applicable;
- Philippine timestamp.

### Prohibited fields

Never store the following in `audit_trails.details`:

- full recipient email address;
- email body or rendered HTML;
- complete document title if classified or sensitive;
- document attachment content or path;
- OTP or verification code;
- password-reset or email-verification token;
- signed URL secrets;
- SMTP username or password;
- raw job payload;
- raw exception trace;
- mail-provider credentials or access tokens.

## 9. Email masking

Use one centralized masking function for logs, audits, and the Email Audit page.

Examples:

```text
johnmark@example.com -> j***@example.com
a@example.com        -> a***@example.com
invalid value        -> invalid
```

The browser must receive only the masked value. Masking only in React is insufficient because the full address would still appear in network responses and browser developer tools.

Do not use a reversible encoding as masking.

## 10. Safe queue payload design

Queued jobs should stop receiving plaintext `recipientEmail` and `recipientName` constructor arguments for registered DOTS users.

Recommended job payload:

```text
recipient_user_id
document_id
notification_type/event
delivery_reference
delivery_generation
non-sensitive decision or route identifiers as needed
```

When the worker handles the job:

1. Load the recipient user by ID.
2. Confirm the account still exists and is active.
3. Confirm the user still belongs to the intended office when the notification requires office membership.
4. Confirm the user still has the required recipient role.
5. Validate the current email address.
6. Recheck the current email-delivery policy.
7. Record `skipped` when any permanent policy check fails.
8. Send using the current address only after all checks pass.
9. Record `accepted` after the SMTP call returns successfully.
10. Record a sanitized retry or final failure outcome when an exception occurs.

This prevents ordinary inspection of `jobs` and `failed_jobs` from revealing production user email addresses.

## 11. Production recipient restrictions

The production test form should not accept an unrestricted email string.

First-release rules:

- Default to the signed-in Super Administrator's own user account.
- Select recipients from existing DOTS users, not free-form addresses.
- Only active and unlocked users with valid emails may be selected.
- Show the selected user's name, office, user ID, and masked email before confirmation.
- Start with one recipient per test.
- Require an explicit confirmation.
- Apply a strict per-user and per-administrator rate limit.
- Record blocked and rate-limited attempts as `skipped` without creating a mail job.

Support for external addresses should remain out of scope. If it becomes necessary later, it requires encrypted storage and a separate approval policy.

## 12. Pause and queue safety

The paused setting must be checked:

1. before a new email job is queued; and
2. again immediately before the worker calls the mail transport.

### Recommended generation safeguard

Add an integer `delivery_generation` to the singleton email setting.

- A job stores the current generation when it is queued.
- Transitioning to `paused` increments the generation.
- A worker may send only when delivery is enabled and the job generation matches the current generation.
- A pre-pause job is permanently skipped after the generation changes, even if delivery is enabled again before the worker processes it.

This prevents a backlog created before a pause from unexpectedly sending after a later re-enable.

When a job is skipped, record:

```text
status: skipped
reason_code: notifications_paused
```

or:

```text
status: skipped
reason_code: delivery_generation_expired
```

Paused mode is a delivery block, not a temporary hold, for the first release. Skipped jobs will not be resurrected automatically.

## 13. Email Audit page

Suggested title:

> **Email notification audit**

Suggested description:

> Review who DOTS attempted to notify and the outcome recorded by the application. Email addresses are masked. Accepted means the SMTP provider accepted the request; it does not confirm inbox delivery or that the message was opened.

### Columns

```text
Time (PHT)
Recipient
User ID
Office
Office ID
Masked email
Notification type
Related DOTS No.
Status
Attempts
Requested by
```

### Filters

- date range;
- office;
- recipient user;
- tracking number;
- notification type;
- status;
- delivery reference.

Default behavior:

- newest events first;
- maximum 50 rows per page;
- default date range of the most recent seven days;
- server-side pagination and filtering;
- no CSV export in the first release;
- no raw JSON or exception display.

### Detail panel

The detail panel may show:

- complete event timeline for one delivery reference;
- queued, retry, accepted, skipped, and failed timestamps;
- sanitized reason text;
- document/tracking reference;
- recipient and office snapshots;
- audit actor/requester.

It must not show prohibited fields from Section 8.

## 14. Suggested notification types

Use stable internal values rather than full PHP class names:

```text
admin_test
document_received
document_route_approval_required
document_route_approved
document_route_changes_requested
document_route_rejected
document_status_changed
document_approval_requested
document_access_otp
password_reset
```

The UI may translate these into readable labels.

Security emails such as OTP and password reset may be audited, but their codes, tokens, links, and message contents must never be included.

## 15. Reason codes

Use controlled reason codes instead of raw exception messages wherever possible:

```text
notifications_paused
delivery_generation_expired
recipient_missing
recipient_inactive
recipient_locked
recipient_role_not_eligible
recipient_office_changed
recipient_email_missing
recipient_email_invalid
sender_not_configured
rate_limited
smtp_authentication_failed
smtp_connection_failed
smtp_rejected
retry_exhausted
unknown_failure
```

Raw exception messages must be sanitized before they are stored or displayed.

## 16. Audit integrity and privacy controls

- Email audit events are append-only.
- Never edit an older accepted or failed outcome to represent a retry.
- Use one delivery reference to group lifecycle events.
- Use server-generated timestamps.
- Use Philippine time only for presentation; preserve normal database timestamp handling.
- Do not expose the page data through a route available to non-Super Administrators.
- Do not include email-audit data in ordinary office Audit Trail responses.
- Do not log full recipient addresses when an audit operation itself fails.
- Apply the existing audit retention and backup policy to masked events.
- Treat recipient names, office assignments, IDs, and masked addresses as internal information even though the full address is not shown.

## 17. Implementation sequence

1. Add centralized recipient masking and sanitized reason-code helpers.
2. Define stable notification types and email audit action names.
3. Add a delivery-reference generator and audit-recording service.
4. Add the delivery-generation safeguard to the email setting.
5. Refactor queued email jobs to carry recipient user IDs instead of plaintext email addresses.
6. Add queued, accepted, skipped, retry, and failed audit events to every email path.
7. Restrict production test recipients to existing active users.
8. Add the Super Admin–only backend endpoint and authorization tests.
9. Add the **View Email Audit** button and read-only page.
10. Add filters, pagination, PHT presentation, and grouped delivery details.
11. Audit the `jobs`, `failed_jobs`, application logs, and frontend responses for plaintext addresses or sensitive values.
12. Run automated and controlled manual tests while delivery remains paused.
13. Deploy in paused mode and perform one Super Administrator self-test.

## 18. Test plan

### Authorization

- Super Administrator can open the Email Audit page.
- Admin Staff, Executives, Encoders, and unauthenticated users receive `403`.
- Direct API access is rejected even when the navigation link is hidden.

### Masking and privacy

- Full email address never appears in the Email Audit HTML or JSON response.
- Audit details contain only the masked address.
- `jobs.payload` and `failed_jobs.payload` do not contain the recipient's plaintext email after refactoring.
- OTPs, reset tokens, signed URLs, document bodies, and SMTP secrets never appear in audit details.
- Sanitized failures do not leak credentials or full addresses.

### Lifecycle

- Creating a valid notification records `queued` once per recipient.
- Starting a worker and completing SMTP records `accepted`.
- A transient failure records retry information without duplicating the delivery identity.
- Exhausted retries record one final `failed` event.
- One recipient failure does not change another recipient's outcome.

### Pause behavior

- Paused mode prevents new jobs from being created.
- A job already queued is skipped when handled while paused.
- A job queued before a pause remains skipped after a later re-enable because its generation expired.
- Skipped events display the correct reason.
- Running `php artisan queue:work` while paused sends no email.

### Recipient policy

- Inactive, locked, missing-email, and invalid-email users cannot be selected for a production test.
- Free-form production addresses are rejected.
- The confirmation screen shows the correct user, office, and masked address.
- Rate-limited requests are recorded as skipped and do not create jobs.

### Display and filtering

- Times display correctly in PHT.
- Filters work for office, recipient, tracking number, type, status, and date range.
- Pagination does not reveal unauthorized or raw details.
- Accepted is never displayed as Delivered.

## 19. Acceptance criteria

The feature is ready when:

- only Super Administrators can access Email Audit;
- every attempted recipient has a traceable delivery reference;
- the recipient user and office are visible without exposing the full email address;
- queued, accepted, skipped, retry, and failed outcomes are distinguishable;
- related tracking numbers are searchable;
- paused mode reliably prevents mail transmission;
- pre-pause jobs cannot send after re-enabling;
- production test recipients are restricted to approved DOTS users;
- queue and failed-job payloads no longer expose plaintext recipient addresses;
- security codes, tokens, bodies, credentials, and raw exceptions never appear in audit data;
- automated tests and one controlled Super Administrator self-test pass.

## 20. Relationship to the broader production email plan

This focused proposal complements:

- `docs/production-email-notification-testing-plan.md`

That document describes the broader Test/Live/Paused delivery model and permanent delivery-history option. This document narrows the first implementation to a Super Admin–only, masked Email Audit built around safe audit events and safer queue payloads.

If email volume or reporting needs later make audit-event aggregation too expensive, DOTS may introduce the proposed `email_notification_deliveries` table as a reporting projection while retaining the immutable audit events described here.
