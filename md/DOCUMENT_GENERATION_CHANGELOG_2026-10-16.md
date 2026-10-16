# Document Generation — Change Summary

Date: October 16, 2026 (Asia/Manila)

This document covers the latest commit and the current uncommitted changes to document creation. The latest commit introduced document templates, rich text editing, and PDF previews. The working changes fix the editor crash, tighten metadata spacing, and update the library test fixture.

## Latest commit

| Field | Value |
| --- | --- |
| Commit | `8235a43da80b9fe8e6504501551ceafac08e00da` |
| Message | `chore(WIP): generate document` |
| Author | Jmark WFH |
| Date | October 14, 2026, 10:32 PM (+08:00) |
| Scope | 29 files changed; 1,289 insertions and 205 deletions |

### Document templates and assets

- Added `document_assets` and `document_template_versions` tables.
- Added `document_types.default_template_version_id` to assign a default template to each document type.
- Added `DocumentAsset` and `DocumentTemplateVersion` models and the document type relationship.
- Added `DocumentTemplates` to import and validate PNG/JPEG assets, resolve template layouts, and prepare images for browser and PDF rendering.
- Asset filenames use content hashes; rendering checks the stored image against its hash.
- Added standard, memorandum, letter, and certification sample templates through `DocumentTemplateSeeder`.
- Added the `documents:import-asset` Artisan command.
- Added template selection to document type administration and included template assignments in audit data.

Primary files: `app/Services/DocumentTemplates.php`, `database/migrations/2026_10_14_000001_create_document_templates.php`, `database/seeders/DocumentTemplateSeeder.php`, and `resources/js/Pages/DocumentTypes/Index.tsx`.

### Rich text document editor

- Added `RichDocumentEditor.tsx` using Tiptap, with bold, italic, underline, headings, lists, alignment, undo/redo, and table editing.
- Added the Tiptap table and text alignment dependencies.
- Changed `PaginatedDocument.tsx` into a continuous Letter-size writing surface with editable title, routing fields, document body, and copy recipients.
- Added dynamic header rendering for a full header image or a logo-based layout.
- Added sample content loading to the document creation page.
- Added `RichDocumentContent` to normalize supported rich text, derive plain text, and generate escaped HTML for PDF output.

Primary files: `resources/js/Components/RichDocumentEditor.tsx`, `resources/js/Components/PaginatedDocument.tsx`, `resources/js/Pages/DocumentCreation/Index.tsx`, and `app/Services/RichDocumentContent.php`.

### PDF preview and submitted versions

- Added `DocumentPdf` and `DocumentPdfPreview.tsx` for server-rendered PDF previews.
- Added authenticated routes for document assets, current-content previews, and submitted-version previews. Preview routes are throttled to 30 requests per minute.
- Previewing current content does not create a draft.
- Saved content includes a server-controlled template snapshot and document title.
- Saving an existing draft with the same document type preserves its template snapshot.
- Submitted versions retain their content and header snapshot when template assignments subsequently change.
- Updated generated document rendering and approved document reuse to use versioned content.

Primary files: `app/Services/DocumentPdf.php`, `app/Http/Controllers/DocumentCreationController.php`, `resources/js/Components/DocumentPdfPreview.tsx`, `resources/views/documents/generated.blade.php`, and `routes/web.php`.

### Other changes in the commit

- Registered `DocumentTemplates` as a scoped service.
- Removed optional anchor suffixes from sidebar navigation targets.
- Added `output/visualizations/dynamic-document-headers.html` as a design reference.
- Added `DynamicDocumentTemplatesTest` and adjusted document creation and inline editing tests.

## Current uncommitted changes

### Editor crash fix

File: `resources/js/Components/RichDocumentEditor.tsx`

The document editor called `useEffect` inside another effect callback. This violates React's Rules of Hooks and causes an invalid hook call when the editor mounts.

The fix removes the nested duplicate and retains the existing top-level effect that synchronizes the editor's editable state. The content synchronization effect still checks whether the editor exists before updating its content.

Result: `/document-creation` loads with the rich text editor and formatting toolbar.

### Metadata spacing adjustment

File: `resources/js/Components/PaginatedDocument.tsx`

Changed `.sheet-meta` grid spacing from `16px` to `10px`. This brings metadata labels and their input fields closer together, including the copy recipients row. The label column remains `106px` wide.

### Library test fixture update

File: `tests/Feature/LibraryDatabaseSourceTest.php`

- Replaced manually created partial tables with `RefreshDatabase`, so the test uses the application's migrations, including template tables.
- Added `Storage::fake('local')` to isolate document asset writes.
- Retained the empty legacy database connection to detect accidental legacy type queries.
- Updated the obsolete seeded-ID assumption: the test now checks that legacy Others ID `19` maps to its actual new record and that legacy ID `4` still maps to Letter.

The previous fixture failed because it omitted `document_template_versions`, which the document type controller now queries.

## Verification recorded during the fix

| Check | Result |
| --- | --- |
| `npm run build` | Passed TypeScript, client build, and SSR build |
| React Hooks lint check on the editor | Passed after removing the nested hook |
| Document workflow tests | 22 passed, 319 assertions |
| `LibraryDatabaseSourceTest` | 1 passed, 12 assertions |
| `git diff --check` | Passed |
| Browser verification | Authenticated document creation page displayed the editor and formatting toolbar |
| Local migration status | Document template migration was already applied |

The 22 workflow tests covered `DocumentCreationOfficeApprovalTest`, `DynamicDocumentTemplatesTest`, `ApprovedDocumentReuseTest`, `ApprovedDocumentForwardingTest`, and `DocumentInlineEditingTest`.

These checks were performed during the editor fix. The later `16px` to `10px` spacing adjustment was inspected while preparing this summary but was not separately rebuilt or visually verified. No tests were rerun solely for this Markdown file.

## Database troubleshooting note

Historical logs contained an unknown-column error for `default_template_version_id`. The local migration status confirmed that `2026_10_14_000001_create_document_templates` had already run, so no database migration was needed for this fix. The current failure was the nested React hook.

For another environment running this commit, verify that the template migration is applied before using document creation. The sample template seeder supplies the optional sample layouts and assignments; document types without an assigned template use the NCIP Standard fallback.

## Status

The latest commit remains the WIP commit listed above. The editor fix, spacing adjustment, library test update, and this summary are working-tree changes and have not been committed by this task.

## Edit-mode pagination follow-up

The writing surface now uses fixed Letter-size sheets. Content flows onto another sheet when it reaches the footer area, and surplus sheets disappear when content is deleted. Each sheet has a header/footer area and page number; the formatting toolbar sits above the paper.

`DocumentPagination.ts` measures rendered text lines and table rows and inserts visual-only spacing through ProseMirror decorations. Wrapped paragraphs, lists, manual line breaks, and oversized table cells can continue onto subsequent sheets. These spacers are excluded from saved document JSON and undo history. `documentPaginationLayout.ts` shares the page geometry with the sheet component.

Verification:

- `npm run build`: TypeScript, client build, and SSR build passed. Vite still reports the unrelated unresolved login background image and bundle-size warning.
- `node --test tests/js/*.test.mjs`: 9 tests passed, including 5 pagination checks.
- Isolated Chrome fixture using the actual editor: long paragraphs, numbered lists with bold/italic text, manual line breaks, multi-row tables, and an oversized table cell showed no text overlapping header/footer areas.
- Pasting content added sheets; replacing it with a short paragraph removed sheets; undo restored the content and pagination.

The PDF preview remains the final print layout. Browser and PDF page boundaries can differ because they use different layout engines and the editor includes optional input fields. Metadata/CC fields are kept together; a single field taller than the usable page area is not split like rich-text body content.

## Template header repetition follow-up

- Edit mode now renders the selected template header on every sheet, including templates whose saved `repeat_header` value is false.
- PDF preview keeps the header fixed so it repeats on every page. The shared PDF view also applies this behavior to generated PDFs.
- Changed `.document-page-flow` top padding from 160px to 165px using the shared pagination constant, keeping overflow spacing consistent. Footer rendering is unchanged.

Verification: `npm run build` passed (existing image and bundle-size warnings remain); all 9 JavaScript tests passed; `DynamicDocumentTemplatesTest` passed with 14 tests and 139 assertions; `git diff --check` passed. No browser visual check was performed for this follow-up.

## Preview line-spacing follow-up

Rendered PDF measurements showed that 11pt Arial with `line-height:1.55` occupied 21.56825pt per line, rather than the browser's 17.05pt. Dompdf multiplies the CSS line height by its font metrics and font-height ratio, inflating the body enough to produce extra pages.

- `DocumentPdf` now normalizes that ratio using the loaded Arial metrics before page layout. The correction applies to current-content and submitted-version previews.
- PDF top margin now matches the editor's 165px; the header offset preserves its existing position on the paper.
- PDF heading, list, and table spacing now uses the editor's CSS values.
- `DocumentPdfLayoutTest` renders 55 lines with regular, bold, italic, and bold-italic text, verifies two pages, measures 17.05pt line spacing, and checks body lines stay within the header/footer boundaries. Passed: 1 test, 330 assertions.

Verification completed October 17, 2026 (Asia/Manila): `DynamicDocumentTemplatesTest` passed (14 tests, 139 assertions). After updating the existing margin assertion from the old 160px equivalent to 165px, `DocumentInlineEditingTest` and `DocumentPdfLayoutTest` passed together (6 tests, 375 assertions). `git diff --check` passed.

The user's live document was not visually compared because no browser connection was available. Metadata fields, table continuation rules, and the separate layout engines can still produce different page boundaries; this fixes the measured line-height inflation rather than guaranteeing identical pagination for every document.

## Filled metadata spacing follow-up — October 17, 2026

The PDF metadata previously used natural text heights with cell padding, while the editor uses minimum-height input boxes and 8px gaps. Updated only the PDF metadata rules to match 30px names, 22px designations, 31px single-line subject/date fields, and 8px field gaps. The space after DATE now matches the editor's 32px divider margin, 1px border, and 26px body margin. Empty optional fields retain their existing omission behavior.

A rendered-layout regression test uses the user's fully filled TO/THRU/ATTENTION/FROM/SUBJECT/DATE sample. It verifies each input box's height and vertical position and the body start at 534 CSS pixels from the top of the page. These expectations come from the editor's CSS and textarea sizing, not a live browser measurement. `DocumentPdfLayoutTest` and `DocumentInlineEditingTest` passed together: 7 tests, 398 assertions. `git diff --check` passed.
