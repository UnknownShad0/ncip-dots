import assert from 'node:assert/strict';
import test from 'node:test';
import { fitColumnWidths, normalizeColumnWidths, DOCUMENT_TABLE_WIDTH } from '../../resources/js/Components/documentTableSizing.ts';

test('fit keeps a numbering column compact and gives the description more space', () => {
    const widths = fitColumnWidths([['#', '1', '2', '100'], ['Description', 'Detailed explanation of the request and its supporting documents']], text => text.length * 8);
    assert.ok(widths[0] < 70);
    assert.ok(widths[1] > 600);
    assert.equal(widths.reduce((sum, width) => sum + width, 0), DOCUMENT_TABLE_WIDTH);
});

test('resized, pasted and newly added columns stay inside the page with usable minimums', () => {
    for (const input of [[40, 2000], [0, 600, 0], [1, 1, 1, 1, 1, 1], [NaN, Infinity], [50, 641]]) {
        const widths = normalizeColumnWidths(input);
        assert.ok(widths.every(width => Number.isInteger(width) && width >= 40));
        assert.equal(widths.reduce((sum, width) => sum + width, 0), DOCUMENT_TABLE_WIDTH);
        assert.deepEqual(normalizeColumnWidths(widths), widths);
    }
});

test('equal widths differ by at most rounding pixels', () => {
    const widths = normalizeColumnWidths([1, 1, 1]);
    assert.ok(Math.max(...widths) - Math.min(...widths) <= 2);
});

test('repeated saves do not shrink a resized column through floating-point rounding', () => {
    for (let first = 40; first <= DOCUMENT_TABLE_WIDTH - 40; first++) {
        const widths = [first, DOCUMENT_TABLE_WIDTH - first];
        assert.deepEqual(normalizeColumnWidths(widths), widths);
    }
});
