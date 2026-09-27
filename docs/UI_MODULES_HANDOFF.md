# Dashboard and Documents UI implementation guide

This document describes the current implementation of the **Dashboard** and **Documents** modules. Use it as the reference when adapting these modules to another project or asking an AI coding assistant to reproduce the implementation.

## Instructions for an AI implementing this elsewhere

Read this guide and inspect the target project's existing routes, models, controllers, and layout before changing code. Recreate the design and interactions described here, but connect them to the target project's real data and route names. Preserve existing server behavior and authorization. Do not assume that this project's PHP class names, database schema, or route names exist in the target project.

Keep the Dashboard and Documents pages consistent with one another. Use the existing icon library if the target project already has one; this project uses `lucide-react`. Use the established UI framework and design tokens rather than adding a second styling system.

## Files and route map

| Purpose | File or route |
| --- | --- |
| Shared authenticated shell and sidebar | `resources/js/Layouts/AuthenticatedLayout.tsx` |
| Dashboard page | `resources/js/Pages/Dashboard.tsx` |
| Dashboard data | `app/Http/Controllers/DashboardController.php` |
| Documents page, shared by latest and all views | `resources/js/Pages/Documents/Index.tsx` |
| Documents data and mutations | `app/Http/Controllers/DocumentController.php` |
| Dashboard route | `dashboard` |
| Latest Documents route | `documents.latest` (`/documents/latest`) |
| All Documents route | `documents.index` (`/documents`) |

The application uses Laravel, Inertia React, TypeScript, Tailwind CSS, Lucide React, and Headless UI. The shared authenticated layout is used by both modules.

## Shared visual language

- Use a warm off-white page background (`#f8f8f6`) and a lightly bordered, rounded application frame.
- Use a white sidebar with a subtle divider, grouped expandable navigation, line icons, and a pale blue active state with a blue indicator bar.
- Use white content surfaces, thin warm-gray borders (`#e2e2df`), generous spacing, rounded corners, and restrained shadows.
- Use blue as the primary action and navigation color. Use color accents to communicate document state: blue for incoming/total, amber for pending, green for released, and violet for archived.
- Use Lucide line icons and keep them aligned consistently with labels and controls.
- Keep the layout usable on narrow screens. The sidebar becomes a slide-in mobile menu; card grids and document controls reflow; wide tables scroll horizontally.

## Dashboard

### Layout

1. The shared page header shows a large **Dashboard** title and a document search field on wider screens.
2. Four summary cards appear in this order:
   - **Incoming Documents**
   - **Pending for Release Documents**
   - **Released Documents (Today)**
   - **Archived Documents**
3. Each card has a tinted background and border, a short descriptive label at the top left, a colored Lucide icon in a square rounded badge at the top right, a prominent count near the bottom, and a short explanation under the count.
4. A white **Recent activity** panel follows the cards. Each row shows a document title, tracking number / office / status metadata, and a relative timestamp. Rows have separators and adapt to mobile widths.

### Data contract and count logic

The controller sends `stats` and `recentDocuments` to the Inertia page. The card values are formatted with locale separators and default to `0` when absent.

| Frontend card | `stats` key | Current definition |
| --- | --- | --- |
| Incoming Documents | `total_documents` | New `documents` row count plus legacy `document` row count. Despite the UI label, this is the total count across both systems. |
| Pending for Release Documents | `pending_documents` | New documents whose status is `pending`, plus legacy documents whose latest trail (largest `docTrailId` per `trackingNo`) is `PENDING`. |
| Released Documents (Today) | `released_today` | New documents with status `processed` and `updated_at` today, plus distinct legacy tracking numbers with an `AVAILABLE` trail created today. |
| Archived Documents | `archived_documents` | New documents with `is_archived = true`, plus legacy documents where `Archived = 'Y'`. |

The legacy models use the `legacy` database connection. The recent activity list currently receives the five newest records from the new `documents` model only. If a target project needs recent activity from multiple databases, explicitly merge and normalize records server-side before rendering them.

The Dashboard search is client-side and filters the received recent activity records by title, tracking number, and office name. It does not query all documents.

## Documents module

### Shared Latest and All views

Both routes render the same `Documents/Index` React page. The page accepts a `title` prop so the shared header and browser title can distinguish Latest Documents from All Documents. If no title is supplied, it displays **All Documents**.

Current controller behavior differs by route:

- **All Documents** loads and combines legacy and new records, normalizes them into a common row shape, and tags legacy rows with `source: 'Old DB'`.
- **Latest Documents** loads the newest records from the new database only and supplies `title: 'Latest Documents'`.

### Page structure and controls

- Shared header: small uppercase section label **Document management**, followed by the current page title.
- Toolbar card: **Document register** heading and short description above a responsive grid of controls.
- Controls: search input with a search icon, status filter, Print button, and blue New Document button. The search and filter occupy full rows on narrow screens; on wider screens controls align in one row without colliding.
- Table card: displays the filtered document count and visible row range above the table.
- The table includes tracking number, title, document type, origin type, status, last transaction, and actions. The Office column is intentionally omitted from both Latest Documents and All Documents.
- Legacy rows in All Documents may retain a small **Legacy** badge beside their tracking number. Do not add a legacy source suffix to values in the library dropdowns; dropdown options display the option name only.
- Status appears as a pill. Pending is amber, released/processed/available is green, rejected/cancelled is red, and archived/terminal is violet.
- The table scrolls horizontally when needed. Rows have subtle separators and hover states.
- Pagination includes rows-per-page options, current page / total pages, and Previous / Next controls. Keep native select arrows clear of the displayed value with sufficient right padding. The empty state must span exactly seven columns.

### Existing interactions to preserve

- Client-side search across title, tracking number, status, document type, origin, last transaction, and office fields (office remains searchable even though its visible column was removed).
- Status filtering. The Released filter also includes new `processed` and legacy `AVAILABLE`; Archived also includes legacy `TERMINAL`.
- Clickable table headings for sorting and pagination that resets to page 1 when search, status, or page size changes.
- Printing with the toolbar/actions hidden and only the table content visible.
- Create and update forms use the existing Inertia POST/PUT routes. Legacy records are read-only and cannot be edited.
- Library dropdowns for document type, purpose, action type, and office. Show human-readable names only; do not expose the backing database/source marker in option text.

### Modal sizing and behavior

The create/edit dialog uses a dim page backdrop, centered placement, rounded white surface, and a bounded width. Constrain its height to the viewport (`max-height: calc(100vh - 2rem)`) and place vertical scrolling inside the dialog (`overflow-y: auto`) so long forms do not extend past the screen. Add dialog semantics (`role="dialog"`, `aria-modal="true"`, and a labelled heading). Do not make the form itself stretch to full viewport height.

## Reproduction checklist

When copying the implementation to another codebase:

1. Identify that application's equivalent shared authenticated shell and adapt the sidebar there only if appropriate.
2. Preserve the four Dashboard card labels, order, distinct colors, icon placement, counts, and helper text.
3. Build counts from the application's actual data sources. If there are legacy and current databases, count both where required and define status mapping based on each schema's source of truth.
4. Keep Latest and All Documents titles distinct while sharing their table component where practical.
5. Keep the Office column absent from both document tables; update empty-state `colSpan` whenever table columns change.
6. Preserve search, status filtering, sorting, pagination, print, create, and edit interactions.
7. Mark legacy rows if useful, but keep backend source identifiers out of dropdown option labels.
8. Bound long dialogs to viewport height and allow the dialog body to scroll.
9. Check JSX/TypeScript compilation and production build after changes; verify both desktop and narrow-screen layouts.
