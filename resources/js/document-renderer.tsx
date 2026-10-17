import { createRoot } from 'react-dom/client';
import DocumentPaper from './Components/PaginatedDocument';
import { PAGE_STEP } from './Components/documentPaginationLayout';
import './document-renderer.css';

declare global {
    interface Window {
        __DOCUMENT_CONTENT__: Record<string, unknown>;
        __DOCUMENT_TEST_EDIT__?: boolean;
        __DOCUMENT_RENDER_RESULT__?: { pages?: number; geometry?: unknown; error?: string };
        __DOCUMENT_VERIFY_PRINT__?: () => { lines: number; error?: string };
    }
}

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

function geometry(sheet: HTMLElement) {
    const origin = sheet.getBoundingClientRect();
    const rect = (box: DOMRect) => ({ x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height });
    const fields = Array.from(sheet.querySelectorAll<HTMLTextAreaElement>('textarea')).map(field => ({
        label: field.getAttribute('aria-label'), value: field.value, ...rect(field.getBoundingClientRect()),
    }));
    const text: ReturnType<typeof rect>[] = [];
    const walker = document.createTreeWalker(sheet.querySelector('.document-rich-text')!, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        if (!node.textContent || node.parentElement?.closest('.document-page-break')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        text.push(...Array.from(range.getClientRects()).filter(box => box.width > 0).map(rect));
    }
    const breaks = Array.from(sheet.querySelectorAll('.document-page-break')).map(element => rect(element.getBoundingClientRect()));
    return { width: origin.width, height: origin.height, fields, text, breaks };
}

/** Freeze the measured sheet; do not ask the print engine to paginate its flow again. */
function printPages(sheet: HTMLElement, pages: number) {
    const output = document.createElement('main');
    output.id = 'document-print-pages';
    const originalFields = Array.from(sheet.querySelectorAll<HTMLTextAreaElement | HTMLSelectElement>('textarea, select'));
    for (let page = 0; page < pages; page++) {
        const wrapper = document.createElement('section');
        wrapper.className = 'document-print-page';
        const clone = sheet.cloneNode(true) as HTMLElement;
        clone.removeAttribute('aria-label');
        clone.style.position = 'absolute';
        clone.style.top = `${-page * PAGE_STEP}px`;
        clone.style.left = '0';
        // Native form controls print differently across engines. Freeze their value
        // into an ordinary block with the exact measured box and typography.
        clone.querySelectorAll<HTMLTextAreaElement | HTMLSelectElement>('textarea, select').forEach((field, index) => {
            const original = originalFields[index];
            const style = getComputedStyle(original);
            const block = document.createElement('div');
            block.className = field.className;
            block.style.cssText = field.style.cssText;
            for (const property of ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height',
                'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'text-align', 'letter-spacing']) {
                block.style.setProperty(property, style.getPropertyValue(property));
            }
            block.style.height = `${original.getBoundingClientRect().height}px`;
            block.style.background = 'transparent';
            block.textContent = original instanceof HTMLSelectElement ? original.selectedOptions[0]?.text ?? '' : original.value;
            field.replaceWith(block);
        });
        clone.querySelectorAll('[contenteditable]').forEach(element => element.removeAttribute('contenteditable'));
        clone.querySelectorAll('.document-body-editor').forEach(element => element.removeAttribute('data-placeholder'));
        clone.querySelectorAll('.document-page').forEach(element => (element as HTMLElement).style.boxShadow = 'none');
        wrapper.appendChild(clone);
        output.appendChild(wrapper);
    }
    document.body.appendChild(output);
}

function verifyPrintedText(expected: ReturnType<typeof geometry>) {
    const actual: typeof expected.text = [];
    document.querySelectorAll<HTMLElement>('.document-print-page').forEach((page, index) => {
        const origin = page.getBoundingClientRect();
        const walker = document.createTreeWalker(page.querySelector('.document-rich-text')!, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
            if (!node.textContent || node.parentElement?.closest('.document-page-break')) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const box of Array.from(range.getClientRects())) {
                if (box.width <= 0 || box.bottom <= origin.top || box.top >= origin.bottom) continue;
                actual.push({ x: box.x - origin.x, y: box.y - origin.y + index * PAGE_STEP, width: box.width, height: box.height });
            }
        }
    });
    const ordered = (rectangles: typeof actual) => [...rectangles].sort((a, b) => a.y - b.y || a.x - b.x || a.width - b.width);
    const source = ordered(expected.text);
    const matches = actual.length === source.length && ordered(actual).every((rect, index) =>
        (['x', 'y', 'width', 'height'] as const).every(key => Math.abs(rect[key] - source[index][key]) < .1));
    return { lines: actual.length, ...(matches ? {} : { error: 'The frozen print sheets changed the document text layout.' }) };
}

async function render() {
    createRoot(document.getElementById('document-renderer-root')!).render(
        <DocumentPaper content={window.__DOCUMENT_CONTENT__} onChange={() => {}} output={!window.__DOCUMENT_TEST_EDIT__} />,
    );
    let sheet: HTMLElement | null = null;
    const deadline = performance.now() + 20000;
    while (!sheet?.querySelector('.document-rich-text')) {
        if (performance.now() > deadline) throw new Error('Document editor did not initialize.');
        await nextFrame();
        sheet = document.querySelector<HTMLElement>('.document-editor-sheet');
    }
    // A font/image settling after pagination can change widths and sheet count.
    await Promise.all([
        ...['normal 400', 'normal 700', 'italic 400', 'italic 700'].map(face => document.fonts.load(`${face} 11pt "Document Arial"`)),
        ...Array.from(sheet.querySelectorAll('img')).map(image => image.decode()),
    ]);
    await document.fonts.ready;
    let previous = '';
    let stable = 0;
    let measured = geometry(sheet);
    while (stable < 5) {
        if (performance.now() > deadline) throw new Error('Document pagination did not settle.');
        await nextFrame();
        measured = geometry(sheet);
        const signature = JSON.stringify(measured);
        stable = signature === previous ? stable + 1 : 0;
        previous = signature;
    }
    const pages = Number(sheet.dataset.pageCount);
    if (!Number.isInteger(pages) || pages < 1 || pages > 200) throw new Error('Invalid document page count.');
    printPages(sheet, pages);
    window.__DOCUMENT_VERIFY_PRINT__ = () => verifyPrintedText(measured);
    await nextFrame();
    window.__DOCUMENT_RENDER_RESULT__ = { pages, geometry: measured };
}

void render().catch(error => {
    window.__DOCUMENT_RENDER_RESULT__ = { error: error instanceof Error ? error.message : String(error) };
});
