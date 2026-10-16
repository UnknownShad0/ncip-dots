// Letter paper minus the document's two 0.65-inch margins, at CSS's 96 dpi.
export const DOCUMENT_TABLE_WIDTH = 691;
export const MIN_COLUMN_WIDTH = 40;

/** Keep columns inside the page, with enough room for a short number and padding. */
export function normalizeColumnWidths(widths: number[], available = DOCUMENT_TABLE_WIDTH): number[] {
    if (!widths.length) return [];
    const total = Math.max(Math.round(available), widths.length * MIN_COLUMN_WIDTH);
    const desired = widths.map(width => Number.isFinite(width) && width > 0 ? width : total / widths.length);
    const result = Array(widths.length).fill(0) as number[];
    let remaining = total;
    let pending = desired.map((_, index) => index);
    while (pending.length) {
        const sum = pending.reduce((value, index) => value + desired[index], 0);
        const small = pending.filter(index => desired[index] / sum * remaining < MIN_COLUMN_WIDTH);
        if (!small.length) {
            pending.forEach(index => { result[index] = Math.floor(desired[index] / sum * remaining + 1e-9); });
            break;
        }
        small.forEach(index => { result[index] = MIN_COLUMN_WIDTH; remaining -= MIN_COLUMN_WIDTH; });
        pending = pending.filter(index => !small.includes(index));
    }
    // Assign rounding remainder to the largest column instead of the numbering column.
    const largest = result.indexOf(Math.max(...result));
    result[largest] += total - result.reduce((sum, width) => sum + width, 0);
    return result;
}

export function fitColumnWidths(columns: string[][], measure: (text: string) => number): number[] {
    const preferred = columns.map(cells => Math.max(MIN_COLUMN_WIDTH,
        ...cells.flatMap(text => text.split('\n').map(line => Math.min(420, measure(line) + 20)))));
    // Keep short columns compact; give spare room to columns with longer content.
    const extra = Math.max(0, DOCUMENT_TABLE_WIDTH - preferred.reduce((sum, width) => sum + width, 0));
    const weights = preferred.map(width => Math.max(0, width - MIN_COLUMN_WIDTH));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    return normalizeColumnWidths(preferred.map((width, index) => width + extra * (weightSum ? weights[index] / weightSum : 1 / preferred.length)));
}
