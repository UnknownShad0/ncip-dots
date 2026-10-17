# Document fonts

The document editor and PDF renderer use the same server-installed Arial files
under the CSS family `Document Arial`. Body paragraphs are 11 pt regular;
subject and metadata labels are 11 pt bold. Inline bold and italic use the matching
Arial faces at the paragraph's size.

PDF export embeds Arial from private server storage. The authenticated editor
loads those same files, so it does not depend on a user's installed font version.
Install all four licensed TTF faces on each environment before editing or generating
documents. The font license must permit this authenticated browser use and PDF embedding:

```sh
php scripts/install-document-fonts.php /path/to/arial-font-directory
```

On macOS, omit the directory to use `/System/Library/Fonts/Supplemental`.
The installer also accepts Windows filenames `arial.ttf`, `arialbd.ttf`,
`ariali.ttf`, and `arialbi.ttf`.

Files are placed in `storage/app/private/fonts/arial`; font binaries are excluded
from Git. Preserve this directory on deploy. Do not copy these fonts into `public`.

The editor loads four authenticated font routes, each with a fixed filename mapping:

| Route | Private file |
| --- | --- |
| `/document-fonts/regular` | `Arial.ttf` |
| `/document-fonts/bold` | `Arial-Bold.ttf` |
| `/document-fonts/italic` | `Arial-Italic.ttf` |
| `/document-fonts/bold-italic` | `Arial-BoldItalic.ttf` |

These routes require the application's authenticated session, return `font/ttf`
with private browser caching, and return 404 for unknown faces or missing files.
The font CSS intentionally has no `local()` source. Layout measurement and PDF
rendering must wait for the document fonts to finish loading.
