import { Table } from '@tiptap/extension-table';
import { Plugin } from '@tiptap/pm/state';
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
                        const widths = normalizeColumnWidths(Array.from({ length: table.firstChild.childCount },
                            (_, index) => table.firstChild!.child(index).attrs.colwidth?.[0] ?? 0));
                        table.forEach((row, rowOffset) => row.forEach((cell, cellOffset, index) => {
                            if (cell.attrs.colspan !== 1 || widths[index] === undefined) return;
                            if (cell.attrs.colwidth?.[0] !== widths[index]) {
                                transaction.setNodeMarkup(position + 2 + rowOffset + cellOffset, undefined,
                                    { ...cell.attrs, colwidth: [widths[index]] });
                            }
                        }));
                        return false;
                    });
                    return transaction.docChanged ? transaction : null;
                },
            }),
        ];
    },
});
