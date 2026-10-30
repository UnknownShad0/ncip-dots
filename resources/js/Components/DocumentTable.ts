import { Table } from '@tiptap/extension-table';
import { Plugin } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';
import { normalizeColumnWidths } from './documentTableSizing';

/** Persist a consistent set of widths in every row after resize, paste, or column edits. */
export const DocumentTable = Table.extend({
    addProseMirrorPlugins() {
        return [
            ...(this.parent?.() ?? []),
            new Plugin({
                appendTransaction(transactions, _oldState, state) {
                    if (!transactions.some(transaction => transaction.docChanged)) return null;
                    const transaction = state.tr;
                    state.doc.descendants((table, position) => {
                        if (table.type.name !== 'table' || !table.firstChild) return;
                        const map = TableMap.get(table);
                        const desired = Array(map.width).fill(0) as number[];
                        const cellPositions = [...new Set(map.map)];
                        cellPositions.forEach(cellPosition => {
                            const cell = table.nodeAt(cellPosition);
                            if (!cell) return;
                            const bounds = map.findCell(cellPosition);
                            const current = cell.attrs.colwidth as number[] | null;
                            for (let column = bounds.left; column < bounds.right; column++) {
                                const width = current?.[column - bounds.left];
                                if (!desired[column] && width) desired[column] = width;
                            }
                        });
                        const widths = normalizeColumnWidths(desired);
                        cellPositions.forEach(cellPosition => {
                            const cell = table.nodeAt(cellPosition);
                            if (!cell) return;
                            const bounds = map.findCell(cellPosition);
                            const colwidth = widths.slice(bounds.left, bounds.right);
                            if (JSON.stringify(cell.attrs.colwidth) !== JSON.stringify(colwidth)) {
                                transaction.setNodeMarkup(position + 1 + cellPosition, undefined, { ...cell.attrs, colwidth });
                            }
                        });
                        return false;
                    });
                    return transaction.docChanged ? transaction : null;
                },
            }),
        ];
    },
});
