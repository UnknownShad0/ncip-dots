import { Fragment, useLayoutEffect, useRef, useState } from 'react';
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
    const pageTemplate = content.page_template === 'letter' ? 'letter' : 'memo';
    const hasThru = Boolean(String(content.thru ?? '').trim() || String(content.thru_position ?? '').trim());
    const hasAttention = Boolean(String(content.attention ?? '').trim() || String(content.attention_position ?? '').trim());
    const showThru = Boolean(content.show_thru || hasThru);
    const showAttention = Boolean(content.show_attention || hasAttention);
    const renderThru = output ? hasThru : showThru;
    const renderAttention = output ? hasAttention : showAttention;
    const legacySignature = content.show_signature_block || String(content.signature_name ?? '').trim() || String(content.signature_position ?? '').trim();
    const signatureBlocks = Array.isArray(content.signature_blocks)
        ? content.signature_blocks.map((block: Record<string, any>, index: number) => ({
            id: String(block.id ?? `signature-${index + 1}`),
            name: String(block.name ?? ''),
            position: String(block.position ?? ''),
        }))
        : legacySignature ? [{ id: 'legacy-signature', name: String(content.signature_name ?? ''), position: String(content.signature_position ?? '') }] : [];
    const hasCc = Array.isArray(content.cc) && content.cc.some((line: unknown) => String(line ?? '').trim() !== '');
    const showCc = Boolean(content.show_cc || hasCc);
    const renderCc = output ? hasCc : showCc;
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
            .document-editor-sheet .sheet-letter-date { margin:0 0 22px auto; max-width:48%; text-align:right; }
            .document-editor-sheet .sheet-letter-subject { font-weight:700; }
            .document-editor-sheet .sheet-letter-divider { margin-top:22px; }
            .document-editor-sheet .sheet-letter-body { margin-top:22px; }
            .document-editor-sheet .sheet-optional-fields { display:flex; flex-direction:column; align-items:flex-start; gap:6px; margin:4px 0 12px; font:9pt/1.3 'Document Arial',sans-serif; color:#64748b; }
            .document-editor-sheet .sheet-optional-fields button { border:0; border-radius:4px; padding:3px 6px; background:#f1f5f9; color:#334155; font:inherit; cursor:pointer; }
            .document-editor-sheet .sheet-optional-fields button:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-meta-label { display:flex; align-self:start; align-items:center; justify-content:space-between; gap:4px; min-width:0; }
            .document-editor-sheet .sheet-meta-separator { align-self:start; text-align:center; }
            .document-editor-sheet .sheet-meta-remove { flex:0 0 18px; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:0; border-radius:4px; background:#f1f5f9; color:#475569; font:11pt/1 'Document Arial',sans-serif; cursor:pointer; }
            .document-editor-sheet .sheet-meta-remove:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-meta-remove:focus-visible { outline:2px solid #64748b; outline-offset:2px; }
            .document-editor-sheet .sheet-meta-add { border:0; border-radius:4px; padding:3px 6px; background:#f1f5f9; color:#334155; font:9pt/1.3 'Document Arial',sans-serif; cursor:pointer; }
            .document-editor-sheet .sheet-meta-add:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-signature-remove { border:0; border-radius:4px; padding:2px 6px; background:#f1f5f9; color:#475569; font:inherit; cursor:pointer; }
            .document-editor-sheet .sheet-signature-remove:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-signature-list { display:grid; grid-template-columns:minmax(0,1fr); gap:20px; margin-top:24px; }
            .document-editor-sheet .sheet-signature-list.multiple { grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:24px; row-gap:16px; }
            .document-editor-sheet .sheet-signature-block { position:relative; min-width:0; page-break-inside:avoid; break-inside:avoid; }
            .document-editor-sheet .sheet-signature-block .sheet-signature-remove { position:absolute; top:0; right:0; z-index:1; font:8pt/1.2 'Document Arial',sans-serif; }
            .document-editor-sheet .sheet-signature-space { min-height:56px; }
            .document-editor-sheet .sheet-signature-name { max-width:100%; font-weight:700; }
            .document-editor-sheet .sheet-signature-position { max-width:100%; }
            .document-editor-sheet .sheet-signature-help { margin-bottom:4px; color:#64748b; font:9pt/1.3 'Document Arial',sans-serif; }
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
        {pageTemplate === 'letter' && <div className="sheet-letter-date" data-page-field><AutoText readOnly={disabled || output} label="Date" value={displayDocumentDate(String(content.date ?? ''))} placeholder={FIELD_PLACEHOLDERS.date} onChange={value => onChange('date', value)} className="sheet-value" /></div>}
        {(pageTemplate === 'memo'
            ? (['for', ...(renderThru ? ['thru'] : []), ...(renderAttention ? ['attention'] : []), 'from', 'subject', 'date'] as const)
            : (['for', 'from', 'subject'] as const)
        ).map(key => <Fragment key={key}><div className={`sheet-meta ${pageTemplate === 'letter' && key === 'subject' ? 'sheet-letter-subject' : ''}`} data-page-field>
            {key === 'for' ? <select className="recipient-label self-start" aria-label="Recipient label" disabled={disabled || output} value={content.recipient_label === 'TO' ? 'TO' : 'FOR'} onChange={event => onChange('recipient_label', event.target.value)}><option value="FOR">FOR</option><option value="TO">TO</option></select> : <div className="sheet-meta-label"><strong>{key.toUpperCase()}</strong>{key === 'thru' && !output && !disabled && <button type="button" className="sheet-meta-remove print:hidden" aria-label="Remove THRU" title="Remove THRU" onClick={() => { onChange('show_thru', false); onChange('thru', ''); onChange('thru_position', ''); }}>×</button>}{key === 'attention' && !output && !disabled && <button type="button" className="sheet-meta-remove print:hidden" aria-label="Remove ATTENTION" title="Remove ATTENTION" onClick={() => { onChange('show_attention', false); onChange('attention', ''); onChange('attention_position', ''); }}>×</button>}</div>}
            <strong className="sheet-meta-separator" aria-hidden="true">:</strong>
            <div>
                <AutoText readOnly={disabled || output} label={key === 'for' ? (content.recipient_label || 'FOR') : key.toUpperCase()} required={['from', 'subject'].includes(key)} value={key === 'date' ? displayDocumentDate(String(content[key] ?? '')) : String(content[key] ?? '')} placeholder={FIELD_PLACEHOLDERS[key]} onChange={value => onChange(key, value)} className={`sheet-value ${['for', 'thru', 'attention', 'from'].includes(key) ? 'sheet-name' : ''}`} />
                {['for', 'thru', 'attention', 'from'].includes(key) && <AutoText readOnly={disabled || output} label={`${key === 'for' ? (content.recipient_label || 'FOR') : key.toUpperCase()} position / designation`} value={String(content[`${key}_position`] ?? '')} placeholder="Position / designation (optional)" onChange={value => onChange(`${key}_position`, value)} className="sheet-position" />}
            </div>
        </div>{pageTemplate === 'memo' && key === 'for' && !output && !disabled && (!showThru || !showAttention) && <div className="sheet-optional-fields print:hidden" aria-label="Optional memo fields">
            {!showThru && <button type="button" onClick={() => onChange('show_thru', true)}>+ Add THRU</button>}
            {!showAttention && <button type="button" onClick={() => onChange('show_attention', true)}>+ Add ATTENTION</button>}
        </div>}</Fragment>)}
        {pageTemplate === 'memo' ? <hr className="mt-8" /> : <hr className="sheet-letter-divider" />}
        <section className="sheet-body" aria-label="Document content">
            <RichDocumentEditor hideToolbar={output} toolbarTarget={toolbarTarget} placeholder="Enter document content..." onPageCount={setPages} disabled={disabled || output} value={content.body_document} plainText={content.body ?? ''} onChange={(document, text) => { onChange('body_document', document); onChange('body', text); }} />
        </section>
        {signatureBlocks.length > 0 && <>
            {pageTemplate === 'letter' && <p className="sheet-letter-closing">Sincerely,</p>}
            <section className={`sheet-signature-list ${signatureBlocks.length > 1 ? 'multiple' : ''}`} aria-label="Signature blocks">
                {signatureBlocks.map((block, index) => <div className="sheet-signature-block" data-page-field key={block.id}>
                    {!output && !disabled && <button type="button" className="sheet-signature-remove print:hidden" aria-label={`Remove signature block ${index + 1}`} onClick={() => onChange('signature_blocks', signatureBlocks.filter(item => item.id !== block.id))}>Remove</button>}
                    <div className="sheet-signature-space" aria-hidden="true" />
                    <AutoText readOnly={disabled || output} label={`Signatory ${index + 1} name`} value={block.name} placeholder="Signatory name" onChange={value => onChange('signature_blocks', signatureBlocks.map(item => item.id === block.id ? { ...item, name: value } : item))} className="sheet-signature-name" />
                    <AutoText readOnly={disabled || output} label={`Signatory ${index + 1} position or title`} value={block.position} placeholder="Position / title (optional)" onChange={value => onChange('signature_blocks', signatureBlocks.map(item => item.id === block.id ? { ...item, position: value } : item))} className="sheet-signature-position" />
                </div>)}
            </section>
        </>}
        {!output && !disabled && <div className="sheet-optional-fields print:hidden" aria-label="Optional signature blocks">
            <button type="button" onClick={() => {
                const id = `signature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                const firstMemoBlock = pageTemplate === 'memo' && signatureBlocks.length === 0;
                onChange('signature_blocks', [...signatureBlocks, {
                    id,
                    name: firstMemoBlock ? String(content.from ?? '') : '',
                    position: firstMemoBlock ? String(content.from_position ?? '') : '',
                }]);
            }}>{signatureBlocks.length > 0 ? '+ Add another signature' : '+ Add signature block'}</button>
        </div>}
        {renderCc ? <div className="sheet-meta" data-page-cc>
            <div className="sheet-meta-label"><strong>CC</strong>{!output && !disabled && <button type="button" className="sheet-meta-remove print:hidden" aria-label="Remove CC" title="Remove CC" onClick={() => { onChange('show_cc', false); onChange('cc', []); }}>×</button>}</div><strong className="sheet-meta-separator" aria-hidden="true">:</strong><div>
                <AutoText readOnly={disabled || output} label="Copy recipients" value={(content.cc ?? []).join('\n')} placeholder="Copy recipients, one per line" onChange={value => onChange('cc', value.split('\n'))} />
            </div>
        </div> : !output && !disabled && <div className="sheet-meta" data-page-cc>
            <strong>CC</strong><strong className="sheet-meta-separator" aria-hidden="true">:</strong><div><button type="button" className="sheet-meta-add print:hidden" aria-label="Add CC field" onClick={() => onChange('show_cc', true)}>+ Add CC</button></div>
        </div>}
        </div>
    </article></div>;
}
