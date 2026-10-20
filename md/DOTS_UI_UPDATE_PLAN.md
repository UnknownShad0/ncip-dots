# DOTS UI Update Plan: Video Reference

**Status:** Color refresh implemented in shared UI and key workflows; browser review pending.  
**Reference:** User-provided 43-second DOTS screen recording.  
**Purpose:** Plan a color-focused restyle that follows the recording while preserving the current application's text, content, layout, and behavior.

## 1. Direction

Use the recording as the visual direction for the current application: a deep navy navigation rail, stronger institutional blue, orange accents, and more visible status colors. The current content and functionality are already in place. The planned work is a visual restyle, especially its colors and color hierarchy.

Use color to make the existing hierarchy feel more official and less plain: stronger color for navigation, page sections, key totals, and primary actions; quieter neutral surfaces for supporting content. Keep the current page structure and spacing unless a small adjustment is needed to apply the shared styles consistently.

## Implementation update

The first implementation pass applies the palette to the authenticated sidebar and header, shared controls, sign-in and recovery pages, dashboard, document list, document editor and approval actions, archive views, public tracking, and shared confirmation dialogs. Supporting administration screens now use the same primary color for focus and selection accents. Existing wording, routes, data, and interactions were kept intact. A rendered browser pass is still needed to review responsive appearance and contrast in the running app.

## 2. What the recording shows

- A branded sign-in screen with a prominent system advisory.
- An authenticated workspace with a dark-blue left navigation rail and grouped links.
- A dashboard with summary metrics, charts, workflow information, and document activity.
- A document list with filters, a dense table, colored status labels, and row actions.

The recording does not show the document-generation editor, approval review screens, administration pages, or mobile layouts. Styling those screens to match the reference will require applying shared visual patterns where appropriate, not copying unseen layouts.

## 3. Current application baseline

- [`AuthenticatedLayout.tsx`](../resources/js/Layouts/AuthenticatedLayout.tsx) currently uses a light sidebar and header, grouped navigation, a collapsible rail, notification counts, and account controls.
- [`Dashboard.tsx`](../resources/js/Pages/Dashboard.tsx) already includes summary cards, receiving and approval work areas, recent documents, and analytics.
- [`Documents/Index.tsx`](../resources/js/Pages/Documents/Index.tsx) already includes search, status filtering, printing, document creation, a sortable table, and row actions.
- [`DocumentCreation/Index.tsx`](../resources/js/Pages/DocumentCreation/Index.tsx) contains the authoring and approval workflow, but that screen is not represented in the recording.

This suggests the main gap is visual treatment, particularly color and emphasis, rather than missing functionality or text.

## 4. Proposed visual system

### Color and surfaces

- Establish shared color tokens based on the reference: deep navy for the navigation rail, strong institutional blue for section emphasis, orange for selected primary accents, and white/light gray for content surfaces.
- Apply the palette consistently to active navigation, page and section headers, buttons, metric-card accents, table headers, and status badges.
- Keep status colors semantically consistent for pending, approved, returned, and archived states. Preserve the existing status labels and icons so color is not the only cue.
- Use borders and shadows consistently, but keep color as the main visual change.

### Preserve current content and behavior

- Keep all existing text, labels, help messages, data, section order, features, routes, permissions, and interactions.
- Keep the existing page layouts, spacing, responsive behavior, and sidebar collapse/mobile navigation wherever possible.
- Use the new colors to clarify the existing hierarchy; do not add content or rearrange screens as part of this update.

### Branding

- Preserve official DOTS/NCIP branding and current text and assets.
- The recording includes Indigenous Peoples Month campaign artwork and a system-restoration advisory. Use them only as visual references; do not replace current page copy or add time-specific campaign content.

## 5. Page-by-page implementation sequence

| Phase | Area | Planned visual work | Reference confidence |
|---|---|---|---|
| 1 | Shared color tokens | Define reusable navy, blue, orange, neutral, and semantic status colors, including readable hover, active, and focus states. | High |
| 2 | Authenticated shell and shared controls | Apply the palette to the sidebar, active navigation, header, buttons, cards, table headings, and badges without changing their text or behavior. | High |
| 3 | Dashboard and document list | Apply the palette to the existing metrics, section surfaces, charts, work queues, table, statuses, and actions. Keep their current content and layout. | High |
| 4 | Document creation and remaining pages | Carry the same shared colors through document creation, drafts, approvals, archives, and administration. These pages are not shown in the video, so reuse the palette without inferring new layouts. | Inferred |
| 5 | Sign-in screen | Apply compatible brand colors to the existing composition while preserving login, recovery flows, current copy, and current assets. | Medium |
| 6 | Review pass | Check contrast, active/hover/focus states, semantic status colors, desktop/mobile appearance, and all existing content and interactions. | Planned |

## 6. Guardrails

- Preserve all existing wording, labels, data, routes, permissions, interactions, document statuses, and workflow rules.
- Do not add or remove features, rewrite text, or reorganize page content as part of this color update.
- Keep strong colors purposeful and consistent instead of coloring every surface equally.
- Check text contrast and retain labels/icons alongside status colors.
- Do not reproduce the system-restoration message or other time-specific text as permanent content.

## 7. Implementation review checkpoints

1. Review the navy, blue, orange, and neutral colors in the rendered application.
2. Check contrast and focus states across the shared shell and pages not shown in the recording.
3. Confirm that existing page copy, content, and interactions remain intact after the restyle.

## 8. Out of scope for this proposal

- Backend, database, route, authorization, and workflow changes.
- Text rewrites, new dashboard metrics, document-management features, or page-layout redesigns.
- Copying campaign content, advisory copy, or other temporary material from the recording.
- Changing UI text, content, page structure, or workflow behavior.
