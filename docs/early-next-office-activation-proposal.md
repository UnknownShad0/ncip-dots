# In-Progress Approval Route Reordering

**Status:** Implemented 2026-10-27
**Entry point:** Document details -> **Edit route**

## Purpose

Allow an authorized sender to reorder unfinished offices when an office is taking too long. An office that has already received the document can move in the route and continue its work. Reordering may make another office available while that active work continues.

This replaces the separate "Allow next office to proceed" action. It does not pause, cancel, or transfer an active office or its child route.

## Simple flow

```text
Before:  A approved -> B in progress -> C waiting -> D waiting

Edit route: move D before B

After:   A approved -> D available -> B in progress -> C waiting

Later offices wait until every office before them has approved.
```

The sender enters a reason and saves. The system records the before-and-after route in the audit history. If the reorder makes a different office available, that office's eligible approvers are notified by email after the route update commits.

## Rules

- The route creator or an administrator can edit a pending route from its sending office.
- Approved offices cannot be dragged or removed.
- An `in_progress` office can move, but remains in progress and must stay in the route.
- An office with a `waiting_on_branch` status can move, but its active child route stays attached and continues.
- Active offices keep their route-step identity, receipt, decision history, and signature settings.
- Waiting offices can be added, removed, or reordered while the route is in order. An unreceived assignment is cancelled if a different office becomes eligible.
- The first waiting office whose earlier route steps are all approved becomes available. It can start while an already-active office continues working.
- A later office cannot become available while any office before it remains unapproved.
- If an office has already approved out of order, the unfinished offices can still be reordered. Approved offices remain at their current positions; adding and removing offices is disabled until the route is back in order.
- A newly available office receives the standard “Office review needed” email, if automated email is enabled and configured. Active offices that are merely moved are not emailed again.
- Parallel route behavior is unchanged.

## Example outcomes

For the order `D -> B -> C`, with B already in progress:

1. D becomes available. B continues working, and C remains waiting.
2. If D approves first, C still waits for B.
3. If B approves first, C still waits for D.
4. C becomes available only after both D and B approve.

## Manual test: move a waiting office ahead of an active office

1. Create a sequential route with offices A, B, C, and D.
2. Receive the document at B so B is `in_progress`; leave C and D waiting.
3. As the route creator or an authorized administrator in the sending office, open the document details and select **Edit route**.
4. Move D before B, enter a reason, and save.
5. Confirm D is available, B remains `in_progress`, and C remains waiting.
6. Approve D while B is still active. Confirm C remains waiting.
7. Approve B. Confirm C becomes available.
8. Repeat with a child route active at B. Confirm B and its child route remain active after reordering.

## Manual test: route already has an out-of-order approval

1. Open a pending route where a later-position office is approved and earlier offices are unfinished.
2. Confirm **Edit route** is visible to the authorized sender.
3. Reorder the unfinished offices and save with a reason.
4. Confirm the approved office stays in its original position and unfinished offices keep their statuses, except that the newly eligible first office becomes available.
5. Confirm the office picker and remove controls do not allow offices to be added or removed in this state.

## Email behavior

When route editing activates a different office, the system queues the regular `approval_required` notification after the database transaction commits. Recipients are active, unlocked users in that office who have an approver role, can receive documents, and have a valid email address. The document creator is excluded from the office notification. Delivery requires the automated email setting, mail configuration, and queue worker to be available.

Keeping the same office available does not generate a duplicate notification. Moving an office that is already in progress also does not generate a new receipt notification.
