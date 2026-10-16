export const PAGE_HEIGHT = 1056; // Letter, at 96 CSS pixels per inch.
export const PAGE_GAP = 24;
export const PAGE_TOP = 165;
export const PAGE_BOTTOM = 168;
export const PAGE_STEP = PAGE_HEIGHT + PAGE_GAP;
export const PAGE_CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_TOP - PAGE_BOTTOM;

/** Additional space needed to keep a line/row out of the footer and next header. */
export function spaceBeforePageUnit(top: number, height: number): number {
    const page = Math.max(0, Math.floor(top / PAGE_STEP));
    const start = page * PAGE_STEP + PAGE_TOP;
    const end = page * PAGE_STEP + PAGE_HEIGHT - PAGE_BOTTOM;
    if (top < start) return start - top;
    if (top + height <= end + .5) return 0;
    // Oversized units are split by their lines instead of endlessly moving forward.
    if (height > PAGE_CONTENT_HEIGHT && top <= start + .5) return 0;
    return (page + 1) * PAGE_STEP + PAGE_TOP - top;
}

export function pagesForContent(bottom: number): number {
    return Math.max(1, Math.ceil((bottom + PAGE_BOTTOM + PAGE_GAP - .5) / PAGE_STEP));
}
