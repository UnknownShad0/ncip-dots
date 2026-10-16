import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_TOP, PAGE_HEIGHT, PAGE_BOTTOM, PAGE_STEP, spaceBeforePageUnit, pagesForContent } from '../../resources/js/Components/documentPaginationLayout.ts';

test('a line that fits stays on its sheet; overflow continues after the next header', () => {
    const end = PAGE_HEIGHT - PAGE_BOTTOM;
    assert.equal(spaceBeforePageUnit(end - 23, 23), 0);
    const top = end - 10;
    assert.equal(top + spaceBeforePageUnit(top, 23), PAGE_STEP + PAGE_TOP);
});

test('a table row moves as a unit and stays within the next sheet', () => {
    const top = 840;
    const next = top + spaceBeforePageUnit(top, 100);
    assert.equal(next, PAGE_STEP + PAGE_TOP);
    assert.equal(spaceBeforePageUnit(next, 100), 0);
});

test('content in a page gap is moved below the header', () => {
    for (const top of [1060, 1080, 1190]) {
        assert.equal(top + spaceBeforePageUnit(top, 23), PAGE_STEP + PAGE_TOP);
    }
});

test('page count shrinks again after deleting overflow, without a trailing blank page', () => {
    assert.equal(pagesForContent(4 * PAGE_STEP + 700), 5);
    assert.equal(pagesForContent(PAGE_HEIGHT - PAGE_BOTTOM), 1);
    assert.equal(pagesForContent(700), 1);
});

test('many lines flow across pages without entering a header or footer', () => {
    let offset = 0;
    for (let line = 0; line < 500; line++) {
        const top = 700 + line * 23 + offset;
        offset += spaceBeforePageUnit(top, 23);
        const withinPage = (700 + line * 23 + offset) % PAGE_STEP;
        assert.ok(withinPage >= PAGE_TOP);
        assert.ok(withinPage + 23 <= PAGE_HEIGHT - PAGE_BOTTOM + .5);
    }
});
