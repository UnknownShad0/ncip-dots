# Early Activation of the Next Sequential Office

**Status:** Proposal for review  
**Working action name:** **Allow next office to proceed**  
**Scope:** Active sequential approval routes only  
**Production behavior changed by this document:** None

## 1. Executive summary

This proposal addresses sequential routes that become delayed because the current office is still processing the document or waiting for a forwarded child route.

Instead of pausing, cancelling, replacing, or moving the current office, an authorized sender may activate the immediate next waiting office early.

The current office and all of its child routes continue unchanged. The next office may receive and process the document at the same time. Offices after that next office remain waiting until every earlier required step is approved.

Example:

```text
Normal sequential route

A approved -> B in progress -> C waiting -> E waiting
              |
              +-> D child route in progress
```

After using **Allow next office to proceed**:

```text
A approved
|
+-> B continues in progress
|   |
|   +-> D child route continues unchanged
|
+-> C becomes available and may proceed

E remains waiting.
```

This is not a pause and not a true position swap. It is a controlled exception that temporarily allows two adjacent parts of a sequential route to operate concurrently.

## 2. Problem being solved

The existing sequential route correctly activates one office at a time. This protects routing order and accountability, but it can delay the entire process when:

- the current office has a long review;
- the current office forwarded the document through a child route;
- the next office can perform an independent review without waiting;
- operational deadlines justify allowing the next office to start early.

The current route editor is not the correct place to solve this problem. It intentionally locks received, active, approved, and branch-active steps. Unlocking those steps would allow historical receipt and accountability records to be rewritten.

The proposed action leaves the current step untouched and activates only the immediate next waiting step.

## 3. Core decision

The proposed behavior is:

1. Do not pause Office B.
2. Do not cancel or replace Office B.
3. Do not change the position of Office B or Office C.
4. Do not edit, pause, or transfer any child route belonging to Office B.
5. Change Office C from `waiting` to `available`.
6. Allow Office B and Office C to process concurrently.
7. Keep every office after C in `waiting`.
8. Advance beyond C only after all earlier required steps are approved.

The route keeps its original order for history and reporting:

```text
Position 1: A - approved
Position 2: B - in progress or waiting on branch
Position 3: C - activated early
Position 4: E - waiting
```

The route map should show that C was activated early instead of pretending that C originally came before B.

## 4. Child-route behavior

A child route remains attached to the exact parent route step that created it.

```text
A -> B -> C
     |
     +-> D -> F
```

Activating C early produces:

```text
A approved
|
+-> B continues
|   |
|   +-> D -> F continues as B's child route
|
+-> C proceeds early
```

The following rules apply:

- D and F remain children of B.
- C does not inherit or control B's child route.
- B's child route is not paused.
- Completion of B's child route returns B to its normal `in_progress` state.
- B must still make its own decision after its child route completes.
- The main route cannot advance beyond C until both B and C are approved.

If C later creates its own child route, that child route belongs only to C and follows the same existing branch rules.

## 5. Eligibility rules

Show **Allow next office to proceed** only when all of the following are true:

- The route mode is `sequential`.
- The route status is `pending`.
- The document is not archived or in a terminal state.
- The current blocking step is `in_progress` or `waiting_on_branch`.
- The immediate next step by position is `waiting`.
- No later step on the same route has already been activated early.
- The next office still has at least one active approver.
- The user is active and authorized for the route's sending office.
- The submitted route revision still matches the current route state.

Do not show the action when:

- the current step is only `available` and has not been received;
- the next office is already `available`, `in_progress`, `waiting_on_branch`, or approved;
- the route is parallel, because all parallel steps are already activated independently;
- the document has changes requested, was rejected, is approved, terminal, archived, or requires legacy review;
- another early-activated next step is still unresolved.

If an `available` office has not received the document, the existing **Edit remaining route** flow remains the correct tool for replacement or removal.

## 6. Authorization

Recommended authorization should match the existing route-edit ownership rules:

- the user's current office must equal the route's `from_office_id`; and
- the user must be the route creator or an administrator authorized for that sending office.

A super-administrator override may be added if operational policy requires it. If enabled, the audit record must clearly identify that the action was an administrative override.

The receiving offices B and C should not activate this exception themselves unless they are also authorized representatives of the sending office.

## 7. User interface proposal

### Entry point

Place **Allow next office to proceed** in the document details or active route actions. Keep it separate from **Edit remaining route**.

Suggested helper text:

> Let the immediate next office begin without pausing or changing the current office and its forwarded routes.

### Confirmation dialog

Suggested title:

> Allow Office C to proceed?

Suggested message:

> Office B will remain active and continue its current work and forwarded routes. Office C will also receive access now. Later offices will remain waiting until both offices complete their required approvals.

Required input:

- **Reason for early activation**, maximum 1,000 characters.

Suggested confirmation button:

- **Allow Office C to proceed**

### Route-map display

The route map should preserve the original positions and show:

- B: **In progress** or **Waiting for child route**
- C: **Available - activated early**
- E: **Waiting**

Do not visually reorder C ahead of B. The badge communicates the exception without rewriting route history.

### After receipt

Once C receives the document, display:

- C: **In progress - activated early**

The early-activation label should remain visible after approval in staff history and audit details.

## 8. Proposed persistence

The existing `available` status can represent C's active assignment. Additional metadata should record why it became available before the earlier step completed.

Recommended fields on `document_route_steps`:

```text
activated_early_at          nullable timestamp
activated_early_by          nullable user ID
early_activation_reason     nullable text
early_activation_trail_id   nullable document trail ID
```

Benefits:

- no new workflow status is required;
- existing receive and approval actions can continue using `available` and `in_progress`;
- the UI can reliably display **Activated early**;
- reports can distinguish normal sequential dispatch from early activation;
- the reason and actor remain available even if audit retention changes later.

The child route schema does not need to change. It already links a child route to its exact parent step through `parent_step_id`.

## 9. Backend workflow

Suggested endpoint:

```text
POST /documents/{document}/routes/{route}/activate-next-step
```

Suggested request:

```json
{
  "reason": "Office B requires an extended legal review, while Office C can begin its independent review.",
  "revision": "current-route-revision-token"
}
```

Process the action inside one database transaction:

1. Lock the document, route, and route steps.
2. Recheck document, route, user, and office authorization.
3. Reject a stale revision token.
4. Identify the earliest unresolved active step.
5. Confirm it is `in_progress` or `waiting_on_branch`.
6. Select the immediate next step by position.
7. Confirm the next step is `waiting` and no other early activation is active.
8. Create an `available` document trail for the next office.
9. Update the next step to `available` and store early-activation metadata.
10. Record the audit event.
11. Commit the transaction.
12. Notify the next office after the transaction succeeds.

Do not update the current step, its child routes, their trail records, or their status.

## 10. Sequential advancement barrier

The existing sequential approval logic normally activates the next waiting position after an office approves. Early activation requires a stricter barrier so a later office cannot be activated too soon.

Example:

```text
A approved
B in progress
C available early
E waiting
```

Required behavior:

- If B approves first, E remains waiting because C is not approved.
- If C approves first, E remains waiting because B is not approved.
- When both B and C are approved, E becomes available.

Recommended advancement rule:

> Activate the first waiting step only when every step with a lower position is approved.

This rule should apply regardless of which active office finishes first.

Route completion remains unchanged in principle: a route completes only when every required step is approved.

## 11. Receiving, access, and custody

Early activation means a sequential route temporarily has multiple active offices. Any code that assumes a sequential route has only one holder must be reviewed.

The safe access rule is:

- B may act only through B's active step or child branch.
- C may act only through C's early-activated step.
- B cannot act for C, and C cannot act for B.
- Public tracking may show concurrent processing without exposing the internal reason.

For physical documents, this action grants workflow access but does not claim that physical custody moved from B to C. Suggested UI wording should use **processing access** or **allowed to proceed**, not **physical document transferred**.

## 12. Decisions and negative outcomes

### Approval

Approval from one active office does not activate a later waiting office until all lower-position requirements are approved.

### Changes requested or rejection

Recommended first-release behavior should retain the existing global stop behavior:

- if B or C requests changes, pause the other active steps and return the document through the existing changes-requested workflow;
- if B or C rejects, stop the route using the existing rejection behavior.

The audit trail should identify which concurrently active office made the decision.

### Child-route completion

When B's child route completes:

- return B to `in_progress` as today;
- do not change C;
- require B's own decision;
- do not activate E until both B and C are approved.

## 13. Notifications

Send a normal action-required notification to C only after C becomes `available`.

The notification should explain:

- the tracking number;
- that C was allowed to proceed early;
- that the earlier office remains active;
- what action C must take.

Optionally notify B that the next office was activated early. This message must clarify that B's responsibility and child routes remain active.

Do not resend notifications to unchanged offices or B's child-route offices.

## 14. Audit requirements

Recommended audit action:

```text
document.route_next_step_activated_early
```

Record at least:

```text
document ID and tracking number
route ID
actor ID and office
current active step ID and office
early-activated step ID and office
reason
route revision before the action
document trail ID
timestamp
```

The original receipt, forwarding, decision, and child-route history must remain untouched.

## 15. Safeguards

- Require an explicit confirmation dialog.
- Require a non-empty reason.
- Use the existing 64-character route revision token to reject stale submissions.
- Lock the route steps during activation.
- Permit only the immediate next waiting step.
- Permit only one unresolved early activation per sequential route in the first release.
- Do not alter route positions.
- Do not pause, cancel, or update the current office or child routes.
- Do not activate later offices automatically when only one of the concurrent offices approves.
- Log and notify only after the transaction succeeds.

## 16. Test plan

### Authorization

- The route creator from the sending office can activate the next step.
- An authorized sending-office administrator can activate the next step.
- Unrelated offices and inactive users receive `403`.
- Completed, archived, rejected, and changes-requested documents cannot use the action.

### Eligible route state

- An `in_progress` B allows waiting C to be activated.
- A `waiting_on_branch` B allows waiting C to be activated without changing B's child route.
- An unreceived `available` B does not qualify; the route editor remains the appropriate tool.
- A parallel route does not qualify.
- A route with no immediate waiting step does not qualify.
- A second unresolved early activation is rejected.

### Preserving B and its child route

- B's status, receiver, receipt timestamp, and decision fields remain unchanged.
- B's child route IDs, steps, statuses, and positions remain unchanged.
- C becomes `available` and receives early-activation metadata.
- Only C receives the new availability notification.

### Advancement barrier

- B approves first while C is active: E remains waiting.
- C approves first while B is active: E remains waiting.
- B and C both approve: E becomes available exactly once.
- B's child route completes while C is active: B returns to `in_progress`, C remains unchanged, and E remains waiting.
- Every required step approved: the route and document complete normally.

### Negative decisions

- B requests changes while C is active: C is paused using existing behavior.
- C requests changes while B is active: B and its pending branch state follow the existing global stop behavior.
- Rejection from either active office stops the route once and preserves both histories.

### Concurrency

- C receives while the activation dialog is open: stale activation fails safely.
- B finishes while the activation request is saving: the transaction re-evaluates the route and avoids duplicate advancement.
- Two administrators submit early activation simultaneously: only one succeeds.

### Audit and display

- The reason, actor, B, C, and route ID appear in the audit record.
- The staff route map labels C as activated early.
- Public tracking uses neutral concurrent-processing wording.
- The disposition history preserves chronological events without changing the original route order.

## 17. Acceptance criteria

The feature is ready when:

- B and its child routes continue without interruption.
- Only immediate next office C is activated early.
- C can receive and decide through its own route step.
- Later office E remains waiting until B and C are both approved.
- Original route positions and historical timestamps do not change.
- Changes requested and rejection continue to stop the workflow safely.
- Every activation is authorized, revision-protected, reasoned, audited, and notified.
- The route map clearly distinguishes normal activation from early activation.

## 18. Out of scope

- Pausing B or any child route.
- Moving C's stored position ahead of B.
- Cancelling or replacing an office that already received the document.
- Activating multiple later offices at once.
- Automatically activating C after a fixed delay.
- Changing a sequential route permanently into a parallel route.
- Transferring child routes between parent offices.
- Reversing completed decisions.

## 19. Recommended implementation order

1. Confirm the authorization policy and UI wording.
2. Add early-activation metadata to route steps.
3. Add the transactional backend endpoint and policy checks.
4. Update sequential advancement to enforce the lower-position approval barrier.
5. Verify receiving, approval, changes-requested, rejection, and child-route behavior with concurrent active steps.
6. Add the confirmation dialog and route-map badge.
7. Add audit details and notifications.
8. Add feature tests for both completion orders and concurrency races.
9. Manually test root and child routes using separate office accounts.

## 20. Items for review

Please confirm these decisions before implementation:

1. Should only the original route creator and sending-office administrators see the action?
2. Should the system notify B when C is activated early?
3. Is one unresolved early activation per route sufficient for the first release?
4. Should public tracking show **Processing concurrently at multiple offices**, or keep the route exception private?
5. Should the reason be visible only in the audit trail, or also in internal document history?

## Related document

The existing normal route-editing rules remain documented in:

- `docs/editable-sequential-approval-route-plan.md`

That feature continues to edit only `available` and `waiting` steps. This proposal adds a separate controlled action and does not weaken the existing route editor's locked-step protections.
