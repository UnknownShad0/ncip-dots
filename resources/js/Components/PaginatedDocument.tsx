import { useLayoutEffect, useRef, useState } from 'react';
import RichDocumentEditor from './RichDocumentEditor';
import './document-fonts.css';
import { documentFontsReady } from './documentFonts';
import { displayDocumentDate } from './documentMetadata';
import { PAGE_HEIGHT, PAGE_STEP, PAGE_GAP, PAGE_TOP } from './documentPaginationLayout';

export type DocumentTemplate = {
    name: string; version: number; version_id: number | null;
    header_mode: 'image' | 'logos'; header_text: string[]; repeat_header: boolean;
    header_images: { src: string; alt: string }[];
    footer_seal: { src: string; alt: string }; footer_tagline: { src: string; alt: string };
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
    for: 'Name of recipient (optional)',
    thru: 'Name of endorsing officer (optional)',
    attention: 'Name of person to act on this (optional)',
    from: 'Name of sender',
    subject: 'Brief title of this document',
    date: 'Date (optional)',
};

function AutoText({ value, label, placeholder, required, onChange, className = '', readOnly = false }: {
    value: string; label: string; placeholder?: string; required?: boolean; onChange: (value: string) => void; className?: string; readOnly?: boolean;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useLayoutEffect(() => {
        let active = true;
        const resize = () => {
            if (active && ref.current) {
                ref.current.style.height = 'auto';
                ref.current.style.height = `${ref.current.scrollHeight}px`;
            }
        };
        resize();
        // A downloaded font can change line wrapping after the first render.
        void documentFontsReady().then(resize).catch(() => {});
        return () => { active = false; };
    }, [value]);
    return <textarea ref={ref} aria-label={label} placeholder={placeholder} required={required} readOnly={readOnly} rows={1} spellCheck value={value} onChange={event => onChange(event.target.value)} className={`sheet-input ${className}`} />;
}

/** Fixed Letter sheets with one continuous editor and visual-only page breaks. */
export default function PaginatedDocument({ content, onChange, disabled = false, output = false }: {
    content: Record<string, any>; onChange: (key: string, value: any) => void; disabled?: boolean; output?: boolean;
}) {
    const template = content.template as DocumentTemplate | undefined;
    const [pages, setPages] = useState(1);
    const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
    const header = <header className="document-header">
            {template?.header_mode === 'logos' ? <div className="logo-header">
                <img src={template.header_images[0].src} alt={template.header_images[0].alt} />
                <div>{template.header_text.map((line, i) => <p key={i}>{line}</p>)}</div>
                {template.header_images[1] ? <img src={template.header_images[1].src} alt={template.header_images[1].alt} /> : <span />}
            </div> : <img className="full-header" src={template?.header_images[0]?.src || '/images/header.png'} alt={template?.header_images[0]?.alt || 'National Commission on Indigenous Peoples'} />}
        </header>;
    const footer = <footer className="sheet-footer">
            <img className="sheet-seal" src={template?.footer_seal.src || '/images/bagong-pilipinas.png'} alt="Bagong Pilipinas" />
            <div><strong>{content.footer_office_name || 'NATIONAL COMMISSION ON INDIGENOUS PEOPLES'}</strong><p>6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue,<br />South Triangle, Quezon City 1103</p><p>(02) 875 1200 · ncip.gov.ph · csc@ncip.gov.ph</p><img className="sheet-tagline" src={template?.footer_tagline.src || '/images/ncip-footer.png'} alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran" /></div>
        </footer>;
    return <div className="document-editor-workspace">
        <div ref={setToolbarTarget} className="document-editor-tools sticky top-0 z-20 mb-6 rounded-lg bg-background p-2 print:hidden" />
        <p className="mb-3 text-right text-xs text-muted" aria-live="polite">{pages} {pages === 1 ? 'page' : 'pages'}</p>
        <article className="document-editor-sheet" data-page-count={pages} aria-label="Document writing surface" style={{ height: pages * PAGE_STEP - PAGE_GAP }}>
        <style>{`
            .document-editor-workspace { width:8.5in; margin:auto; }
            .document-editor-sheet { position:relative; box-sizing:border-box; width:8.5in; color:#111; font:11pt/1.55 'Document Arial',sans-serif; tab-size:4; }
            .document-editor-sheet *, .document-editor-sheet *::before, .document-editor-sheet *::after { box-sizing:border-box; }
            .document-editor-sheet p, .document-editor-sheet h2, .document-editor-sheet h3 { margin:0; }
            .document-editor-sheet table { border-spacing:0; border-collapse:collapse; }
            .document-editor-sheet img { display:block; max-width:100%; }
            .document-editor-sheet th, .document-editor-sheet td { padding:0; }
            .document-editor-sheet hr { height:0; margin:32px 0 0; border:0; border-top:1px solid #e5e7eb; }
            .document-page { position:absolute; left:0; width:100%; background:white; box-shadow:0 2px 5px #15263612,0 20px 45px #15263612; pointer-events:none; }
            .document-page-top,.document-page-bottom { position:absolute; left:0; right:0; z-index:2; background:white; padding:0 .65in; }
            .document-page-top { top:0; height:160px; padding-top:48px; }
            .document-page-bottom { bottom:0; height:168px; padding-top:16px; }
            .document-page-number { position:absolute; bottom:12px; right:.65in; font:10px 'Document Arial',sans-serif; color:#64748b; }
            .document-page-flow { position:relative; padding:${PAGE_TOP}px .65in 0; }
            .document-editor-sheet [data-page-field] { margin-top:var(--field-page-gap,0px); }
            .document-editor-sheet [data-page-cc] { margin-top:calc(28px + var(--field-page-gap,0px)); }
            .document-editor-sheet.measuring-document-pages [data-page-field], .document-editor-sheet.measuring-document-pages [data-page-cc] { --field-page-gap:0px !important; }
            .document-editor-sheet .document-header { height:96px; display:flex; align-items:center; justify-content:center; }
            .document-editor-sheet .full-header { width:100%; height:90px; object-fit:contain; }
            .document-editor-sheet .logo-header { display:grid; width:100%; grid-template-columns:75px minmax(0,1fr) 75px; gap:12px; align-items:center; text-align:center; font-size:10pt; }
            .document-editor-sheet .logo-header img { max-width:70px; max-height:70px; object-fit:contain; }
            .document-editor-sheet .logo-header p:nth-child(2) { font-weight:700; }
            .document-editor-sheet .sheet-input { display:block; width:100%; margin:0; resize:none; overflow:hidden; min-height:30px; padding:4px 6px; border:0; border-radius:3px; background:transparent; color:inherit; font:inherit; line-height:inherit; box-shadow:none; white-space:pre-wrap; overflow-wrap:break-word; }
            .document-editor-sheet .sheet-input:hover { background:#f7f9fb; }
            .document-editor-sheet .sheet-input:focus { background:#f4f8ff; outline:2px solid #ebedee; }
            .document-editor-sheet .sheet-input::placeholder { color:#94a3b8; }
            .document-editor-sheet .sheet-meta { display:grid; grid-template-columns:106px 8px minmax(0,1fr); gap:30px; margin-bottom:8px; }
            .document-editor-sheet .tracking-number { margin:0 0 12px; text-align:right; font-size:9pt; font-weight:700; }
            .document-editor-sheet .sheet-meta strong { padding:4px 0; font-size:11pt; font-weight:700; line-height:1.3; }
            .document-editor-sheet .recipient-label { align-self:start; appearance:none; margin:0; width:100%; border:0; border-radius:3px; padding:4px 20px 4px 0; font:700 11pt/1.3 'Document Arial',sans-serif; background-color:transparent; color:inherit; }
            .document-editor-sheet .sheet-value { font-weight:700; }
            .document-editor-sheet .sheet-name { font-size:11pt; line-height:1.3; padding-bottom:0; }
            .document-editor-sheet .sheet-position { font-size:10pt; font-weight:400; line-height:1.25; min-height:22px; padding-top:0; padding-bottom:0; margin-top:0; }
            .document-editor-sheet .sheet-body { margin-top:26px; }
            .document-editor-sheet .sheet-footer { border-top:1px solid #b9b9b9; padding-top:12px; display:flex; gap:12px; align-items:center; font:8px/1.4 'Document Arial',sans-serif; }
            .document-editor-sheet .sheet-footer strong { font-size:10px; }
            .document-editor-sheet .sheet-seal { width:55px; height:55px; object-fit:contain; }
            .document-editor-sheet .sheet-tagline { height:17px; max-width:100%; object-fit:contain; object-position:left; margin-top:5px; }
        `}</style>
        {Array.from({ length: pages }, (_, index) => <div key={index} className="document-page" data-page-number={index + 1} aria-hidden="true" style={{ top: index * PAGE_STEP, height: PAGE_HEIGHT }}>
            <div className="document-page-top">{header}</div>
            <div className="document-page-bottom">{footer}<span className="document-page-number">{index + 1} / {pages}</span></div>
        </div>)}
        <div className="document-page-flow">
        {content.tracking_number && <div className="tracking-number">DOTS Tracking No.: {String(content.tracking_number)}</div>}
        {(['for', 'thru', 'attention', 'from', 'subject', 'date'] as const).map(key => <div className="sheet-meta" data-page-field key={key}>
            {key === 'for' ? <select className="recipient-label self-start" aria-label="Recipient label" disabled={disabled || output} value={content.recipient_label === 'TO' ? 'TO' : 'FOR'} onChange={event => onChange('recipient_label', event.target.value)}><option value="FOR">FOR</option><option value="TO">TO</option></select> : <strong>{key.toUpperCase()}</strong>}
            <strong aria-hidden="true">:</strong>
            <div>
                <AutoText readOnly={disabled || output} label={key === 'for' ? (content.recipient_label || 'FOR') : key.toUpperCase()} required={['from', 'subject'].includes(key)} value={key === 'date' ? displayDocumentDate(String(content[key] ?? '')) : String(content[key] ?? '')} placeholder={FIELD_PLACEHOLDERS[key]} onChange={value => onChange(key, value)} className={`sheet-value ${['for', 'thru', 'attention', 'from'].includes(key) ? 'sheet-name' : ''}`} />
                {['for', 'thru', 'attention', 'from'].includes(key) && <AutoText readOnly={disabled || output} label={`${key === 'for' ? (content.recipient_label || 'FOR') : key.toUpperCase()} position / designation`} value={String(content[`${key}_position`] ?? '')} placeholder="Position / designation (optional)" onChange={value => onChange(`${key}_position`, value)} className="sheet-position" />}
            </div>
        </div>)}
        <hr className="mt-8" />
        <section className="sheet-body" aria-label="Document content">
            <RichDocumentEditor hideToolbar={output} toolbarTarget={toolbarTarget} placeholder="Enter document content..." onPageCount={setPages} disabled={disabled || output} value={content.body_document} plainText={content.body ?? ''} onChange={(document, text) => { onChange('body_document', document); onChange('body', text); }} />
        </section>
        <div className="sheet-meta" data-page-cc><strong>CC</strong><strong aria-hidden="true">:</strong><AutoText readOnly={disabled || output} label="Copy recipients" value={(content.cc ?? []).join('\n')} placeholder="Copy recipients, one per line (optional)" onChange={value => onChange('cc', value.split('\n'))} /></div>
        </div>
    </article></div>;
}
