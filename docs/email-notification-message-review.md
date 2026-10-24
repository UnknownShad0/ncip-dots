# Email Notification Message Review

**Status:** Implemented for document workflows; receipt verification PIN pending<br>
**Date:** October 24, 2026  
**Scope:** Implemented subject lines, message copy, content hierarchy, and visual treatment for DOTS document notifications, plus the administrative delivery-test email

## Required product name

Use this name consistently in every email:

> **Document Tracking System**

Do not use **Document Online Tracking System**.

The short name **DOTS** may still be used in subject lines, buttons, and supporting copy where space is limited.

## Recommended email identity

Every HTML email should use one shared layout:

1. NCIP logo
2. `Document Tracking System` as the product name
3. A small message-type label, such as `ACTION REQUIRED`, `STATUS UPDATE`, or `SECURITY CODE`
4. A direct title explaining what happened
5. A short, personalized message
6. A document-details card
7. One primary action button when an action is available
8. A short security or automated-message notice
9. A plain-text fallback containing the same essential information and full action URL

Recommended footer:

> This is an automated message from the NCIP Document Tracking System. Please do not reply to this email.

## Global delivery pause

The administrator's email-delivery control is a global kill switch. While paused, DOTS must block every outgoing email, including document workflow notifications, account and security messages, and manual test emails. Queued document notifications must be skipped rather than retained for later delivery.

The **Send test** button remains available while delivery is paused. Pressing it verifies the pause at the server: DOTS displays a notification confirming that the test was blocked, and no email leaves the system.

## Implementation status

The branded email system currently implements **10 document-workflow message variants** and **1 administrative delivery-test message**.

Implemented document messages:

1. Document waiting for approval
2. Submission approved
3. Changes requested for a submission
4. Submission rejected
5. Document registered — email job/template implemented; UI trigger still needs wiring
6. Routed document requires office review
7. Route approved by an office
8. Route changes requested by an office
9. Route rejected by an office
10. Document received

Also implemented:

- Administrative email delivery test, with branded HTML and plain-text content
- One shared NCIP/DOTS layout for all messages above
- Plain-text fallback with full action URLs
- Global pause enforcement for all Laravel email delivery

Not yet implemented:

- Receipt verification PIN from the QR/email OTP receiving plan

Account creation, email verification, and password-reset emails are intentionally outside this message-review document. They are still covered by the global delivery pause.

## Document message types at a glance

| No. | Message type | Recipient | Category | Primary action | Current status |
| --- | --- | --- | --- | --- | --- |
| 1 | Document waiting for approval | Approver | Action required | Review document | Implemented as branded HTML with text fallback |
| 2 | Submission approved | Document creator | Success | View submission | Implemented as branded HTML with text fallback |
| 3 | Changes requested | Document creator | Action required / warning | Review requested changes | Implemented as branded HTML with text fallback |
| 4 | Submission rejected | Document creator | Important status | View submission | Implemented as branded HTML with text fallback |
| 5 | Document registered | Document creator | Success | View document | Email job/template implemented; UI trigger not currently wired |
| 6 | Routed document requires review | Receiving office approver | Action required | Review document | Implemented as branded HTML with text fallback |
| 7 | Route decision update | Document creator | Status update | View document | Implemented as branded HTML with text fallback |
| 8 | Document received | Document creator | Receipt confirmation | Track document | Implemented as branded HTML with text fallback |
| 9 | Receipt verification PIN | Eligible receiver | Security / action required | Enter PIN on the open page | Proposed in the QR/email OTP plan |

The administrative email delivery test is implemented but listed separately because it is a system utility rather than a document-workflow notification.

The approval messages in items 1 and 6 belong to different workflows:

- Item 1 is for a document submitted from the document-creation approval queue.
- Item 6 is for an already registered document routed to an office for approval.

## Shared sample data

The examples below use the following fictional information:

| Field | Sample value |
| --- | --- |
| Recipient | Juan Dela Cruz |
| Submitter | Maria Santos |
| Document | Request for Authority to Travel |
| DOTS No. | CO-26-10-0042 |
| Version | 3 |
| Office | Office of the Executive Director |
| Approval flow | Sequential approval |

## 1. Document waiting for approval

**Category:** Action required  
**Suggested color:** Amber  
**Recipient:** Approver assigned to the selected office

**Subject**

> [DOTS] Approval needed: Request for Authority to Travel

**Preheader**

> Maria Santos submitted a document that is waiting for your review.

**Implemented message**

> **ACTION REQUIRED**
>
> # A document is waiting for your approval
>
> Hello Juan Dela Cruz,
>
> Maria Santos submitted a document that requires review and approval from your office.
>
> **Document:** Request for Authority to Travel  
> **Submitted by:** Maria Santos  
> **Version:** 3
>
> Please review the document and record your decision in the Document Tracking System.
>
> **[Review document]**
>
> For accountability and security, approval decisions must be completed while signed in to your DOTS account.

## 2. Submission approved

**Category:** Success  
**Suggested color:** Green  
**Recipient:** Document creator

**Subject**

> [DOTS] Approved: Request for Authority to Travel

**Preheader**

> Your document submission has been approved.

**Implemented message**

> **STATUS UPDATE**
>
> # Your document has been approved
>
> Hello Juan Dela Cruz,
>
> Your document submission has been reviewed and approved.
>
> **Document:** Request for Authority to Travel  
> **Status:** Approved  
> **Version:** 3
>
> No changes are currently required from you. You may open DOTS to view the latest status and available next steps.
>
> **[View submission]**

## 3. Changes requested

**Category:** Action required / warning  
**Suggested color:** Amber  
**Recipient:** Document creator

**Subject**

> [DOTS] Changes requested: Request for Authority to Travel

**Preheader**

> Review the remarks and submit a revised version.

**Implemented message**

> **ACTION REQUIRED**
>
> # Changes were requested for your document
>
> Hello Juan Dela Cruz,
>
> The reviewer requested changes before your document can proceed.
>
> **Document:** Request for Authority to Travel  
> **Status:** Changes requested  
> **Version reviewed:** 3
>
> **Reviewer remarks**  
> Please correct the travel dates and attach the approved itinerary.
>
> Review the remarks, update the document, and submit a new version in DOTS.
>
> **[Review requested changes]**

If no remarks were entered, omit the reviewer-remarks block instead of displaying an empty value.

## 4. Submission rejected

**Category:** Important status  
**Suggested color:** Red  
**Recipient:** Document creator

**Subject**

> [DOTS] Rejected: Request for Authority to Travel

**Preheader**

> Your document submission was not approved.

**Implemented message**

> **STATUS UPDATE**
>
> # Your document submission was rejected
>
> Hello Juan Dela Cruz,
>
> Your document submission was reviewed and was not approved.
>
> **Document:** Request for Authority to Travel  
> **Status:** Rejected  
> **Version reviewed:** 3
>
> **Reviewer remarks**  
> The request is outside the approved travel period.
>
> Open DOTS to review the decision and the available next steps.
>
> **[View submission]**

Use factual wording. Avoid emotionally loaded copy such as “Unfortunately” or language that implies a decision can be changed outside the approved workflow.

## 5. Document registered

**Category:** Success  
**Suggested color:** Green  
**Recipient:** Document creator<br>
**Status:** Email job/template implemented; UI trigger not currently wired

**Subject**

> [DOTS] Document registered: CO-26-10-0042

**Preheader**

> Your approved document has been registered in DOTS.

**Implemented message**

> **REGISTRATION COMPLETE**
>
> # Your document has been registered
>
> Hello Juan Dela Cruz,
>
> Your approved document is now registered in the Document Tracking System.
>
> **Document:** Request for Authority to Travel  
> **DOTS No.:** CO-26-10-0042  
> **Version:** 3  
> **Status:** Registered
>
> Keep the DOTS No. for future reference. You can use it to monitor the document's routing progress.
>
> **[View document]**

## 6. Routed document requires office review

**Category:** Action required  
**Suggested color:** Amber  
**Recipient:** Eligible approver in the receiving office

**Subject**

> [DOTS] Office review needed: CO-26-10-0042

**Preheader**

> A routed document is ready for review by the Office of the Executive Director.

**Implemented message**

> **ACTION REQUIRED**
>
> # Your office has a document to review
>
> Hello Juan Dela Cruz,
>
> A routed document is ready for review and approval by your office.
>
> **Document:** Request for Authority to Travel  
> **DOTS No.:** CO-26-10-0042  
> **Assigned office:** Office of the Executive Director  
> **Approval flow:** Sequential approval
>
> Sign in to DOTS to review the document and record an authorized decision.
>
> **[Review document]**

## 7. Route decision updates

These messages share one template but change their heading, color, explanation, and remarks according to the route event.

### 7A. An office approved the document

**Category:** Status update / success  
**Suggested color:** Green

**Subject**

> [DOTS] Route approved by Office of the Executive Director: CO-26-10-0042

**Implemented message**

> **ROUTE UPDATE**
>
> # An office approved your document
>
> Hello Juan Dela Cruz,
>
> The Office of the Executive Director approved the routed document.
>
> **Document:** Request for Authority to Travel  
> **DOTS No.:** CO-26-10-0042  
> **Office:** Office of the Executive Director  
> **Approval flow:** Sequential approval
>
> The document will proceed according to its configured route.
>
> **[View route status]**

### 7B. An office requested changes

**Category:** Action required / warning  
**Suggested color:** Amber

**Subject**

> [DOTS] Route changes requested: CO-26-10-0042

**Implemented message**

> **ACTION REQUIRED**
>
> # An office requested changes to your document
>
> Hello Juan Dela Cruz,
>
> The Office of the Executive Director requested changes to the routed document.
>
> **Document:** Request for Authority to Travel  
> **DOTS No.:** CO-26-10-0042  
> **Office:** Office of the Executive Director  
> **Approval flow:** Sequential approval
>
> **Reviewer remarks**  
> Please attach the approved itinerary before routing the document again.
>
> Open DOTS to review the request and prepare the next version.
>
> **[Review requested changes]**

### 7C. An office rejected the document

**Category:** Important status  
**Suggested color:** Red

**Subject**

> [DOTS] Route rejected by Office of the Executive Director: CO-26-10-0042

**Implemented message**

> **ROUTE UPDATE**
>
> # An office rejected your document
>
> Hello Juan Dela Cruz,
>
> The Office of the Executive Director rejected the routed document.
>
> **Document:** Request for Authority to Travel  
> **DOTS No.:** CO-26-10-0042  
> **Office:** Office of the Executive Director  
> **Approval flow:** Sequential approval
>
> **Reviewer remarks**  
> The request does not meet the current routing requirements.
>
> Open DOTS to review the recorded decision.
>
> **[View route status]**

## 8. Document received

**Category:** Receipt confirmation  
**Suggested color:** Blue or green  
**Recipient:** Document creator

**Subject**

> [DOTS] Document received by Office of the Executive Director: CO-26-10-0042

**Preheader**

> Receipt of your document was recorded by the Office of the Executive Director.

**Implemented message**

> **RECEIPT CONFIRMATION**
>
> # Your document was received
>
> Hello Juan Dela Cruz,
>
> Receipt of your document was recorded in the Document Tracking System.
>
> **Document:** Request for Authority to Travel  
> **DOTS No.:** CO-26-10-0042  
> **Received by office:** Office of the Executive Director
>
> You can open DOTS to view the latest route and receipt history.
>
> **[Track document]**

The creator-facing email should normally identify the receiving office, not expose the receiving employee's email address or other unnecessary personal information.

## 9. Receipt verification PIN

**Category:** Security / action required  
**Suggested color:** Blue with an amber security notice  
**Recipient:** Eligible employee receiving through the signed public tracking page  
**Status:** Proposed; not yet implemented

**Subject**

> [DOTS] Your document receipt verification PIN

Do not put the PIN in the subject or preheader because lock-screen notifications may expose them.

**Preheader**

> Use this PIN to confirm receipt of document CO-26-10-0042. It expires in 10 minutes.

**Proposed message**

> **SECURITY CODE**
>
> # Confirm document receipt
>
> Hello Juan Dela Cruz,
>
> Enter the following verification PIN on the Document Tracking System page that you already opened:
>
> ## 482 731
>
> This PIN expires in **10 minutes**.
>
> **DOTS No.:** CO-26-10-0042  
> **Document:** Request for Authority to Travel  
> **Receiving office:** Office of the Executive Director
>
> Entering this PIN confirms that you received the physical document for the office shown above. The receipt will be recorded under your verified employee identity.
>
> **Do not share this PIN.** DOTS personnel will never ask you to send it by email, text message, or chat.
>
> If you did not request this PIN, you may ignore this message. No receipt will be recorded unless the correct PIN is entered and the document is still waiting for your office.

Do not add a clickable “verify” link containing the PIN. The user should enter the PIN only on the signed tracking page that initiated the request.

## Administrative email delivery test

**Category:** System test<br>
**Suggested color:** Blue<br>
**Recipient:** Administrator-provided test address<br>
**Status:** Implemented as branded HTML with plain-text fallback

This is a supporting administrative message and is not part of the numbered document workflow.

**Subject**

> [DOTS] Email delivery test successful

**Preheader**

> DOTS successfully sent this email delivery test.

**Implemented message**

> **SYSTEM TEST**
>
> # Email delivery is working
>
> Hello Juan Dela Cruz,
>
> This test message was sent by the Document Tracking System.
>
> **Delivery status:** Successful<br>
> **From address:** dots@example.gov.ph
>
> If you can read this message, the configured SMTP service is delivering DOTS emails with both HTML and plain-text content.
>
> No action is required. This message was generated from the Email notifications administration page.

When delivery is paused, the administrator may still press **Send test**, but DOTS blocks the message before sending and shows a toast confirming that no email was sent.

## Visual treatment by category

| Category | Label examples | Recommended accent | Icon concept |
| --- | --- | --- | --- |
| Action required | `ACTION REQUIRED` | Amber | Clipboard or alert circle |
| Success | `APPROVED`, `REGISTRATION COMPLETE` | Green | Check circle |
| Important status | `REJECTED`, `ROUTE UPDATE` | Red | Information or status circle, not an alarming error symbol |
| Receipt confirmation | `RECEIPT CONFIRMATION` | Blue-green | Inbox or check |
| Security | `SECURITY CODE` | Blue with amber notice | Shield or key |
| System test | `SYSTEM TEST` | Blue | Mail check |

Icons should be optional visual aids. The meaning must still be clear when Gmail blocks images.

## Content and privacy rules

- Use **Document Tracking System** as the full product name.
- Use one clear call-to-action button at most.
- Include the full destination URL in the plain-text fallback.
- Do not attach document files to routine notifications.
- Do not include confidential document body content.
- Show remarks only to the intended authorized recipient.
- Do not expose OTPs in subject lines, preheaders, URLs, logs, or analytics.
- Do not expose a receiving employee's full email address in creator-facing receipt notifications.
- Escape all dynamic values, including names, titles, office names, and remarks.
- Dates shown to users should use the application timezone and an unambiguous format.
- Buttons must describe their action: `Review document` or `Track document`; avoid generic labels such as `Click here`.
- Every important state must be understandable without relying only on color or images.

## Implementation

The implemented document workflow and administrative test messages use one shared HTML template and one plain-text fallback:

```text
resources/views/emails/
├── document-notification.blade.php
└── document-notification-text.blade.php
```

The queue jobs provide controlled variants for document subject lines, headings, explanatory copy, button labels, details, and accent colors. The email-integration controller provides the administrative test variant. Dynamic values are escaped by the Blade template. The receipt verification PIN will reuse the same visual system when the OTP workflow is implemented.

## Review decisions needed

Before extending the design to the OTP workflow, confirm the following:

1. Whether all user-facing email copy should remain in English or support Filipino as an optional language.
2. Whether the header should show only the NCIP logo or another officially approved government branding asset as well.
3. Whether document titles may always appear in email or must use a privacy-safe label for selected document classifications.
4. Whether route-decision emails should display the decision-maker's name or only the deciding office.
5. The official mailbox or support contact, if any, that should appear in the footer.

