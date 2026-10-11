import { useLayoutEffect, useRef, useState } from 'react';

type Props = { title: string; content: Record<string, any>; onTitleChange?: (value: string) => void; onChange?: (key: string, value: any) => void; printTarget?: boolean };
type Block = { key: string; label: string; value: string; kind: 'title' | 'meta' | 'body'; placeholder: string; required?: boolean };
type Piece = Block & { start: number; end: number; height: number };
const PAGE_BODY_HEIGHT = 728;
const WIDTH = 691.2;

export default function PaginatedDocument({ title, content, onTitleChange, onChange, printTarget }: Props) {
    const editable = !!onChange;
    const measure = useRef<HTMLDivElement>(null);
    const root = useRef<HTMLDivElement>(null);
    const caret = useRef<{ key: string; offset: number } | null>(null);
    const [pages, setPages] = useState<Piece[][]>([]);
    const blocks: Block[] = [
        { key: 'title', label: 'Document title', value: title, kind: 'title', placeholder: 'DOCUMENT TITLE', required: true },
        ...(['for', 'thru', 'attention', 'from', 'subject', 'date'] as const)
            .filter(key => editable || content[key] || ['for', 'from', 'subject', 'date'].includes(key))
            .map(key => ({ key, label: key.toUpperCase(), value: String(content[key] ?? ''), kind: 'meta' as const, placeholder: key === 'date' ? 'YYYY-MM-DD' : `${key === 'from' ? 'Sender or office' : key === 'subject' ? 'Document subject' : key.toUpperCase()}${['thru', 'attention'].includes(key) ? ' (optional)' : ''}`, required: ['from', 'subject', 'date'].includes(key) })),
        { key: 'body', label: 'Document body', value: String(content.body ?? ''), kind: 'body', placeholder: 'Begin writing your document here…', required: true },
        ...((editable || (content.cc ?? []).filter(Boolean).length) ? [{ key: 'cc', label: 'CC', value: (content.cc ?? []).join('\n'), kind: 'meta' as const, placeholder: 'Copy recipients, one per line (optional)' }] : []),
    ];
    const serialized = JSON.stringify(blocks);
    useLayoutEffect(() => {
        const node = measure.current;
        if (!node) return;
        const next: Piece[][] = [[]];
        let remaining = PAGE_BODY_HEIGHT;
        const newPage = () => { next.push([]); remaining = PAGE_BODY_HEIGHT; };
        for (const block of blocks) {
            node.style.width = `${block.kind === 'meta' ? WIDTH - 122 : WIDTH}px`;
            node.style.fontSize = block.kind === 'title' ? '18.6667px' : '14.6667px';
            node.style.fontWeight = block.kind === 'title' ? '600' : '400';
            node.style.lineHeight = block.kind === 'title' ? '28px' : '22.7333px';
            const height = (text: string) => {
                node.textContent = `${text || ' '}\u200b`;
                return Math.ceil(node.getBoundingClientRect().height) + 12;
            };
            let start = 0;
            do {
                if (remaining < height('M')) newPage();
                let low = 0, high = block.value.length - start;
                while (low < high) {
                    const mid = Math.ceil((low + high) / 2);
                    if (height(block.value.slice(start, start + mid)) <= remaining) low = mid;
                    else high = mid - 1;
                }
                let end = start + low;
                if (end < block.value.length && low > 0) {
                    const part = block.value.slice(start, end);
                    const boundary = Math.max(part.lastIndexOf('\n'), part.lastIndexOf(' '));
                    if (boundary > 0) end = start + boundary + 1;
                    // Never split a UTF-16 surrogate pair.
                    if (end > start && /[\uD800-\uDBFF]/.test(block.value[end - 1])) end--;
                }
                if (end === start && block.value.length > start) { newPage(); continue; }
                const h = height(block.value.slice(start, end));
                next[next.length - 1].push({ ...block, start, end, height: h });
                remaining -= h;
                start = end;
                if (start < block.value.length) newPage();
            } while (start < block.value.length);
        }
        setPages(next);
    }, [serialized]);

    useLayoutEffect(() => {
        if (!caret.current || !root.current) return;
        const { key, offset } = caret.current;
        const inputs = Array.from(root.current.querySelectorAll<HTMLTextAreaElement>('textarea[data-block]')).filter(node => node.dataset.block === key);
        const input = inputs.find(node => offset >= Number(node.dataset.start) && offset < Number(node.dataset.end)) ?? inputs[inputs.length - 1];
        if (input) {
            const crossedPage = document.activeElement !== input;
            input.focus({ preventScroll: true });
            if (crossedPage) input.scrollIntoView({ block: 'nearest' });
            const position = Math.max(0, offset - Number(input.dataset.start));
            input.setSelectionRange(position, position);
        }
        caret.current = null;
    }, [pages]);

    const update = (piece: Piece, value: string, position: number) => {
        const full = piece.value.slice(0, piece.start) + value + piece.value.slice(piece.end);
        caret.current = { key: piece.key, offset: piece.start + position };
        if (piece.key === 'title') onTitleChange?.(full);
        else onChange?.(piece.key, piece.key === 'cc' ? full.split('\n') : full);
    };
    return <div ref={root} className={`paged-document ${printTarget ? 'creation-print-page' : ''}`}>
        <style>{styles}</style>
        <div ref={measure} className="pagination-measure" aria-hidden="true" />
        {pages.map((pieces, pageIndex) => <article key={pageIndex} className="document-sheet" aria-label={`Document page ${pageIndex + 1}`}>
            <header className="sheet-header"><img src="/images/header.png" alt="National Commission on Indigenous Peoples" /></header>
            <div className="sheet-body">{pieces.map(piece => <div key={`${piece.key}-${piece.start}`} className={`sheet-block sheet-${piece.kind}`} style={{ height: piece.height }}>
                {piece.kind === 'meta' && <strong>{piece.label}{piece.start > 0 ? ' (cont.)' : ''}:</strong>}
                {editable ? <><textarea data-block={piece.key} data-start={piece.start} data-end={piece.end} aria-label={`${piece.label}${pageIndex ? `, page ${pageIndex + 1}` : ''}`} required={piece.required && piece.start === 0} spellCheck rows={1} value={piece.value.slice(piece.start, piece.end)} placeholder={piece.placeholder} onChange={event => update(piece, event.target.value, event.target.selectionStart)} onKeyDown={event => {
                    if (event.key === 'Backspace' && event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === 0 && piece.start > 0) {
                        event.preventDefault();
                        const prefix = Array.from(piece.value.slice(0, piece.start));
                        const removed = prefix.pop()?.length ?? 1;
                        update({ ...piece, start: piece.start - removed }, event.currentTarget.value, 0);
                    }
                }} /><div className="sheet-print-text">{piece.value.slice(piece.start, piece.end)}</div></> : <div className="sheet-text">{piece.value.slice(piece.start, piece.end)}</div>}
            </div>)}</div>
            <footer className="sheet-footer"><div className="sheet-footer-main"><img className="sheet-seal" src="/images/bagong-pilipinas.png" alt="Bagong Pilipinas" /><div><strong>NATIONAL COMMISSION ON INDIGENOUS PEOPLES</strong><p>6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue,<br />South Triangle, Quezon City 1103</p><p>(02) 875 1200 · ncip.gov.ph · csc@ncip.gov.ph</p><img className="sheet-tagline" src="/images/ncip-footer.png" alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran" /></div></div><span className="sheet-page-number">{pageIndex + 1} / {pages.length}</span></footer>
        </article>)}
    </div>;
}

const styles = `
.paged-document { width:8.5in; margin:auto; }
.document-sheet { box-sizing:border-box; width:8.5in; height:11in; padding:.5in .65in; margin:0 0 28px; display:grid; grid-template-rows:96px 728px 104px; row-gap:16px; background:white; color:#111; font:11pt/1.55 Arial,sans-serif; box-shadow:0 2px 5px #15263612,0 20px 45px #15263612; }
.sheet-header img { display:block; width:100%; height:90px; object-fit:contain; }
.sheet-body { min-height:0; }
.sheet-block { box-sizing:border-box; padding-bottom:12px; }
.sheet-meta { display:grid; grid-template-columns:106px minmax(0,1fr); gap:16px; }
.sheet-meta strong { padding:4px 0; font-size:10pt; }
.sheet-block textarea,.sheet-text,.sheet-print-text,.pagination-measure { box-sizing:border-box; font:inherit; white-space:pre-wrap; overflow-wrap:anywhere; padding:4px 6px; }
.sheet-block textarea { display:block; width:100%; height:100%; min-height:0; resize:none; overflow:hidden; margin:0; border:0; border-radius:3px; background:transparent; color:inherit; outline:none; box-shadow:none; }
.sheet-block textarea:hover { background:#f7f9fb; }
.sheet-block textarea:focus { background:#f4f8ff; box-shadow:inset 2px 0 #3b82f6; --tw-ring-shadow:0 0 transparent; }
.sheet-block textarea::placeholder { color:#9ca3af; }
.sheet-title { font-size:14pt; font-weight:600; line-height:28px; text-align:center; }
.sheet-footer { border-top:1px solid #b9b9b9; padding-top:10px; position:relative; font:8px/1.4 Arial,sans-serif; }
.sheet-footer-main { display:flex; gap:12px; align-items:center; }
.sheet-footer strong { font-size:10px; }
.sheet-seal { width:55px; height:55px; object-fit:contain; }
.sheet-tagline { height:17px; max-width:100%; object-fit:contain; object-position:left; margin-top:5px; }
.sheet-page-number { position:absolute; bottom:0; right:0; font-size:9px; color:#666; }
.pagination-measure { position:fixed; top:0; left:-10000px; visibility:hidden; height:auto; border:0; font-family:Arial,sans-serif; }
.sheet-print-text { display:none; }
@media print {
 @page { size:letter portrait; margin:0; }
 body * { visibility:hidden !important; }
 body:has(.creation-print-page) [aria-label="Document editor"] { display:block !important; }
 body *:has(.creation-print-page) { position:static !important; overflow:visible !important; max-height:none !important; transform:none !important; }
 .creation-print-page { position:absolute !important; top:0 !important; left:0 !important; width:8.5in !important; margin:0 !important; }
 .creation-print-page,.creation-print-page * { visibility:visible !important; }
 .creation-print-page .document-sheet { margin:0; box-shadow:none; break-after:page; break-inside:avoid; }
 .creation-print-page .document-sheet:last-child { break-after:auto; }
 .creation-print-page textarea,.creation-print-page .pagination-measure { display:none !important; }
 .creation-print-page .sheet-print-text { display:block; }
}
`;
