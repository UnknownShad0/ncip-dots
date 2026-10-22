# Multi-Office Document Routing Plan

**Status:** Implementation in progress  
**Scope:** Routing one document through several offices using sequential or parallel approval

## Goal

Let users send one document to multiple offices and clearly see which offices have approved and which still need to act.

## Implemented behavior

- A sender can route one document to multiple offices using sequential or parallel approval.
- Each office has an individual route step while the document keeps an overall approval status.
- A receiving office can send a child route to additional offices. Its own step waits until the child route is approved, then returns to **In progress** for that office's decision.
- The routing history records each receive, forward, branch completion, and approval decision.

The route tree keeps the parent office responsible for its own approval, even when child offices have finished.

## Routing types

### Sequential routing

- The user selects several offices and arranges them in order.
- The first office receives the document first.
- The next office can act only after the previous office approves.
- The user can drag offices to change their order before the route starts.
- Every office in the route is required to approve.
- An office may create a smaller child route while its own step is active.
- The parent office waits while its child offices act, then must make its own decision.

### Parallel routing

- The user selects several offices.
- All selected offices receive the document at the same time.
- Each office can review and approve independently.
- Every selected office is required to approve.
- A receiving office may also create a child route. The parent office remains responsible for its own approval after the child route is complete.

## Status rules

- Each office has its own status: **Waiting**, **In progress**, **Approved**, **Changes requested**, or **Rejected**.
- The overall document status remains **Pending** while offices still need to act.
- The route becomes **Approved** only after every selected office approves.
- If an office requests changes or rejects the document, show that decision and pause the route. Do not mark the route approved.
- In sequential routing, offices later in the order remain **Waiting** until their turn.
- A parent step shows **Waiting on branch** while a child route is active, then returns to **In progress** when every child office approves.
- A child rejection or changes request pauses unresolved routes across the tree.
- A child branch cannot route back to an office already above it. Use **Request changes** with a remark to return the document for adjustments.

## Interface plan

### Routing form

- Add a choice for **Sequential** or **Parallel** routing.
- Let the user add and remove offices before submitting.
- Show that every selected office must approve.
- For sequential routing, show a numbered office list with drag handles and a clear step order.
- For parallel routing, show the selected offices as branches from the document.
- Before submission, show a simple summary of the selected mode and offices.

### Tracking view

- Show a central document card connected to the office steps or branches.
- Use clear visual states for approved, active, waiting, changes requested, and rejected offices.
- Highlight the current office in sequential routing.
- In parallel routing, show all offices that are still working or waiting.
- Render forwarded offices as compact, indented branches under the office that sent them.
- Show that the parent office still needs to approve after its child branch finishes.
- Selecting an office should show its decision, approver, date, and remarks when available.
- Keep the chronological routing history below the visual so users can read the full sequence of actions.
- Make the visual usable on narrow screens by stacking office cards vertically.

### Disposition form

- Add a **Routing History** table listing recorded actions from oldest to newest by date and time.
- Show the date and time, office, action and status, person who handled the action, and remarks when available.
- For parallel routing, list office actions in the order they actually happened. The office name identifies which branch the action belongs to.
- Show offices that still need to approve in a separate **Pending Offices** section. Do not list future steps as completed history.
- Continue the table on another page when needed so the text remains readable.

## Workflow and data plan

- Store a route record for the document, including its routing mode and overall status.
- Store one route step for each selected office, including its order, office, status, decision, and timestamps.
- Link a child route to the parent office's route step so the server can pause and resume that step correctly.
- Keep the existing document trail as the audit history. Record each office action there and connect it to the related route step where practical.
- In sequential mode, allow approval only from the office whose step is active.
- In parallel mode, allow each selected office to act independently.
- Prevent an office from submitting a decision more than once for the same active step unless an authorized correction flow is provided.
- Allow offices to be reordered or changed before the route starts. After it starts, require an authorized, recorded route change and notify affected offices.
- Preserve the primary source file and supporting attachments as separate files. Only the primary source is eligible for iPluma signing.

## Notifications

- Sequential: notify an office when its step becomes active.
- Parallel: notify all selected offices when the route is sent.
- Notify the sender when an office approves, requests changes, or rejects the document.
- Show reminders for offices that still need to act, if reminders are enabled for the application.

## Implementation sequence

1. Confirm the status behavior for changes requested and rejected documents.
2. Add route and per-office step storage while preserving the existing routing history.
3. Enforce sequential and parallel approval rules on the server.
4. Add the mode choice and office selection interface to the routing form.
5. Add the office-step and branch visual to document details and tracking.
6. Add notifications for newly active steps and office decisions.

## Implementation progress

- [x] Add route and per-office approval-step storage.
- [x] Add sequential and parallel selection to the Forward dialog, including drag-and-drop ordering for sequential routes.
- [x] Enforce office receipt and approval rules and pause a route on a change request or rejection.
- [x] Show route progress in document details and signed public tracking.
- [x] Allow an active receiving office to forward to a child route while preserving its own approval decision.
- [x] Show child routes as smaller nested branches in staff and public tracking views.
- [x] Print routing history in chronological order and list offices still waiting or paused.
- [x] Queue office email notices when Gmail is connected and sender decision emails when the record's email option is enabled.
- [x] Add the route tables migration.
- [x] Apply the child-route migration in the local environment.
- [ ] Exercise the workflow in the application with test offices and approvers.

## Review decisions

- All offices selected for either routing type are required to approve.
- The overall status stays **Pending** until all required offices approve.
- A changes request or rejection pauses the route and is shown as its own status.
- Sequential office order can be changed by dragging offices before the route starts.
- A receiving office may forward to additional offices as a child branch. Once every child office approves, the parent office must still approve its own step.
- Request changes records a return for adjustments; forwarding back to an ancestor office is blocked.
- The disposition form shows recorded routing actions in chronological order and lists pending offices separately.

