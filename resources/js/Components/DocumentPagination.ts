import { Extension } from '@tiptap/core';
import type { Node as DocumentNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { PAGE_CONTENT_HEIGHT, pagesForContent, spaceBeforePageUnit } from './documentPaginationLayout';
import { documentFontsReady } from './documentFonts';

const key = new PluginKey<DecorationSet>('documentPagination');
type Line = { top: number; height: number; position: number };

/** Find wrapped line starts without changing the document or splitting text marks. */
function paragraphLines(element: HTMLElement, view: EditorView, origin: number): Line[] {
    const lines: Line[] = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 23;
    let text: Node | null;
    while ((text = walker.nextNode())) {
        if (text.parentElement?.closest('.document-page-break')) continue;
        const length = text.textContent?.length ?? 0;
        if (!length) continue;
        const range = document.createRange();
        range.selectNodeContents(text);
        const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
        for (const rect of rects) {
            const top = rect.top - origin - Math.max(0, (lineHeight - rect.height) / 2);
            if (lines.some(line => Math.abs(line.top - top) < 2)) continue;
            let low = 0;
            let high = length - 1;
            while (low < high) {
                const middle = Math.floor((low + high) / 2);
                range.setStart(text, middle);
                range.setEnd(text, middle + 1);
                const character = range.getBoundingClientRect();
                if (character.top < rect.top - 2) low = middle + 1;
                else high = middle;
            }
            lines.push({ top, height: lineHeight, position: view.posAtDOM(text, low) });
        }
    }
    // Shift+Enter creates hard breaks; empty lines must also respect the page margins.
    element.querySelectorAll('br:not(.ProseMirror-trailingBreak)').forEach(br => {
        const range = document.createRange();
        range.selectNode(br);
        const rect = range.getBoundingClientRect();
        const top = rect.top - origin - Math.max(0, (lineHeight - rect.height) / 2);
        if (rect.height && !lines.some(line => Math.abs(line.top - top) < 2)) {
            lines.push({ top, height: lineHeight, position: view.posAtDOM(br, 0) });
        }
    });
    if (!lines.length) {
        lines.push({ top: element.getBoundingClientRect().top - origin, height: lineHeight, position: view.posAtDOM(element, 0) });
    }
    return lines.sort((a, b) => a.top - b.top);
}

function gapDecoration(position: number, height: number, rowColumns?: number): Decoration {
    return Decoration.widget(position, () => {
        const gap = document.createElement(rowColumns ? 'tr' : 'span');
        gap.className = rowColumns ? 'document-page-break document-row-break' : 'document-page-break';
        gap.contentEditable = 'false';
        gap.setAttribute('aria-hidden', 'true');
        if (rowColumns) {
            const cell = document.createElement('td');
            cell.colSpan = rowColumns;
            cell.style.height = `${height}px`;
            gap.appendChild(cell);
        } else {
            gap.style.height = `${height}px`;
        }
        return gap;
    }, { side: -1, key: `${position}:${height.toFixed(2)}:${rowColumns ?? 0}`, ignoreSelection: true });
}

/** Visual-only page breaks: saved JSON and undo history contain only document content. */
export const DocumentPagination = Extension.create<{ onPageCount: (pages: number) => void }>({
    name: 'documentPagination',
    addOptions: () => ({ onPageCount: () => {} }),
    addProseMirrorPlugins() {
        const onPageCount = this.options.onPageCount;
        return [new Plugin<DecorationSet>({
            key,
            state: {
                init: () => DecorationSet.empty,
                apply(transaction, current) {
                    return transaction.getMeta(key) ?? current.map(transaction.mapping, transaction.doc);
                },
            },
            props: { decorations: state => key.getState(state) },
            view(view) {
                let frame = 0;
                let destroyed = false;
                let signature = '';
                let root: HTMLElement | null = null;
                const measure = () => {
                    frame = 0;
                    if (destroyed || view.composing) return;
                    if (!root) {
                        root = view.dom.closest<HTMLElement>('.document-editor-sheet');
                        if (!root) return;
                        observer.observe(view.dom);
                        root.querySelectorAll('[data-page-field], [data-page-cc]').forEach(element => observer.observe(element));
                        root.addEventListener('input', schedule);
                    }
                    root.classList.add('measuring-document-pages');
                    const origin = root.getBoundingClientRect().top;
                    const decorations: Decoration[] = [];
                    const breaks: string[] = [];
                    let offset = 0;
                    const addGap = (position: number, height: number, columns?: number) => {
                        if (height < .5) return;
                        decorations.push(gapDecoration(position, height, columns));
                        breaks.push(`${position}:${height.toFixed(2)}:${columns ?? 0}`);
                    };
                    const metadata = root.querySelectorAll<HTMLElement>('[data-page-field]');
                    const bodySection = root.querySelector<HTMLElement>('.sheet-body');
                    const beforeBody: HTMLElement[] = [];
                    const afterBody: HTMLElement[] = [];
                    metadata.forEach(field => {
                        if (bodySection && (bodySection.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING)) afterBody.push(field);
                        else beforeBody.push(field);
                    });
                    const fieldOffsets: [HTMLElement, number][] = [];
                    const placeFields = (fields: HTMLElement[]) => fields.forEach(field => {
                        const bounds = field.getBoundingClientRect();
                        const gap = spaceBeforePageUnit(bounds.top - origin + offset, bounds.height);
                        fieldOffsets.push([field, gap]);
                        offset += gap;
                    });
                    placeFields(beforeBody);
                    const flowText = (node: DocumentNode, position: number, initialOffset: number): number => {
                        let localOffset = initialOffset;
                        const element = view.nodeDOM(position);
                        if (!(element instanceof HTMLElement)) return localOffset;
                        for (const line of paragraphLines(element, view, origin)) {
                            const gap = spaceBeforePageUnit(line.top + localOffset, line.height);
                            addGap(line.position, gap);
                            localOffset += gap;
                        }
                        return localOffset;
                    };
                    view.state.doc.descendants((node, position) => {
                        if (node.type.name === 'tableRow') {
                            const element = view.nodeDOM(position);
                            if (!(element instanceof HTMLElement)) return false;
                            const bounds = element.getBoundingClientRect();
                            if (bounds.height <= PAGE_CONTENT_HEIGHT) {
                                const gap = spaceBeforePageUnit(bounds.top - origin + offset, bounds.height);
                                const resolved = view.state.doc.resolve(position);
                                const table = Array.from({ length: resolved.depth }, (_, index) => resolved.node(resolved.depth - index))
                                    .find(parent => parent.type.name === 'table');
                                addGap(position, gap, table ? TableMap.get(table).width : node.childCount);
                                offset += gap;
                            } else {
                                // Tall cells can span several sheets; each column flows from the same row origin.
                                let rowOffset = offset;
                                node.forEach((cell, cellOffset) => {
                                    let columnOffset = offset;
                                    cell.forEach((paragraph, paragraphOffset) => {
                                        columnOffset = flowText(paragraph, position + 2 + cellOffset + paragraphOffset, columnOffset);
                                    });
                                    rowOffset = Math.max(rowOffset, columnOffset);
                                });
                                offset = rowOffset;
                            }
                            return false;
                        }
                        if (node.isTextblock) {
                            offset = flowText(node, position, offset);
                            return false;
                        }
                    });
                    placeFields(afterBody);
                    const cc = root.querySelector<HTMLElement>('[data-page-cc]');
                    if (cc) {
                        const bounds = cc.getBoundingClientRect();
                        const gap = spaceBeforePageUnit(bounds.top - origin + offset, bounds.height);
                        fieldOffsets.push([cc, gap]);
                        offset += gap;
                    }
                    const flow = root.querySelector<HTMLElement>('.document-page-flow');
                    const bottom = (flow?.getBoundingClientRect().bottom ?? view.dom.getBoundingClientRect().bottom) - origin + offset;
                    root.classList.remove('measuring-document-pages');
                    fieldOffsets.forEach(([field, gap]) => field.style.setProperty('--field-page-gap', `${gap}px`));
                    const nextSignature = breaks.join('|');
                    if (nextSignature !== signature || decorations.length !== key.getState(view.state)?.find().length) {
                        signature = nextSignature;
                        const transaction = view.state.tr.setMeta(key, DecorationSet.create(view.state.doc, decorations)).setMeta('addToHistory', false);
                        if (view.hasFocus()) transaction.scrollIntoView();
                        view.dispatch(transaction);
                    }
                    onPageCount(pagesForContent(bottom));
                };
                const schedule = () => {
                    if (!destroyed && !frame) frame = requestAnimationFrame(measure);
                };
                const observer = new ResizeObserver(schedule);
                view.dom.addEventListener('compositionend', schedule);
                void documentFontsReady().then(schedule).catch(() => {});
                schedule();
                return {
                    update(updated, previous) {
                        if (!updated.state.doc.eq(previous.doc)) schedule();
                    },
                    destroy() {
                        destroyed = true;
                        cancelAnimationFrame(frame);
                        observer.disconnect();
                        root?.removeEventListener('input', schedule);
                        view.dom.removeEventListener('compositionend', schedule);
                    },
                };
            },
        })];
    },
});
