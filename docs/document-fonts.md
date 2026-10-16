# Document fonts

The document editor uses locally installed Arial. Body paragraphs are 11 pt regular;
subject and metadata labels are 11 pt bold. Inline bold and italic use the matching
Arial faces at the paragraph's size.

PDF export embeds Arial from private server storage. Install all four licensed TTF
faces on each environment before generating PDFs:

```sh
php scripts/install-document-fonts.php /path/to/arial-font-directory
```

On macOS, omit the directory to use `/System/Library/Fonts/Supplemental`.
The installer also accepts Windows filenames `arial.ttf`, `arialbd.ttf`,
`ariali.ttf`, and `arialbi.ttf`.

Files are placed in `storage/app/private/fonts/arial`; font binaries are excluded
from Git and are not served as public web fonts. Preserve this directory on deploy,
and make `storage/fonts` writable for Dompdf's generated font cache. Browsers need
Arial installed locally for an exact match to the PDF.
