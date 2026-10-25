# DOTS Mobile Responsiveness Audit

**Audit date:** 2026-10-25  
**Scope:** All React/Inertia page components, shared layouts, dialogs, data-heavy components, and the application route inventory.  
**Implementation status:** Responsive remediation was implemented after this audit on 2026-10-25. The findings below are retained as the pre-fix baseline.

## Remediation completed

- Added a compact shared mobile header, reduced small-screen page padding, and normalized the dense application text size.
- Replaced the main Documents table with labelled mobile card rows below `md`, while retaining the desktop table and its existing actions.
- Converted ordinary administration, library, HRIS, connected-document, and signer-history registers to labelled mobile cards; horizontal scrolling remains only for the Navigation Access matrix.
- Added fit-to-width document previewing with zoom controls while preserving the editor's letter-size coordinate system.
- Reworked Workflow queues, Draft/Archive filters and tabs, Dashboard summaries, and the processing chart for narrow phones.
- Added viewport-aware modal sizing and capped the public route map indentation on mobile.
- Preserved existing form submissions, routes, permissions, callbacks, and server-side behavior; the changes are presentation-only.

## Follow-up audit — physical iPhone captures

The first fix pass did not fully satisfy the mobile acceptance criteria. The supplied iPhone Safari captures showed that adding horizontal scrolling and a swipe hint still left core records and actions off-screen.

**Follow-up remediation status:** Completed on 2026-10-25. F1–F4 were implemented and rechecked at a 320 × 645 phone viewport. Offices and User Accounts were visually verified as labelled record cards, and the Public Tracking approval dialog was verified with stable file and decision-action rows. Status and priority chips remain content-sized inside cards instead of stretching across the value column.

### Final implementation verification — 2026-10-25

- Re-inventoried every TSX table after the fix pass. All 10 ordinary data tables use the shared labelled-card layout below `md`; every non-empty mobile cell has a `data-label`.
- Kept Navigation Access as the sole horizontally scrolling data matrix, with a sticky first column, a visible swipe message, keyboard focus, and a descriptive region label.
- Confirmed that the processing-performance desktop table has an equivalent mobile card list and is hidden below `md`.
- Rechecked Documents, User Accounts, HRIS Employees, all five library registers, and both connected-document tables for mobile field and action visibility.
- Rechecked document, archive, public-tracking, document-creation, confirmation, and lifecycle dialogs. Mobile action rows now use full-width or equal-width placements without changing handlers, form submission, permissions, or routes.
- Corrected mobile status/priority chips so their background remains content-sized rather than filling the card value column.
- Corrected urgent document cards so the red background is present by default on mobile and does not depend on Safari's tapped/hover state. When Print and Close are the only detail actions, they now share one equal-width mobile footer row.
- Matched wet-signed and sent-to-iPluma file states to the same mobile three-control layout as Sign with iPluma: View and Download share the first row, while the signing state spans the second row.
- Added print-only restoration for responsive tables and forced the fixed Letter document canvas back to 100% zoom for printing, so mobile display scaling does not affect printed output.
- Verification commands completed successfully: TypeScript/Vite client build, Vite SSR build, document-renderer build, and whitespace/error checks.
- The unit suite passes (2 tests, 10 assertions). The broader feature suite is not currently a clean regression signal: its first failure is `ApprovedDocumentForwardingTest`, where the test user is rejected as an inactive account before reaching the document action; that backend fixture/middleware failure is unrelated to these presentation changes.

The findings below remain the original pre-fix baseline and explain why each remediation was made.

### F1 — Library registers still use desktop tables on phones

**Affected:** Offices, Ranges, Document Types, Purpose Types, Action Types, HRIS Employees

**Observed:** Only the first columns are visible. Email, location, hierarchy, status, and row actions require horizontal scrolling, so a user cannot identify and act on a record in one view.

**Implemented:** Semantic record cards now replace the table layout below `md`. Each card exposes the important fields and a consistent action row; sortable tables remain at `md+`.

### F2 — User Accounts still uses a 980 px table on phones

**Affected:** User Accounts

**Observed:** Name, username, and part of email fill the viewport; role, office, status, lock state, and Edit are off-screen.

**Implemented:** User cards now expose name, username, email, role, office, account state (Active, Inactive, or Locked), and Edit without horizontal panning. Search, pagination size, Print, and New user controls reflow for phones.

### F3 — Mobile dialog actions do not have a stable hierarchy

**Affected:** Public Tracking review dialog, Documents detail/review dialog, Archive detail dialog, file cards

**Observed:** Reject, Request changes, and Approve form an uneven wrapping pattern; Print disposition competes with the close icon in the header; file buttons use inconsistent wrapping and widths.

**Implemented:** Destructive and revision actions share an equal first row, with the primary approval action full-width beneath them. Print disposition moves out of crowded mobile headers, and View/Download share an equal-width row with signing actions below.

### F4 — “Swipe horizontally” is not an acceptable default for ordinary registers

**Affected:** All non-matrix data tables

**Observed:** The hint explains the overflow but does not make the record usable without panning.

**Implemented:** Navigation Access is the only intentional horizontally scrolling table on phones. Ordinary entity, connected-system, and signer registers now use mobile cards; the processing-detail table is replaced by its existing mobile summary cards.

## Executive summary

The system is usable on a typical 400 px mobile viewport, but it is not consistently mobile-friendly. The strongest parts are the guest/authentication forms, public tracking summary, archive/audit lists, stacked filters, and the mobile navigation drawer. The weakest parts are the fixed-size document editor, the 320 px workflow queue, and desktop-style tables.

### Overall result

| Finding severity | Count | Meaning |
|---|---:|---|
| High priority | 4 | A core task is clipped, difficult to understand, or impractical on a narrow phone |
| Medium priority | 7 | Functional, but crowded, inefficient, or missing mobile/accessibility affordances |
| Low priority | 4 | Polish or consistency issue |

These are **15 shared findings**, not 15 affected pages; one shared issue can affect several screens. The page-by-page result is listed later in the coverage matrix.

There were **no page-level crashes and no whole-page horizontal overflow** in the authenticated smoke tests. Horizontal overflow is mostly contained inside intentional scroll regions. The problem is that several of those regions either compress the table instead of scrolling it, or do not tell a phone user that more columns exist.

## How this was checked

- Inventoried all **32 TSX page files** under `resources/js/Pages` and all **107 application routes** shown by Laravel.
- Reviewed the authenticated shell, guest shell, shared dialogs, chart, connected-document register, rich-text editor, and fixed document paper components.
- Ran live browser checks with the existing local data and authenticated Admin Staff session.
- Live-tested representative core pages at **400 px** and narrow-phone checks at **320 px**.
- Focused on wrapping, clipping, horizontal overflow, table usability, touch target size, dialogs, filters, pagination, and fixed-width content.

### Live-tested screens

- Dashboard
- Latest Documents
- All Documents
- Document Creation
- Document Workflow
- Drafts
- Offices library
- User Accounts
- Public Tracking, including the route map
- Public Tracking review dialog

### Review limitations

- Remaining System Admin-only states were code-reviewed; Offices and User Accounts were also live-tested with an available System Admin session.
- Authentication and maintenance states were code-reviewed. Public Tracking was live-tested with a valid signed route, but every OTP/workflow state was not traversed.
- This is a responsiveness audit, not a complete WCAG audit or real-device/browser compatibility certification.
- Orientation changes, virtual-keyboard behavior, and safe-area insets still need final checks on physical Android and iOS devices after fixes.

## Priority findings

### H1 — The document editor uses a fixed 8.5 inch writing surface

**Affected:** Document Creation  
**Evidence:** `resources/js/Components/PaginatedDocument.tsx:199-200`, `resources/js/Pages/DocumentCreation/Index.tsx:910`

The editor workspace and sheet are both fixed to `8.5in`. The surrounding container allows horizontal scrolling, so the page itself does not break, but the editing surface is much wider than a phone. At 400 px, the live preview required horizontal panning and footer/address content was visibly outside the initial viewport. Editing fields, toolbars, and content in context is impractical on a phone.

**Recommendation:** Keep the letter-size canvas for print fidelity, but add an explicit mobile mode:

- Fit the sheet to available width with a calculated visual scale.
- Preserve an unscaled editing coordinate system internally.
- Provide clear zoom controls and a visible horizontal-scroll/zoom affordance.
- Consider a mobile “form view” for metadata and body editing, with the paper preview as a separate read-only/zoomable step.
- Ensure the toolbar remains reachable without horizontal scrolling.

### H2 — Workflow queue rows collapse at 320 px

**Affected:** Document Workflow  
**Evidence:** `resources/js/Pages/DocumentWorkflow/Index.tsx:233`, `resources/js/Pages/DocumentWorkflow/Index.tsx:242-254`

Each queue keeps the icon, title/description, document count, and chevron in one horizontal row. At 320 px, the description column became narrow enough to render almost one word per line, creating extremely tall and hard-to-scan cards. The search input and button are also forced onto the same row, clipping the placeholder.

**Recommendation:** Below `sm`, place the count below the title or in the top-right of a two-row card, shorten the count to a badge, and stack the search button below the input or use an icon-only submit button with an accessible label.

### H3 — The main Documents table exposes too little information on a phone

**Affected:** All Documents, Latest Documents  
**Evidence:** `resources/js/Pages/Documents/Index.tsx:1030-1032`

The table correctly has an 880 px minimum width and an accessible scroll region. On a 320 px viewport, however, the sticky Actions column occupies a large part of the visible area, leaving mainly Tracking No. and Actions visible. Tracking values wrap across several lines, intermediate columns are off-screen, and there is no visible cue that the table can be swiped horizontally.

**Recommendation:** Use a mobile card/list presentation for the primary document register. Show tracking number, title, status, current holder/office, and primary actions without horizontal scrolling. Keep the current table from `md` or `lg` upward. If the table remains on mobile, add a visible “Swipe for more columns” hint, prevent tracking-number wrapping, and reduce the sticky action column width.

### H4 — Several administration tables shrink instead of establishing a usable scroll width

**Affected:** Offices, Ranges, Document Types, Purpose Types, Action Types, User Accounts; partly Navigation Access  
**Evidence:** each table uses `overflow-x-auto` with only `min-w-full`; examples: `Offices/Index.tsx:301-302`, `DocumentTypes/Index.tsx:239-240`, `UserAccounts/Index.tsx:240-241`

An `overflow-x-auto` wrapper is present, but `min-w-full` alone does not give a 4–7 column table a meaningful minimum width. The browser can compress long headers and cell values into narrow columns. Offices and User Accounts are the highest-risk cases because they contain 6–7 columns with long names, email addresses, office names, and actions.

**Recommendation:** Prefer mobile cards for CRUD registers. As an interim improvement, set a table-specific minimum width, keep the key identifier and Actions visible, prevent identifiers/emails from collapsing unpredictably, and add a visible swipe hint. Every horizontal region should be keyboard-focusable and have a useful accessible label.

## Medium-priority findings

### M1 — Shared mobile top bar does not reserve enough space for long page headings

**Affected:** All authenticated pages, most visible on Document Workflow, Document Creation, Latest Documents, and Drafts  
**Evidence:** `resources/js/Layouts/AuthenticatedLayout.tsx:129-147`

At 320 px, page titles and subtitles wrap to three or four lines between the hamburger, notifications, avatar, and chevron. The header can become taller than the first content section and makes the controls feel crowded.

**Recommendation:** Use a compact mobile top bar with a one-line truncated title. Move page subtitles into the page body. On very narrow screens, hide the account chevron and reduce nonessential spacing while preserving 44 px touch targets.

### M2 — Global 19 px body text increases density problems

**Affected:** Entire system  
**Evidence:** `resources/css/app.css:46-48`

The base `body` is set to `19px/27px`. Explicit Tailwind text sizes override it in many places, but inherited text and some controls remain large. This contributes to tall headers, tabs, empty states, and narrow table cells on phones.

**Recommendation:** Scope the large reading size to long-form/public content, or use a fluid base size such as 16–18 px. Keep accessible line height, but do not rely on a global 19 px default for dense application UI.

### M3 — Connected-system tables need a defined mobile strategy

**Affected:** PDMIS, DRIP, iPluma and signer-details dialog  
**Evidence:** `resources/js/Components/ConnectedDocuments.tsx:212-220`, `327-344`

The main connected-document table has some column minimum widths and an accessible scroll region, so it should scroll rather than collapse. It still has six data columns, and the nested signer table has no focusable/labelled scroll region. Neither presents a mobile summary/card view.

**Recommendation:** Use compact cards on phones and retain tables on wider screens. At minimum, label and focus the signer table’s scroll container and add a visible scroll hint.

### M4 — HRIS table scrolls, but its scroll region is not announced or explained

**Affected:** HRIS Employees  
**Evidence:** `resources/js/Pages/HrisEmployees/Index.tsx:160-170`

The explicit 900 px minimum width prevents destructive compression, which is good. The wrapper is not keyboard-focusable, has no region label, and has no visible hint for touch users.

**Recommendation:** Add `tabIndex={0}`, `role="region"`, an accessible label, and a short mobile swipe hint. A mobile employee card would still be more efficient.

### M5 — Dashboard summary and processing chart are cramped on narrow phones

**Affected:** Dashboard  
**Evidence:** `resources/js/Pages/Dashboard.tsx:154`, `resources/js/Components/ProcessingPerformanceChart.tsx:28-56`

The summary is always two columns below `lg`, including at 320 px. It remained functional in the live test, but values and labels have little room. The performance chart reserves 115 px for its Y axis and uses desktop-oriented chart labels; the details table also requires scrolling.

**Recommendation:** Use one column below roughly 360 px or reduce card padding/type selectively. Provide a simplified mobile chart, shorter labels, or default to the accessible detail list on narrow screens.

### M6 — Draft and archive source tabs can become crowded

**Affected:** Drafts, Archives  
**Evidence:** `resources/js/Pages/Drafts/Index.tsx:100-121`, `resources/js/Pages/Archives/Index.tsx:165-174`

Two long tab labels fit at 320 px only by wrapping. This increases tab height and makes the control visually heavy. Search controls remain side-by-side on the same row at narrow widths.

**Recommendation:** Use equal-width tabs with shorter mobile labels (“Tracking” / “Generation”) while retaining full accessible names. Stack the search submit below the field below 360 px.

### M7 — Legacy shared Modal does not set base mobile width

**Affected:** Profile deletion/confirmation flows and any screen using `Components/Modal.tsx`  
**Evidence:** `resources/js/Components/Modal.tsx:63-65`

`sm:w-full` only applies at 640 px and up. Below that breakpoint, the panel relies on intrinsic width instead of explicitly filling the available space. This may produce unnecessarily narrow dialogs depending on their content.

**Recommendation:** Add base `w-full` and a viewport-aware maximum height/overflow treatment consistent with `WorkspaceDialog`.

## Low-priority findings

### L1 — Library and connected-system subnavigation wraps into multiple rows

**Affected:** Offices, Ranges, Document/Purpose/Action Types, HRIS, PDMIS, DRIP, iPluma  
**Evidence:** `resources/js/Components/LibraryNavigation.tsx:12-20`, `ConnectedSystemNavigation.tsx:10-18`

Wrapping is functional, but it creates a large navigation block before content. A horizontally scrollable tab strip or select menu would be more compact on mobile.

### L2 — Some pagination controls can become tall or crowded

**Affected:** Document Creation lists, Drafts, library registers  
**Evidence:** `resources/js/Pages/DocumentCreation/Index.tsx:353-357`, `Drafts/Index.tsx:167-184`

Long result text, page text, and two full-size buttons share limited width. Most wrappers allow wrapping, but the result is visually bulky.

**Recommendation:** Use compact icon buttons with accessible names on mobile and place the result count on its own line.

### L3 — Archive detail dialog header can crowd the close button

**Affected:** Archives  
**Evidence:** `resources/js/Pages/Archives/Index.tsx:288-301`

A long title, tracking number, Print disposition button, and close button share the sticky header. The flex layout can wrap, but the action group can dominate the title area.

**Recommendation:** On phones, move Print disposition into the sticky footer or below the title.

### L4 — Public route maps can become deeply indented

**Affected:** Public Tracking  
**Evidence:** `resources/js/Pages/PublicTracking/Show.tsx:531-675`

The public summary and OTP forms use good single-column mobile patterns. The branch map uses nested left indentation and connector lanes; deep branches progressively reduce the content width on a phone.

**Recommendation:** Cap visual indentation on small screens, or show depth using color/labels rather than additional horizontal offset.

## Table-by-table assessment

| Table/register | Current mobile behavior | Assessment | Recommended mobile treatment |
|---|---|---|---|
| All / Latest Documents | 880 px table inside labelled, focusable horizontal region; sticky Actions | **High** | Card rows below `md`; keep table for larger screens |
| Offices | 6 columns, `min-w-full` | **High** | Card rows or explicit large min width; preserve name/code/actions |
| User Accounts | 7 columns, `min-w-full`; labelled/focusable wrapper | **High** | Card rows; show name, role, office, status, Edit |
| Document Types | 5 columns, `min-w-full` | **High** | Card rows or explicit min width |
| Action Types | 5 columns, `min-w-full` | **High** | Card rows or explicit min width |
| Purpose Types | 4 columns, `min-w-full` | **High** | Card rows or explicit min width |
| Ranges | 4 columns, `min-w-full` | **Medium** | Card rows or explicit min width |
| HRIS Employees | 900 px min width, horizontal scroll | **Medium** | Add scroll affordance/accessibility; consider cards |
| Navigation Access | Role columns have fixed width; labelled/focusable scroll region | **Medium** | Keep matrix, freeze first column, add swipe hint |
| PDMIS / DRIP / iPluma | Column minimum widths; labelled/focusable main region | **Medium** | Cards on phones; improve nested signer table |
| Processing performance details | Scrollable data table | **Medium** | Mobile list or labelled scroll region |

## Page coverage matrix

| Screen/component | Review result | Notes |
|---|---|---|
| Dashboard | Needs improvement | Two-column phone summary and chart density |
| All Documents | High priority | Table exposes too little context at 320 px |
| Latest Documents | High priority | Same register/table behavior as All Documents |
| Document Creation | High priority | Fixed 8.5 inch editing canvas |
| Document Workflow | High priority | Queue cards collapse at 320 px |
| Drafts | Needs improvement | Header, tabs, and search are dense at 320 px |
| Archives | Mostly sound | List layout is responsive; minor tab/dialog concerns |
| Audit Trail | Sound | Entries stack at mobile; pagination becomes full-width |
| Public Tracking | Mostly sound | Summary/OTP stack well; deep route branches need a cap |
| Connected Systems directory | Sound | Directory rows are naturally responsive |
| PDMIS | Needs improvement | Six-column register depends on horizontal scrolling |
| DRIP | Needs improvement | Same shared connected-document register |
| iPluma | Needs improvement | Same register plus signer history table |
| Libraries directory / Setup | Sound | Directory list layout works on phone |
| Offices | High priority | Wide CRUD table lacks a useful min width/mobile view |
| Ranges | Needs improvement | Four-column table compresses |
| Document Types | High priority | Five-column table compresses |
| Purpose Types | High priority | Four-column table compresses |
| Action Types | High priority | Five-column table compresses |
| HRIS Employees | Needs improvement | Correctly scrolls; lacks affordance/accessibility |
| User Accounts | High priority | Seven-column table is not phone-oriented |
| Navigation Access | Needs improvement | Matrix requires horizontal navigation |
| Email Notifications | Sound | Narrow max width and stacked controls |
| System Maintenance admin | Sound | Grids collapse below `md`/`sm` |
| Maintenance public page | Sound | Single max-width content card |
| Profile | Mostly sound | Forms stack; legacy modal width needs correction |
| Login | Sound | Single-column guest card and full-width fields |
| Register | Sound | Single-column guest card and full-width fields |
| Forgot Password | Sound | Simple single-column form |
| Reset Password | Sound | Simple single-column form |
| Confirm Password | Sound | Simple single-column form |
| Verify Email | Sound | Simple single-column status/actions |

## What is already working well

- The authenticated layout switches from a desktop sidebar to a drawer below `lg`.
- The drawer uses `max-w-[85vw]`, so it does not cover the entire narrow viewport.
- Main content uses `min-w-0`, preventing many common flex overflow bugs.
- Most filters and form grids stack below `sm`.
- `WorkspaceDialog` uses `w-full`, viewport-aware maximum height, and vertical scrolling.
- Buttons generally meet a roughly 44 px touch target through `min-h-11`.
- Long titles/tracking numbers usually use `break-words` or `break-all`.
- The Documents and User Accounts scroll regions already have useful ARIA labels and keyboard focus.
- Archive and Audit Trail use list-based layouts instead of forcing all data into a table.
- Public tracking forms use full-width mobile controls.

## Recommended implementation order

### Phase 1 — Core task blockers

1. Add a mobile editing/preview strategy for the fixed letter-size document canvas.
2. Redesign Workflow queue rows and search for 320–400 px.
3. Add a phone card view for All/Latest Documents.

### Phase 2 — Reusable data-table pattern

1. Create a shared responsive register pattern: cards below `md`, table at `md+`.
2. Apply it to Offices, User Accounts, Document Types, Action Types, Purpose Types, and Ranges.
3. Standardize table scroll labels, keyboard focus, sticky columns, and visible swipe hints for matrices that must remain tables.

### Phase 3 — Shared shell and secondary screens

1. Compact the authenticated mobile header and move subtitles into page content.
2. Revisit the global 19 px body size.
3. Improve Dashboard chart/summary behavior.
4. Make source tabs and pagination compact on narrow phones.
5. Bring the legacy `Modal` in line with `WorkspaceDialog`.

## Acceptance checklist for the fix pass

- No whole-page horizontal scrolling at 320, 360, 375, 390, 400, and 768 px.
- Every core record can be identified and acted on without horizontal table scrolling on phones.
- Tables that intentionally scroll show a visible affordance and remain keyboard-operable.
- Sticky action columns do not cover the primary identifying information.
- Document Creation supports readable zoom/fit-to-width and reachable editing controls.
- Page headers remain compact with long titles and notification counts.
- Search, filters, tabs, pagination, and dialog actions fit without clipped labels.
- Dialog content remains reachable with a short viewport and virtual keyboard.
- Final verification is performed on at least one iPhone Safari and one Android Chrome device.

