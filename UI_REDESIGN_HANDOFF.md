# DOTS UI Redesign — Implementation Handoff

Updated: 11 October 2026 (Asia/Manila)

## Objective and user preferences

Redesign the existing DOTS interface into a clear, polished administrative workspace. The user wants to avoid a generic, AI-generated dashboard appearance.

Agreed priorities:

- Primary users: administrators.
- Main daily work: receiving and forwarding documents.
- Primary devices: desktops and laptops; smaller screens must remain usable.
- Comfortable table density: approximately 10–15 records per page. Updated lists default to 15; this does not guarantee 15 rows fit without scrolling.
- Collapsible desktop sidebar with a saved preference; drawer navigation on mobile.
- English interface labels and help text.
- Concise copy. Use accessible info popovers for supplementary explanations; keep essential instructions and validation errors visible.
- Consistent, accessible modal forms, confirmations, and feedback.
- Subtle Framer Motion animations with reduced-motion support.
- Central theme colors so future color changes do not require editing every page.
- Preserve existing functionality, routes, request payloads, permissions, validation, legacy restrictions, API integrations, and printing behavior.

## Reference files

Continue using `tests/html-ui/js/*.html` as structural and visual references, especially:

- `dashboard.html`
- `libraries.html`
- `documents.html`, `incoming.html`, `outgoing.html`
- `modals.html`
- `pdmis.html`, `drip.html`, `ipluma.html`

These are demonstrations, not authoritative application behavior. Do not copy sample records, counts, status badges, synchronization timestamps, or unsupported actions into production. An `app.js` tab was mentioned by the user, but that file was not found on disk during the initial inspection.

## Design foundation

### Theme

`resources/css/app.css` contains centralized RGB CSS variables. `tailwind.config.js` maps them to semantic Tailwind utilities with opacity support.

| Token | Current color | Purpose |
| --- | --- | --- |
| primary | #183B56 | Primary actions and active navigation |
| primary-hover | #102B40 | Primary hover state |
| primary-foreground | #FFFFFF | Text on primary surfaces |
| secondary | #EAF0F5 | Supporting surfaces and selections |
| tertiary | #B8872E | Restrained brand/chart accent |
| background | #F6F7F8 | Workspace background |
| surface | #FFFFFF | Tables, panels, dialogs |
| foreground | #202A35 | Main text |
| muted | #66717E | Supporting text |
| border | #E2E6EA | Dividers and outlines |
| success | #26734D | Successful/completed states |
| warning | #946200 | Attention/pending states |
| danger | #B33D3D | Errors/destructive actions |

Matching `success-soft`, `warning-soft`, and `danger-soft` backgrounds are also defined.

Examples: `bg-primary`, `text-primary-foreground`, `hover:bg-primary-hover`, `border-border`, `bg-secondary`, `text-muted`.

Edit the `:root` variables to change the palette. Check contrast after changing colors, including chart labels and hover/focus states. Theme migration is not yet exhaustive: older pages and some existing status styles still contain literal colors.

Shared button classes: `dots-button`, `dots-button-primary`, `dots-button-secondary`.

### Typography and icons

- Source Sans 3 is loaded by `AuthenticatedLayout`, with system-font fallbacks.
- Typical targets: 24px page headings, 18–20px section/modal headings, 14px table/body text, 16px form inputs where appropriate, 12–13px supporting text.
- Existing Lucide icons are retained, generally 16–20px.
- Tracking identifiers use monospace where useful.
- Actual sizes still vary in older pages; continue normalizing deliberately.

### Interaction patterns

- `WorkspaceDialog.tsx`: shared Headless UI dialog with Framer Motion, reduced-motion handling, focus management, scrollable content, responsive width, and a busy guard.
- `WorkspaceAlert.tsx`: shared confirmation/success dialog.
- `InfoTip.tsx`: click/tap/keyboard-accessible Headless UI popover.
- Keep motion short and purposeful. Do not stagger every table row or delay common admin actions.
- Prefer visible action labels for Receive, Forward, and Details.
- Long-term preference: lightweight success notifications; current migrated screens still use success dialogs. Toast migration is not complete.

## Completed implementation

### 1. Authenticated layout

File: `resources/js/Layouts/AuthenticatedLayout.tsx`

- Neutral sidebar/header using theme tokens and Source Sans 3.
- Desktop sidebar collapses from 248px to 80px.
- Preference is stored in `localStorage` under `dots.sidebar.collapsed`.
- Collapsed links retain accessible labels and native title tooltips.
- Mobile navigation uses a Headless UI drawer.
- Account details are consolidated in the header dropdown; sign-out remains available in the sidebar.
- Library/account navigation remains gated by `canManageLibraries`.
- Libraries and Connected systems each have a single sidebar entry, with active state maintained on child pages.
- Shared layout changes affect all authenticated pages, including pages whose content has not yet been redesigned.

### 2. Documents

File: `resources/js/Pages/Documents/Index.tsx`

- Updated toolbar, colors, headings, document-title details action, and 15-row default.
- Receive and Forward have visible labels and retain existing permission flags.
- Forward still posts to the existing `/documents/{id}/release` endpoint. Only the user-facing wording changed.
- Detail, create/edit, and forwarding dialogs use `WorkspaceDialog`.
- Forwarding document metadata/attachments are expandable to reduce initial form clutter.
- Added pending/disabled states and server-error feedback.
- Added discard confirmations for unsaved form/forwarding details.
- Existing payloads, upload fields, finalization, legacy restrictions, and disposition print implementation were retained.

### 3. Dashboard

Files:

- `resources/js/Pages/Dashboard.tsx`
- `resources/js/Components/DashboardCharts.tsx`
- `resources/js/Components/ProcessingPerformanceChart.tsx`

Changes:

- Compact summary totals; receiving queue comes before analytics.
- Approval tasks and recent documents appear alongside the receiving workspace on wide screens.
- Existing receive-by-tracking-number and confirmation flow retained.
- Analytics office filter is visibly scoped to charts only; summary totals, receiving list, and approval tasks remain independent.
- Workflow counts use independent horizontal bars, not a pie chart: categories can overlap.
- Document types are ranked by count, with top five and Show all controls.
- Count bars use HTML/Framer Motion with visible exact values; processing comparison continues to use Recharts.
- Processing chart retains all-time median weekday turnaround, completed counts, and an accessible data table.
- Tracking and approval series use primary and tertiary theme colors.
- Methodology is in an info popover. Missing performance data is not represented as zero.
- Renamed misleading “Recent activity” to “Recent documents,” since the backend returns records ordered by creation date.
- Removed invented fallback relative timestamps; dates use Manila time, and invalid/missing dates show “Date unavailable.”

### 4. Libraries

Files:

- `resources/js/Components/LibraryNavigation.tsx`
- `resources/js/Layouts/LibraryLayout.tsx`
- `resources/js/Pages/Setup/Index.tsx`
- `resources/js/Pages/{Offices,Ranges,DocumentTypes,PurposeTypes,ActionTypes}/Index.tsx`

Changes:

- Sidebar has one Libraries entry under Administration; User accounts is separate.
- Libraries entry uses existing `libraries.index` route.
- Shared selectable cards link to the five existing management routes, with a Viewing indicator.
- Setup/legacy library landing pages now show the selector and a concise instruction.
- Removed misleading landing counts: SetupController returns only up to ten records per collection, not full totals.
- Tables and forms use theme tokens, 15-row defaults, shared dialogs/alerts, pending guards, and server validation feedback.
- Office-specific validation and imported-record editing restrictions remain intact.
- No new document-category management feature was invented from the HTML reference.

Test fixture repair: `tests/Feature/OfficeShortNameTest.php` now includes users and audit migrations needed by existing office-save audit logging. Production save logic was not changed for this repair.

### 5. Connected systems

Files:

- `resources/js/Components/ConnectedSystemNavigation.tsx`
- `resources/js/Layouts/ConnectedSystemsLayout.tsx`
- `resources/js/Pages/ConnectedSystems/Index.tsx`
- `resources/js/Components/ConnectedDocuments.tsx`
- `resources/js/Pages/Integrations/Index.tsx`
- `resources/js/Pages/Ipluma/Index.tsx`
- `routes/web.php`
- `tests/Feature/ConnectedSystemsTest.php`

Changes:

- One Connected systems sidebar entry.
- New authenticated/verified `/connected-systems` directory, named `connected-systems.index`.
- Directory does not call external APIs. System cards open existing PDMIS, DRIP, and iPluma routes.
- All three use the shared `ConnectedDocuments` view because their normalized document shapes match.
- Shared UI includes search, signature-status filter, 15-row default, print, Refresh, compact signer progress, and an animated signing-details dialog.
- Search covers identifiers, filenames, originator name/email, and signer names.
- Refresh uses an Inertia partial reload of `documents`.
- Original originator, file metadata, dates, signer email/status/remarks remain available.
- API controllers, authentication headers, and endpoints were not changed.
- The view is explicitly read-only; signing and editing belong in the source system.

Important limitation: existing controllers return an empty array for missing configuration, upstream failure, exceptions, and legitimately empty results. The UI cannot distinguish these cases. Do not claim “Connected,” “Sync successful,” or “Last synced” without adding real backend state. The Refresh error message handles page-request errors, not swallowed upstream errors.

## Verification completed

At the corresponding implementation stages:

| Scope | Result |
| --- | --- |
| Documents receiving/editing/approved-document reuse | 10 tests, 239 assertions passed |
| Dashboard charts/filter/released counts/performance/receiving | 14 tests, 410 assertions passed |
| Library data source/office short name/employee assignment | 9 tests, 133 assertions passed |
| Connected systems directory authentication and mocked API data | 2 tests, 79 assertions passed |

These groups overlap; do not add their counts together as a unique full-suite result.

- `npm run build` passed after the latest changes (TypeScript, Vite client, and SSR builds).
- `git diff --check` passed.
- Temporary SSR smoke checks verified permission-gated document actions/navigation, dashboard populated/empty states, all six library views, and the connected directory plus all three systems.
- Connected-system tests fake HTTP and prevent stray requests. They disable SSR only in their test setup to avoid treating the local SSR service as an upstream API call.
- Live external API connectivity was not tested.
- Full test suite was not run.
- Browser visual and interaction review is still pending: computer-use access was denied because OS permissions were not granted. SSR rendering does not verify visual layout, keyboard interaction, motion, or real mobile behavior.
- Build output reported an existing unresolved-at-build-time `/images/login/october2026.jpg` reference; it is left for runtime resolution.

Useful commands:

```sh
npm run build
php artisan test --compact --filter='DocumentReceivingPermissionsTest|DocumentInlineEditingTest|ApprovedDocumentReuseTest'
php artisan test --compact --filter='DashboardChartsTest|DashboardOfficeFilterTest|DashboardReleasedDocumentsTest|ProcessingPerformanceTest'
php artisan test --compact --filter='LibraryDatabaseSourceTest|OfficeShortNameTest|EmployeeOfficeAssignmentTest'
php artisan test --compact --filter=ConnectedSystemsTest
git diff --check
```

## Remaining work / suggested next steps

The following are proposals, not completed features:

1. Visually review the implemented pages at desktop, laptop, and phone widths. Check long filenames/office names, horizontal table scrolling, modal height, sticky actions, keyboard focus, reduced motion, and collapsed navigation.
2. Exercise create/edit validation, receive/forward confirmations, pending states, discard behavior, print layouts, and API Refresh in a safe local environment.
3. Continue the same design language into Archives, Audit Trail, User accounts, Document Creation/approval screens, Public Tracking, and profile/auth screens as requested by the user.
4. Audit leftover hardcoded colors and inconsistent input sizes. Preserve print-specific styling deliberately.
5. Consider distinguishing API states in backend props: not configured, unavailable, empty, loaded, and last successful fetch. Preserve server-side credentials and do not expose secrets.
6. Consider replacing routine success dialogs with concise notifications. Keep consequential confirmations explicit.
7. Avoid expanding scope into new backend workflows just to match demonstration HTML.

## Working-tree cautions

- This work is in the working tree; no commit or deployment was performed during these changes.
- The reference HTML files were already staged user changes. Do not reset or overwrite them.
- `public/hot 2` appeared as an untracked file and was not modified. Do not delete it merely because its name looks unusual.
- Inspect current git status and diffs before continuing; the user may have edited files since this handoff.
- Do not run destructive cleanup or overwrite unrelated work.
- No sub-agents were used. Current session instructions prohibited delegation unless explicitly requested.

## Ready-to-copy continuation prompt

> Continue the DOTS UI redesign in this repository. Read `UI_REDESIGN_HANDOFF.md` first, then inspect current git status and the relevant source files. The UI is for admins who mainly receive and forward documents, primarily on desktop/laptop. Use the existing Source Sans 3, Lucide icons, semantic theme tokens, shared dialogs/info popovers, and subtle Framer Motion patterns. Keep English copy concise and the interface responsive. Use `tests/html-ui/js/*.html` as references, but preserve real routes, payloads, permissions, validation, legacy restrictions, API fields, and printing. AuthenticatedLayout, Documents, Dashboard, Libraries, and Connected systems have already been updated. Do not redo them blindly or overwrite user changes. Browser visual verification is still pending. Work on **[INSERT NEXT PAGE OR REQUEST HERE]**, explain the concrete change briefly, implement it, run relevant checks, and report any remaining limitations honestly.
