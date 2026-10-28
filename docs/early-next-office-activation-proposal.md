# Locked In-Progress Sequential Route Editing

**Status:** Early activation withdrawn; locked behavior restored 2026-10-28

**Entry point:** Document details -> **Edit route**

## Purpose

Keep received and active offices fixed while still allowing an authorized sender to update future, unreceived offices in a sequential approval route.

An office that is `in_progress` or `waiting_on_branch` has already received the document or started a child route. Its route step, position, signature requirement, receipt history, and child route are locked. Editing future offices must not activate another office while that active work continues.

## Simple flow

```text
Before: A approved -> B in progress -> C waiting -> D waiting

Edit route: move D before C

After:  A approved -> B in progress -> D waiting -> C waiting

After B approves: D available -> C waiting
```

The sender may reorder the future waiting steps, but B remains fixed and no second office becomes available while B is active.

## Rules

- The route creator or an authorized administrator from the sending office can edit a pending route.
- `approved`, `in_progress`, and `waiting_on_branch` steps are locked.
- Locked steps cannot be moved, removed, replaced, or have their signature requirement changed.
- `available` and `waiting` steps are unreceived and remain editable.
- Future waiting offices may be added, removed, replaced, or reordered.
- Reordering future offices does not activate one while an earlier office is `in_progress` or `waiting_on_branch`.
- The first waiting office becomes `available` only when every earlier office has approved.
- Replacing an unreceived `available` office cancels its pending assignment and activates the replacement only when no earlier office is still active.
- Existing receipt, decision, signature, document trail, and child-route history must remain unchanged.
- A required reason and matching route revision token are still required for every route update.
- Parallel route behavior is unchanged.

## Existing routes with concurrent active offices

Routes that already gained multiple active offices under the earlier implementation are not rewritten automatically. Their existing offices may finish normally, but the route editor cannot move those active steps or activate another waiting office. Normal sequential advancement resumes after every earlier active step has approved.

## Manual test: reorder future offices while one office is active

1. Create a sequential route with offices A, B, C, and D.
2. Approve A and receive the document at B so B is `in_progress`.
3. Open **Edit route** as the route creator or an authorized sending-office administrator.
4. Confirm A and B appear in the locked section.
5. Move D before C, enter a reason, and save.
6. Confirm the order is A, B, D, C.
7. Confirm B remains `in_progress` with the same position, receiver, receipt time, signature settings, and child route.
8. Confirm D and C both remain `waiting` and neither receives an action-required email.
9. Approve B and confirm D becomes `available` and receives the normal notification.

## Manual test: replace an unreceived available office

1. Open a sequential route whose current office is `available` but has not received the document.
2. Replace that office through **Edit route** and save with a reason.
3. Confirm the old pending assignment is cancelled.
4. Confirm the replacement becomes `available` only when every earlier step is approved.

## Audit and notification behavior

Every accepted route update records the reason and the before-and-after route state. Locked steps must have the same IDs, positions, statuses, and workflow history before and after the update.

Reordering waiting offices alone does not send an action-required notification. The standard notification is sent only when an office legitimately becomes `available` after all earlier sequential steps are approved.
