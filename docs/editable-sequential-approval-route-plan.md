# Editable Approval Route Plan

**Status:** Implemented  
**Scope:** Editing the unfinished portion of active sequential and parallel approval routes  
**Implementation status:** Completed and covered by feature tests

## Implementation update

The first-release scope in this document is now implemented. The application preserves dispatched history through document trails and stores the route-change reason plus complete before/after step snapshots in the audit trail. Waiting sequential steps are rebuilt as the active sequence changes; unchanged `available` steps keep their existing step and dispatch links.

Parallel routes are also editable while pending. New offices become `available` immediately, unreceived offices may be removed, and ordering controls are omitted because parallel offices act independently.

The ordinary editor continues to lock `approved`, `in_progress`, and `waiting_on_branch` steps. A separate skip/replace flow for an already received office remains out of scope.

## Goal

Allow an authorized sender to correct or reorganize the unfinished offices in an active sequential route without changing completed approvals, silently removing acknowledged work, or losing the routing audit history.

This feature is intended for cases where a future office is no longer appropriate, an office is expected to cause a delay, or the remaining approval order needs to change after the document has already been routed.

## Terminology decision

Use these user-facing terms throughout the Forward modal, route map, printed disposition form, notifications, and help text:

| Current label | Proposed label | Meaning |
| --- | --- | --- |
| Routing type | **Approval flow** | How the selected offices receive and act on the document |
| Step by step | **Sequential approval** | Each office acts only after the previous office approves |
| At the same time | **Parallel approval** | All selected offices can act independently at the same time |

`Sequential` and `parallel` are the correct technical terms. The internal values should remain `sequential` and `parallel`; only the user-facing labels need to change. This avoids an unnecessary database and API migration.

Suggested helper text:

- **Sequential approval:** Offices review in the specified order. The next office receives the document only after the current office approves.
- **Parallel approval:** All selected offices receive the document immediately and can review independently.

## Recommended editing rules

An unfinished step is not automatically safe to edit. Editability depends on whether the office has already received or acted on the document.

| Step status | Editable? | Rule |
| --- | --- | --- |
| `approved` | No | Completed approval is permanent route history. |
| `in_progress` | No | The office has received the document and may already be reviewing it. |
| `waiting_on_branch` | No | The office and its active child route must finish or be handled through a separate correction flow. |
| `available` | Limited | It may be replaced or removed only before receipt, with confirmation and a required reason. |
| `waiting` | Yes | It may be added, removed, replaced, or reordered. |
| `changes_requested` | No | The route is paused for document correction. |
| `rejected` | No | The route has stopped. |
| `paused` | No | Resume or correction rules must be resolved before editing. |

### Recommended first release

The first release should support:

- Reordering future `waiting` offices.
- Adding new future offices.
- Replacing or removing future `waiting` offices.
- Replacing or removing the current `available` office only when it has not clicked **Receive**.
- Keeping `approved`, `in_progress`, and `waiting_on_branch` steps locked.
- Adding offices to an active parallel route and activating them immediately.
- Removing only unreceived `available` offices from a parallel route.
- Treating parallel office order as non-editable and operationally irrelevant.

Changing an `in_progress` step should not be part of ordinary route editing. If this is needed later, provide a separate **Skip or replace current office** action with stronger authorization, explicit confirmation, a required reason, and its own audit event.

## Authorization

An active sequential or parallel route may be edited only when all of these conditions are true:

- The route mode is `sequential` or `parallel`.
- The route status is `pending`.
- The document is not archived and has not reached a terminal approval state.
- The user is still active.
- The user's current office is the route's `from_office_id`.
- The user is the route creator or has an explicit administrative route-correction permission.

A child route follows the same rules. Its creator or originating office may edit only that child route, not its parent or sibling routes.

The exact administrative permission can be introduced separately if the current role system does not already provide a suitable capability.

## User interface plan

### Entry point

Add an **Edit remaining route** action to the document details/review modal when the user is authorized and the active route is sequential or parallel.

Do not show the action for completed routes, archived documents, or users without permission.

### Edit modal

The modal should contain two clear sections:

1. **Completed and active offices**
   - Read-only.
   - Show step number, office, status, receipt date, and approval date when applicable.
   - Explain why each step is locked.

2. **Remaining offices**
   - Searchable office selection.
   - Drag-and-drop ordering with move-up and move-down button alternatives.
   - Add, replace, and remove controls.
   - Updated step numbers shown immediately.
   - Offices already present in the active route, the sending office, ancestor offices, inactive offices, and offices without an active approver must be unavailable.

The modal must also include:

- A required **Reason for route change** field.
- A before-and-after route summary.
- A warning when the unreceived `available` office will be replaced or removed.
- **Cancel** and **Save route changes** actions.

### Save result

After a successful save:

- Close the edit modal.
- Refresh the document details and route map.
- Show a success message.
- If the active unreceived office changed, clearly show which new office now has the document available for receipt.

## Backend plan

### Endpoint

Add a dedicated update endpoint instead of reusing the initial release endpoint. For example:

```text
PUT /documents/{document}/routes/{route}/remaining-steps
```

Suggested request data:

```json
{
  "office_ids": [12, 8, 21],
  "reason": "Reordered the remaining approvals because Office X is unavailable."
}
```

The ordered `office_ids` list represents the complete editable remainder after saving, not only the individual changes.

### Transaction and concurrency

Process the update in a database transaction and lock the document, route, and route steps before validation. Recheck every step status after acquiring the locks.

If an office receives or approves the document while another user has the edit modal open, reject the stale save and ask the user to reload the latest route. Do not silently overwrite the newer state.

### Validation

Server-side validation must enforce:

- Sequential and pending route only.
- Authorized route owner or administrator only.
- A non-empty reason with a sensible maximum length.
- Maximum of 30 active offices in the route.
- Distinct office IDs.
- Office range restrictions already used by the Forward action.
- At least one active approver in each added office.
- No sending office, ancestor office, or duplicate active office.
- No modification to approved, received, branch-waiting, rejected, changes-requested, or paused steps.
- The submitted locked prefix exactly matches the current locked route state.

### Preserving history

Never rewrite an approved decision or its approver, remarks, timestamps, or trail links.

For every saved edit:

- Record a `document.route_updated` audit event.
- Store the route ID, actor, reason, and before/after ordered office lists.
- Preserve the original dispatch trail of an `available` office.
- Add a new document trail entry explaining that the unreceived step was cancelled or replaced.
- Mark a dispatched step as cancelled/superseded rather than erasing it.
- Waiting steps that have never been dispatched may be rebuilt, but their before/after state must remain in the audit event.

The implementation may require cancellation metadata on route steps, such as `cancelled_by`, `cancelled_at`, and `cancellation_reason`, or a small route-revision table. The final schema choice should preserve history without making cancelled steps part of the active route.

### Updating the active office

If only future `waiting` steps change, the current `available` or `in_progress` step remains unchanged.

If the current `available` step is replaced or removed before receipt:

1. Record its cancellation/replacement history.
2. Make the first remaining valid office `available`.
3. Create a new dispatch trail for that office.
4. Notify the new office.
5. Notify the removed office that the pending assignment was withdrawn, if route notifications are enabled.

An `in_progress` step must never be changed through this endpoint.

### Sequential advancement

The current approval code looks specifically for `current position + 1`. Route editing can create gaps unless every position is normalized correctly.

The implementation should do both of the following:

- Renumber all active remaining steps to contiguous positions inside the transaction.
- Change approval advancement to select the first active `waiting` step whose position is greater than the approved step, rather than depending only on an exact `+1` match.

This prevents a route from becoming stuck after a removal, replacement, or historical cancellation.

### Route completion edge cases

- A route must retain at least one active step overall.
- Removing every future step is allowed only when an approved or currently active step remains.
- If the last required active step is already approved and no future step remains, complete the route using the existing route-completion rules.
- A child route completion must still return its parent step to `in_progress`.
- Editing a child route must not change the parent route's office order.

## Notification plan

- Notify newly added or newly activated offices only when their step becomes `available`.
- Do not notify future `waiting` offices as if the document is already assigned to them.
- Optionally notify removed offices if they previously received an availability notification.
- Do not resend notifications to unchanged offices.
- Include the tracking number, action required, originating office, and a concise explanation that the route was updated.

## Route map and disposition form

The main route map should display only active route steps in the current sequence while keeping cancelled or replaced steps available in audit/history details.

The disposition form should:

- Preserve the original routing and cancellation events chronologically.
- Show the current remaining route separately from completed history.
- Label a withdrawn unreceived assignment as **Cancelled before receipt** or **Replaced before receipt**.
- Never make it appear that a cancelled office approved or received the document.

Public tracking should not expose the internal reason if it may contain operational or personal details. It may show a neutral event such as **Approval route updated**.

## Test plan

### Authorization and state

- Route creator from the originating office can edit a pending sequential route.
- Unrelated users and offices cannot edit it.
- A permitted administrator can edit it when the dedicated permission exists.
- Completed, paused, rejected, changes-requested, and archived routes cannot be edited.

### Locked steps

- Approved steps cannot be removed, replaced, or reordered.
- An `in_progress` step cannot be changed.
- A `waiting_on_branch` step and its parent relationship cannot be changed.
- A stale request fails if a step was received or approved after the modal loaded.

### Editable steps

- Waiting offices can be added, removed, replaced, and reordered.
- An unreceived `available` office can be replaced or removed.
- Parallel offices can be added immediately or removed before receipt, but cannot be reordered.
- Office IDs remain distinct and within the permitted office range.
- Offices without active approvers are rejected.
- Ancestor and sending offices are rejected.

### Workflow continuation

- Approval activates the correct next remaining office after a reorder.
- Removing a future office does not leave a position gap that stops advancement.
- Replacing the available office creates the correct dispatch trail and notification.
- Completing an edited root route still approves the document correctly.
- Completing an edited child route still resumes its parent step correctly.

### Audit and display

- Each edit records the actor, reason, and before/after route.
- Cancelled assignments remain traceable but are not treated as active approvals.
- Staff route map, public tracking, and disposition form show consistent route state.

## Acceptance criteria

The feature is ready when:

- An authorized sender can safely edit the future portion of a pending sequential route.
- Completed and received steps cannot be altered through ordinary edit mode.
- An unreceived active assignment can be withdrawn or replaced with a recorded reason.
- The next office activates correctly after every supported edit.
- No approval, receipt, dispatch, or audit history is lost.
- Concurrent receipt or approval cannot be overwritten by a stale route edit.
- User-facing terminology consistently uses **Approval flow**, **Sequential approval**, and **Parallel approval**.

## Out of scope for the first release

- Silently removing or replacing an office that already clicked **Receive**.
- Reversing an approved decision.
- Editing a route after rejection or a request for changes.
- Automatically skipping an office after a time limit.
- Escalation reminders or approval deadlines.

## Recommended implementation order

1. Apply the user-facing terminology update.
2. Add the route-edit authorization and endpoint.
3. Add audit/revision and cancellation support.
4. Implement transactional editing of waiting steps.
5. Implement replacement of an unreceived available step.
6. Add the edit modal and route refresh behavior.
7. Update route map, disposition output, notifications, and public tracking.
8. Add feature tests, then exercise the workflow manually with test offices.

