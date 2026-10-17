# Shared document rendering

Document creation, preview, printing, and generated attachments now share
`PaginatedDocument`, `RichDocumentEditor`, and `DocumentPagination`. The PDF service
loads a self-contained build of those React components in headless Chrome/Chromium.
It waits for the same private fonts, images, and pagination to settle, then freezes
the measured sheets into Letter-size page slices. Printing does not paginate the
text again or include the editor's 24px gaps between sheets.

Blank optional fields and CC lines retain their space in output, so the preview
matches the editor. Placeholder prompts and editing controls are excluded from PDF
output. The existing Blade/Dompdf HTML helper remains for legacy content inspection;
it is no longer used by document-creation preview or attachment generation.

## Requirements

- Node.js 18+ available to PHP (the application frontend toolchain may require newer Node).
- Google Chrome or Chromium installed on the application server.
- The four licensed Arial files described in `document-fonts.md`.
- Build assets with `npm run build` on deploy, including `public/build/document-renderer.js`
  and `document-renderer.css`.
- Write access to `storage/app/private/document-renderer` for temporary files.

Optional environment settings:

```dotenv
DOCUMENT_PDF_BROWSER_BINARY=/usr/bin/chromium
DOCUMENT_PDF_NODE_BINARY=/usr/bin/node
DOCUMENT_PDF_TIMEOUT=45
DOCUMENT_PDF_SANDBOX=true
```

Common Chrome/Chromium locations are auto-detected, including macOS Google Chrome.
The browser uses a separate temporary profile and communicates through inherited
pipes; it never uses the user's running browser or application session. Rendering
has no external network access. Template images and fonts are embedded by the
server after its normal validation/access checks. Temporary files are deleted after
each render. The Chromium sandbox stays enabled by default.

`npm run dev` builds the renderer at startup and rebuilds it when shared component
files change. `npm run build:document` rebuilds only that bundle. Restart an already
running Vite dev server after installing this workflow so the watcher is active.

Missing assets, fonts, Node, or Chromium cause an explicit rendering error. There is
no silent fallback to Dompdf, because it would reintroduce different page breaks.

## Verification

`DocumentPdfLayoutTest` renders editable and output modes in Chromium and compares
every measured metadata box, body text rectangle, page spacer, and sheet count. It
also checks the actual PDF page objects. The renderer verifies that the frozen
print sheets retain the original text rectangles before exporting.

The editor and server should run compatible Chromium versions for the closest
browser-level parity. This workflow eliminates the separate Dompdf layout engine;
it does not claim identical native font rasterization across every browser or OS.
Previously stored PDF attachments are not regenerated automatically.
