import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import { TableMap } from '@tiptap/pm/tables';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2, Table2 } from 'lucide-react';
import { DocumentTable } from './DocumentTable';
import { fitColumnWidths, normalizeColumnWidths, MIN_COLUMN_WIDTH } from './documentTableSizing';
import { DocumentPagination } from './DocumentPagination';

export function plainTextDocument(text: string): JSONContent {
    return { type: 'doc', content: (text || '').split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
}

export default function RichDocumentEditor({ value, plainText, onChange, disabled = false, toolbarTarget, onPageCount, placeholder, hideToolbar = false }: {
    value?: JSONContent; plainText: string; disabled?: boolean; onChange: (document: JSONContent, text: string) => void;
    toolbarTarget?: HTMLElement | null; onPageCount?: (pages: number) => void; placeholder?: string; hideToolbar?: boolean;
}) {
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);
    const [tableToolbarPosition, setTableToolbarPosition] = useState<{ top: number; left: number; width: number } | null>(null);
    const menu = useRef<HTMLDetailsElement>(null);
    const editorShell = useRef<HTMLDivElement>(null);
    const tableToolbarRef = useRef<HTMLDivElement>(null);
    const activeTableWrapper = useRef<{ element: HTMLElement; paddingBottom: string } | null>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onPageCountRef = useRef(onPageCount);
    onPageCountRef.current = onPageCount;
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] }, link: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false }),
            TableKit.configure({ table: false, tableCell: false, tableHeader: false }),
            DocumentTable.configure({ resizable: true, cellMinWidth: MIN_COLUMN_WIDTH, lastColumnResizable: false }),
            TableCell.extend({ content: 'paragraph+' }), TableHeader.extend({ content: 'paragraph+' }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            DocumentPagination.configure({ onPageCount: pages => onPageCountRef.current?.(pages) }),
        ],
        content: value ?? plainTextDocument(plainText),
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        editorProps: { attributes: { 'aria-label': 'Document body', 'aria-placeholder': placeholder ?? '', role: 'textbox', 'aria-multiline': 'true', class: 'document-rich-text' } },
        onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON(), editor.getText()),
    });
    useEffect(() => {
        if (!editor) return;
        const next = value ?? plainTextDocument(plainText);
        if (JSON.stringify(next) !== JSON.stringify(editor.getJSON())) editor.commands.setContent(next, { emitUpdate: false });
    }, [editor, value, plainText]);
    useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
    useEffect(() => {
        if (!editor) return;
        let frame = 0;
        const clearActiveTable = () => {
            const active = activeTableWrapper.current;
            if (active) active.element.style.paddingBottom = active.paddingBottom;
            activeTableWrapper.current = null;
        };
        const update = () => {
            frame = 0;
            const shell = editorShell.current;
            if (!shell || !editor.view.hasFocus() || !editor.isActive('table')) {
                clearActiveTable();
                setTableToolbarPosition(null);
                return;
            }
            const selection = editor.state.selection.$from;
            const depth = Array.from({ length: selection.depth }, (_, index) => index + 1)
                .find(level => selection.node(level).type.name === 'table');
            if (!depth) {
                clearActiveTable();
                setTableToolbarPosition(null);
                return;
            }
            const dom = editor.view.nodeDOM(selection.before(depth));
            if (!(dom instanceof HTMLElement)) {
                clearActiveTable();
                setTableToolbarPosition(null);
                return;
            }
            const wrapper = dom.matches('.tableWrapper') ? dom : dom.closest<HTMLElement>('.tableWrapper') ?? dom;
            const tableElement = wrapper.matches('table') ? wrapper : wrapper.querySelector<HTMLElement>('table') ?? wrapper;
            if (activeTableWrapper.current?.element !== wrapper) {
                clearActiveTable();
                activeTableWrapper.current = { element: wrapper, paddingBottom: wrapper.style.paddingBottom };
                wrapper.style.paddingBottom = '64px';
            }
            const shellBounds = shell.getBoundingClientRect();
            const tableBounds = tableElement.getBoundingClientRect();
            const scale = shell.offsetWidth > 0 ? shellBounds.width / shell.offsetWidth : 1;
            setTableToolbarPosition({
                top: (tableBounds.bottom - shellBounds.top) / scale + 6,
                left: (tableBounds.left - shellBounds.left) / scale,
                width: tableBounds.width / scale,
            });
        };
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(update);
        };
        const observer = new ResizeObserver(schedule);
        observer.observe(editor.view.dom);
        editor.on('selectionUpdate', schedule);
        editor.on('transaction', schedule);
        editor.on('focus', schedule);
        editor.on('blur', schedule);
        window.addEventListener('resize', schedule);
        schedule();
        return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            editor.off('selectionUpdate', schedule);
            editor.off('transaction', schedule);
            editor.off('focus', schedule);
            editor.off('blur', schedule);
            window.removeEventListener('resize', schedule);
            clearActiveTable();
        };
    }, [editor]);
    useEffect(() => {
        const toolbar = tableToolbarRef.current;
        if (!toolbar || !tableToolbarPosition) return;
        const reserveToolbarSpace = () => {
            const shell = editorShell.current;
            const active = activeTableWrapper.current;
            if (!shell || !active) return;
            const shellBounds = shell.getBoundingClientRect();
            const scale = shell.offsetWidth > 0 ? shellBounds.width / shell.offsetWidth : 1;
            active.element.style.paddingBottom = `${Math.ceil(toolbar.getBoundingClientRect().height / scale + 12)}px`;
        };
        const observer = new ResizeObserver(reserveToolbarSpace);
        observer.observe(toolbar);
        reserveToolbarSpace();
        return () => observer.disconnect();
    }, [tableToolbarPosition]);
    if (!editor) return <p className="text-sm text-muted">Loading document editor…</p>;
    const button = (label: string, Icon: typeof Bold, action: () => void, active = false, disabled = false) => (
        <button key={label} type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled}
            onMouseDown={event => event.preventDefault()} onClick={action}
            className={`rounded p-2 disabled:opacity-30 ${active ? 'bg-primary text-white' : 'text-foreground hover:bg-secondary'}`}><Icon size={17} /></button>
    );
    const inTable = editor.isActive('table');
    const selection = editor.state.selection.$from;
    const table = Array.from({ length: selection.depth }, (_, i) => selection.node(i + 1)).find(node => node.type.name === 'table');
    const tableRows = table?.childCount ?? 0;
    const tableColumns = table ? TableMap.get(table).width : 0;
    const sizeColumns = (fit: boolean) => {
        if (!table || disabled) return;
        const depth = Array.from({ length: selection.depth }, (_, i) => i + 1).find(level => selection.node(level) === table)!;
        const map = TableMap.get(table);
        const columns = Array.from({ length: tableColumns }, () => [] as string[]);
        [...new Set(map.map)].forEach(cellPosition => {
            const cell = table.nodeAt(cellPosition);
            if (!cell) return;
            const bounds = map.findCell(cellPosition);
            for (let column = bounds.left; column < bounds.right; column++) {
                columns[column].push(cell.textBetween(0, cell.content.size, '\n'));
            }
        });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) context.font = `700 ${getComputedStyle(editor.view.dom).fontSize} "Document Arial"`;
        const widths = fit ? fitColumnWidths(columns, text => context?.measureText(text).width ?? text.length * 8) : normalizeColumnWidths(columns.map(() => 1));
        const transaction = editor.state.tr;
        const position = selection.before(depth);
        [...new Set(map.map)].forEach(cellPosition => {
            const cell = table.nodeAt(cellPosition);
            if (!cell) return;
            const bounds = map.findCell(cellPosition);
            transaction.setNodeMarkup(position + 1 + cellPosition, undefined, {
                ...cell.attrs,
                colwidth: widths.slice(bounds.left, bounds.right),
            });
        });
        editor.view.dispatch(transaction);
        editor.view.focus();
    };
    const formattingToolbar = <div role="toolbar" aria-label="Document formatting" className="flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-surface p-2 shadow-sm print:hidden">
            {button('Bold (Ctrl/Cmd+B)', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
            {button('Italic (Ctrl/Cmd+I)', Italic, () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
            {button('Underline (Ctrl/Cmd+U)', Underline, () => editor.chain().focus().toggleUnderline().run(), editor.isActive('underline'))}
            <select disabled={inTable} aria-label="Paragraph style" className="rounded border-border py-1 text-xs" value={editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : 'paragraph'} onChange={event => {
                if (event.target.value === 'paragraph') editor.chain().focus().setParagraph().run();
                else editor.chain().focus().setHeading({ level: Number(event.target.value) as 2 | 3 }).run();
            }}><option value="paragraph">Normal text</option><option value="2">Heading</option><option value="3">Subheading</option></select>
            {button('Bullet list', List, () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'), inTable)}
            {button('Numbered list', ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'), inTable)}
            {(['left', 'center', 'right', 'justify'] as const).map((align, index) => button(`Align ${align}`, [AlignLeft, AlignCenter, AlignRight, AlignJustify][index], () => editor.chain().focus().setTextAlign(align).run(), editor.isActive({ textAlign: align })))}
            {button('Undo', Undo2, () => editor.chain().focus().undo().run(), false, !editor.can().undo())}
            {button('Redo', Redo2, () => editor.chain().focus().redo().run(), false, !editor.can().redo())}
            <details ref={menu} className="relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-2 py-1.5 text-xs text-foreground hover:bg-secondary"><Table2 size={16} />Insert table</summary>
                <div className="absolute left-0 top-full z-20 mt-2 w-56 space-y-3 rounded-lg border border-border bg-surface p-4 shadow-lg">
                    <label className="block text-xs text-foreground">Rows<input type="number" min={1} max={20} value={rows} onChange={event => setRows(Number(event.target.value))} className="mt-1 w-full rounded border-border text-sm" /></label>
                    <label className="block text-xs text-foreground">Columns<input type="number" min={1} max={6} value={cols} onChange={event => setCols(Number(event.target.value))} className="mt-1 w-full rounded border-border text-sm" /></label>
                    <button type="button" disabled={inTable || rows < 1 || rows > 20 || cols < 1 || cols > 6 || !Number.isInteger(rows) || !Number.isInteger(cols)} className="dots-button-primary w-full disabled:opacity-40" onClick={() => {
                        editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
                        if (menu.current) menu.current.open = false;
                    }}>Insert table</button>
                </div>
            </details>
        </div>;
    const tableButtonClass = 'whitespace-nowrap rounded border border-border bg-surface px-2 py-1 text-foreground hover:bg-background disabled:opacity-30';
    const tableToolbar = inTable && tableToolbarPosition && !hideToolbar && <div
        ref={tableToolbarRef}
        role="toolbar"
        aria-label="Table editing"
        className="document-table-toolbar absolute z-20 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-2 text-xs shadow-sm print:hidden"
        style={tableToolbarPosition}
    >
        {/* <span className="px-1 font-semibold text-foreground">Table</span> */}
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary p-1" aria-label="Table sizing">
            <button type="button" disabled={disabled} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={() => sizeColumns(true)}>Fit content</button>
            <button type="button" disabled={disabled} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={() => sizeColumns(false)}>Equal widths</button>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary p-1" aria-label="Table cells">
            <button type="button" disabled={disabled || !editor.can().mergeCells()} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().mergeCells().run()}>Merge</button>
            <button type="button" disabled={disabled || !editor.can().splitCell()} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().splitCell().run()}>Split cell</button>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary p-1" aria-label="Table rows">
            <span className="px-1 text-muted">Rows</span>
            {[
                ['Add row above', '+ ↑', () => editor.chain().focus().addRowBefore().run(), tableRows >= 200],
                ['Add row below', '+ ↓', () => editor.chain().focus().addRowAfter().run(), tableRows >= 200],
                ['Delete row', '−', () => editor.chain().focus().deleteRow().run(), false],
            ].map(([label, shortLabel, action, limitReached]) => <button key={String(label)} type="button" title={String(label)} aria-label={String(label)} disabled={disabled || Boolean(limitReached)} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={action as () => void}>{String(shortLabel)}</button>)}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-md bg-secondary p-1" aria-label="Table columns">
            <span className="px-1 text-muted">Columns</span>
            {[
                ['Add column before', '+ ←', () => editor.chain().focus().addColumnBefore().run(), tableColumns >= 6],
                ['Add column after', '+ →', () => editor.chain().focus().addColumnAfter().run(), tableColumns >= 6],
                ['Delete column', '−', () => editor.chain().focus().deleteColumn().run(), false],
            ].map(([label, shortLabel, action, limitReached]) => <button key={String(label)} type="button" title={String(label)} aria-label={String(label)} disabled={disabled || Boolean(limitReached)} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={action as () => void}>{String(shortLabel)}</button>)}
        </span>
        <button type="button" disabled={disabled} className={tableButtonClass} onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>Header row</button>
        <button type="button" disabled={disabled} className="whitespace-nowrap rounded border border-danger/30 bg-surface px-2 py-1 text-danger hover:bg-danger-soft disabled:opacity-30" onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().deleteTable().run()}>Delete table</button>
    </div>;
    return <div ref={editorShell} className="rich-editor">
        {!hideToolbar && (toolbarTarget ? createPortal(formattingToolbar, toolbarTarget) : formattingToolbar)}
        <EditorContent editor={editor} className="document-body-editor" data-placeholder={placeholder} data-empty={editor.isEmpty && !disabled} />
        {tableToolbar}
        <style>{`
            .rich-editor { position:relative; }
            .document-body-editor { position:relative; }
            .document-body-editor[data-empty="true"]::before { content:attr(data-placeholder); position:absolute; top:0; left:0; color:#94a3b8; font:11pt/1.55 'Document Arial',sans-serif; pointer-events:none; }
            @media print { .document-body-editor::before { display:none; } }
            .document-rich-text { min-height:23px; outline:none; font:11pt/1.55 'Document Arial',sans-serif; overflow-wrap:anywhere; }
            .document-rich-text p { margin:0 0 12px; }
            .document-rich-text h2 { font-size:14pt; font-weight:700; margin:16px 0 10px; }
            .document-rich-text h3 { font-size:12pt; font-weight:700; margin:12px 0 8px; }
            .document-rich-text ul { list-style:disc; padding-left:28px; margin:0 0 12px; }
            .document-rich-text ol { list-style:decimal; padding-left:28px; margin:0 0 12px; }
            .document-rich-text li p { margin-bottom:5px; }
            .document-rich-text table { width:100%; max-width:100%; table-layout:fixed; border-collapse:collapse; margin:14px 0; }
            .document-rich-text .tableWrapper { width:100%; max-width:100%; overflow-x:visible; }
            .document-rich-text .column-resize-handle { position:absolute; top:0; right:-2px; bottom:-2px; width:4px; background:#3b82f6; pointer-events:none; }
            .document-rich-text.resize-cursor { cursor:col-resize; }
            .document-rich-text td,.document-rich-text th { min-width:40px; border:1px solid #aeb7c2; padding:7px; vertical-align:top; position:relative; }
            .document-rich-text th { font-weight:700; background:#edf0f4; text-align:left; }
            .document-rich-text td p,.document-rich-text th p { margin:0; }
            .document-rich-text .selectedCell:after { content:''; position:absolute; inset:0; background:#3b82f633; pointer-events:none; }
            .document-rich-text:focus-visible { outline:2px solid #ebedee; outline-offset:6px; }
            .document-rich-text .document-page-break { display:block; width:100%; margin:0; padding:0; border:0; font-size:0; line-height:0; pointer-events:none; user-select:none; }
            .document-rich-text tr.document-row-break { display:table-row; }
            .document-rich-text tr.document-row-break > td { padding:0; border:0; background:transparent; font-size:0; line-height:0; }
            .measuring-document-pages .document-page-break { display:none !important; }
        `}</style>
    </div>;
}
