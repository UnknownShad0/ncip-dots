import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
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
    const menu = useRef<HTMLDetailsElement>(null);
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
    const tableColumns = table?.firstChild?.childCount ?? 0;
    const sizeColumns = (fit: boolean) => {
        if (!table || disabled) return;
        const depth = Array.from({ length: selection.depth }, (_, i) => i + 1).find(level => selection.node(level) === table)!;
        const columns = Array.from({ length: tableColumns }, () => [] as string[]);
        table.forEach(row => row.forEach((cell, _offset, index) => columns[index].push(cell.textBetween(0, cell.content.size, '\n'))));
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) context.font = `700 ${getComputedStyle(editor.view.dom).fontSize} "Document Arial"`;
        const widths = fit ? fitColumnWidths(columns, text => context?.measureText(text).width ?? text.length * 8) : normalizeColumnWidths(columns.map(() => 1));
        const transaction = editor.state.tr;
        const position = selection.before(depth);
        table.forEach((row, rowOffset) => row.forEach((cell, cellOffset, index) => {
            transaction.setNodeMarkup(position + 2 + rowOffset + cellOffset, undefined, { ...cell.attrs, colwidth: [widths[index]] });
        }));
        editor.view.dispatch(transaction);
        editor.view.focus();
    };
    const toolbar = <>
<div role="toolbar" aria-label="Document formatting" className="sticky top-0 z-10 mb-4 flex flex-wrap items-center justify-center gap-3 rounded-lg border border-border bg-surface p-2 shadow-sm print:hidden">            {button('Bold (Ctrl/Cmd+B)', Bold, () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
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
        </div>
        {inTable && <div role="toolbar" aria-label="Table editing" className="mb-3 flex flex-wrap gap-2 text-xs print:hidden">
            <button type="button" disabled={disabled} className="rounded border border-border bg-surface px-2 py-1 hover:bg-secondary" onMouseDown={event => event.preventDefault()} onClick={() => sizeColumns(true)}>Fit to content</button>
            <button type="button" disabled={disabled} className="rounded border border-border bg-surface px-2 py-1 hover:bg-secondary" onMouseDown={event => event.preventDefault()} onClick={() => sizeColumns(false)}>Equal widths</button>
            {[
                ['Add row above', () => editor.chain().focus().addRowBefore().run()],
                ['Add row below', () => editor.chain().focus().addRowAfter().run()],
                ['Add column before', () => editor.chain().focus().addColumnBefore().run()],
                ['Add column after', () => editor.chain().focus().addColumnAfter().run()],
                ['Delete row', () => editor.chain().focus().deleteRow().run()],
                ['Delete column', () => editor.chain().focus().deleteColumn().run()],
                ['Header row', () => editor.chain().focus().toggleHeaderRow().run()],
                ['Delete table', () => editor.chain().focus().deleteTable().run()],
            ].map(([label, action]) => <button key={String(label)} type="button" disabled={(String(label).startsWith('Add row') && tableRows >= 200) || (String(label).startsWith('Add column') && tableColumns >= 6)} className="disabled:opacity-30 rounded border border-border bg-surface px-2 py-1 text-foreground hover:bg-secondary" onMouseDown={event => event.preventDefault()} onClick={action as () => void}>{String(label)}</button>)}
        </div>}
    </>;
    return <div className="rich-editor">
        {!hideToolbar && (toolbarTarget ? createPortal(toolbar, toolbarTarget) : toolbar)}
        <EditorContent editor={editor} className="document-body-editor" data-placeholder={placeholder} data-empty={editor.isEmpty && !disabled} />
        <style>{`
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
            .document-rich-text table { width:100%; table-layout:fixed; border-collapse:collapse; margin:14px 0; }
            .document-rich-text .tableWrapper { overflow-x:auto; }
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
