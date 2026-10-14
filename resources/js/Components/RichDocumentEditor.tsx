import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2, Table2 } from 'lucide-react';

export function plainTextDocument(text: string): JSONContent {
    return { type: 'doc', content: (text || '').split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
}

export default function RichDocumentEditor({ value, plainText, onChange, disabled = false }: {
    value?: JSONContent; plainText: string; disabled?: boolean; onChange: (document: JSONContent, text: string) => void;
}) {
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(3);
    const menu = useRef<HTMLDetailsElement>(null);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [2, 3] }, link: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false }),
            TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
            TableCell.extend({ content: 'paragraph+' }), TableHeader.extend({ content: 'paragraph+' }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
        ],
        content: value ?? plainTextDocument(plainText),
        immediatelyRender: false,
        shouldRerenderOnTransaction: true,
        editorProps: { attributes: { 'aria-label': 'Document body', role: 'textbox', 'aria-multiline': 'true', class: 'document-rich-text' } },
        onUpdate: ({ editor }) => onChangeRef.current(editor.getJSON(), editor.getText()),
    });
    useEffect(() => {
        useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
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
    return <div className="rich-editor">
        <div role="toolbar" aria-label="Document formatting" className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-2 shadow-sm print:hidden">
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
        </div>
        {inTable && <div role="toolbar" aria-label="Table editing" className="mb-3 flex flex-wrap gap-2 text-xs print:hidden">
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
        <EditorContent editor={editor} />
        <style>{`
            .document-rich-text { min-height:280px; outline:none; font:11pt/1.55 Arial,sans-serif; overflow-wrap:anywhere; }
            .document-rich-text p { margin:0 0 12px; }
            .document-rich-text h2 { font-size:14pt; font-weight:700; margin:16px 0 10px; }
            .document-rich-text h3 { font-size:12pt; font-weight:700; margin:12px 0 8px; }
            .document-rich-text ul { list-style:disc; padding-left:28px; margin:0 0 12px; }
            .document-rich-text ol { list-style:decimal; padding-left:28px; margin:0 0 12px; }
            .document-rich-text li p { margin-bottom:5px; }
            .document-rich-text table { width:100%; table-layout:fixed; border-collapse:collapse; margin:14px 0; }
            .document-rich-text td,.document-rich-text th { min-width:50px; border:1px solid #aeb7c2; padding:7px; vertical-align:top; position:relative; }
            .document-rich-text th { font-weight:700; background:#edf0f4; text-align:left; }
            .document-rich-text td p,.document-rich-text th p { margin:0; }
            .document-rich-text .selectedCell:after { content:''; position:absolute; inset:0; background:#3b82f633; pointer-events:none; }
            .document-rich-text:focus-visible { outline:2px solid #93c5fd; outline-offset:6px; }
        `}</style>
    </div>;
}
