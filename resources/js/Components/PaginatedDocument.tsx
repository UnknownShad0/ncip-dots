import { useLayoutEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
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

type Align = 'left' | 'center' | 'right';
const ALIGNS: Align[] = ['left', 'center', 'right'];
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;

// Must match the default used by the PDF Blade and the controller:
// old blocks without `align` alternate left / right (the old 2-column layout).
const asAlign = (value: unknown, index: number): Align =>
    value === 'left' || value === 'center' || value === 'right' ? value : index % 2 ? 'right' : 'left';
const filled = (value: unknown) => String(value ?? '').trim() !== '';
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const todayManila = () => new Intl.DateTimeFormat('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date());

const FIELD_PLACEHOLDERS: Record<string, string> = {
    for: 'Name of recipient (optional)',
    thru: 'Name of endorsing officer (optional)',
    attention: 'Name of person to act on this (optional)',
    from: 'Name of sender',
    subject: 'Brief title of this document',
    date: 'Date (optional)',
};

// What clearing a field does when its × is pressed.
const FIELD_RESET: Record<string, Record<string, any>> = {
    for: { show_for: false, recipients: [], for: '', for_position: '' },
    thru: { show_thru: false, thru: '', thru_position: '' },
    attention: { show_attention: false, attention: '', attention_position: '' },
    from: { show_from: false, from: '', from_position: '' },
    subject: { show_subject: false, subject: '' },
    date: { show_date: false, date: '' },
    cc: { show_cc: false, cc: [] },
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
    const editable = !output && !disabled;
    const recipientLabel = content.recipient_label === 'TO' ? 'TO' : 'FOR'; // legacy only; no select anymore

    // ---- field visibility (same rules as the PDF Blade) ----
    const flag = (key: string, fallback: boolean) => typeof content[key] === 'boolean' ? (content[key] as boolean) : fallback;
    const hasThru = filled(content.thru) || filled(content.thru_position);
    const hasAttention = filled(content.attention) || filled(content.attention_position);
    const hasCc = Array.isArray(content.cc) && content.cc.some((line: unknown) => filled(line));
    const shown: Record<string, boolean> = {
        for: flag('show_for', true),
        thru: flag('show_thru', hasThru),
        attention: flag('show_attention', hasAttention),
        from: flag('show_from', true),
        subject: flag('show_subject', true),
        date: flag('show_date', true),
        cc: flag('show_cc', hasCc),
    };

    // ---- recipients (FOR) ----
    const recipients: { id: string; name: string; position: string }[] =
        Array.isArray(content.recipients) && content.recipients.length
            ? content.recipients.map((r: Record<string, any>, i: number) => ({ id: String(r.id ?? `recipient-${i + 1}`), name: String(r.name ?? ''), position: String(r.position ?? '') }))
            : [{ id: 'recipient-1', name: String(content.for ?? ''), position: String(content.for_position ?? '') }];
    const setRecipients = (list: typeof recipients) => {
        onChange('recipients', list);
        // Keep legacy fields in sync for the rest of the app (lists, titles, search).
        onChange('for', list[0]?.name ?? '');
        onChange('for_position', list[0]?.position ?? '');
    };
    const patchRecipient = (id: string, patch: Partial<{ name: string; position: string }>) =>
        setRecipients(recipients.map(r => r.id === id ? { ...r, ...patch } : r));

    // ---- signatures ----
    const legacySignature = content.show_signature_block || filled(content.signature_name) || filled(content.signature_position);
    const signatureBlocks: { id: string; name: string; position: string; align: Align }[] = Array.isArray(content.signature_blocks)
        ? content.signature_blocks.map((block: Record<string, any>, index: number) => ({
            id: String(block.id ?? `signature-${index + 1}`),
            name: String(block.name ?? ''),
            position: String(block.position ?? ''),
            align: asAlign(block.align, index),
        }))
        : legacySignature ? [{ id: 'legacy-signature', name: String(content.signature_name ?? ''), position: String(content.signature_position ?? ''), align: 'left' as Align }] : [];
    const showSignatures = flag('show_signature', signatureBlocks.length > 0);
    // Same align => stacked top to bottom. Row = how many earlier blocks share that side.
    const counters: Record<Align, number> = { left: 0, center: 0, right: 0 };
    const placed = signatureBlocks.map(block => ({ ...block, row: ++counters[block.align] }));
    const orderedSignatures = [...placed].sort((a, b) => (a.row * 10 + ALIGNS.indexOf(a.align)) - (b.row * 10 + ALIGNS.indexOf(b.align)));
    const wideSignatures = placed.some(block => block.align !== 'left'); // 3 columns only when someone is not on the left
    const patchSignatures = (id: string, patch: Record<string, any>) =>
        onChange('signature_blocks', signatureBlocks.map(item => item.id === id ? { ...item, ...patch } : item));
    const addSignature = () => {
        const firstMemoBlock = pageTemplate === 'memo' && signatureBlocks.length === 0;
        const align = ALIGNS.reduce<Align>((best, side) => counters[side] < counters[best] ? side : best, 'left');
        onChange('show_signature', true);
        onChange('signature_blocks', [...signatureBlocks, {
            id: newId('signature'),
            name: firstMemoBlock ? String(content.from ?? '') : '',
            position: firstMemoBlock ? String(content.from_position ?? '') : '',
            align,
        }]);
    };

    // ---- add / remove fields ----
    const fieldOrder = pageTemplate === 'memo'
        ? ['for', 'thru', 'attention', 'from', 'subject', 'date', 'cc']
        : ['for', 'from', 'subject', 'date', 'cc'];
    const addable = [...fieldOrder.filter(key => key !== 'for' && !shown[key]), 'signature'];
    const addField = (key: string) => {
        if (key === 'signature') return addSignature();
        if (key === 'for') {
            onChange('show_for', true);
            onChange('recipients', [{ id: newId('recipient'), name: '', position: '' }]);
            onChange('for', '');
            onChange('for_position', '');
        } else if (key === 'date') {
            onChange('show_date', true);
            if (!filled(content.date)) onChange('date', todayManila());
        } else if (key === 'cc') {
            onChange('show_cc', true);
            if (!Array.isArray(content.cc)) onChange('cc', ['']);
        } else onChange(`show_${key}`, true);
    };
    const setRecipientLabel = (label: 'FOR' | 'TO') => {
        onChange('recipient_label', label);
        if (!shown.for) addField('for');
    };
    const removeSignature = (id: string) => {
        const remaining = signatureBlocks.filter(item => item.id !== id);
        onChange('signature_blocks', remaining);
        if (remaining.length === 0) onChange('show_signature', false);
    };
    const removeField = (key: string) => Object.entries(FIELD_RESET[key]).forEach(([k, v]) => onChange(k, v));
    const removeButton = (key: string, label: string) => editable
        ? <button type="button" className="sheet-meta-remove print:hidden" aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={() => removeField(key)}>×</button>
        : null;

    const [pages, setPages] = useState(1);
    const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
    const sheetHostRef = useRef<HTMLDivElement>(null);
    const [fitScale, setFitScale] = useState(1);
    const [documentZoom, setDocumentZoom] = useState<number | null>(null);
    const displayScale = documentZoom ?? fitScale;

    useLayoutEffect(() => {
        const host = sheetHostRef.current;
        if (!host) return;

        const updateFitScale = () => {
            const availableWidth = host.clientWidth;
            const scale = Math.min(1, Math.max(.3, (availableWidth - 2) / 816));
            // The toolbar rounds 99.5% and above to 100%. Use the same exact
            // scale in that range so screen measurement and print output do
            // not disagree by sub-pixels while both appear to be at 100%.
            setFitScale(scale >= .995 ? 1 : scale);
        };
        updateFitScale();
        const observer = new ResizeObserver(updateFitScale);
        observer.observe(host);
        return () => observer.disconnect();
    }, []);
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

    // Rows between the header and the divider. Letter shows its date separately, at the top right.
    const rowKeys = (pageTemplate === 'memo' ? ['for', 'thru', 'attention', 'from', 'subject', 'date'] : ['for', 'from', 'subject']).filter(key => shown[key]);

    return <div className="document-editor-workspace">
        <div ref={setToolbarTarget} className="document-editor-tools sticky top-0 z-20 mb-6 rounded-lg bg-background p-2 print:hidden" />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
            {editable ? <select
                aria-label="Add field"
                value=""
                onChange={event => {
                    const value = event.target.value;
                    if (value === 'recipient:FOR' || value === 'recipient:TO') setRecipientLabel(value.slice('recipient:'.length) as 'FOR' | 'TO');
                    else if (value) addField(value);
                }}
                className="rounded-lg border-border bg-surface py-1.5 text-sm"
            >
                <option value="">+ Add field</option>
                <option value="recipient:FOR">FOR</option>
                <option value="recipient:TO">TO</option>
                {addable.map(key => <option key={key} value={key}>{key === 'for' ? 'FOR' : key.toUpperCase()}</option>)}
            </select> : <span />}
            <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs text-muted">
                <span className="mr-1" aria-live="polite">{pages} {pages === 1 ? 'page' : 'pages'}</span>
                <button type="button" onClick={() => setDocumentZoom(Math.max(.3, displayScale - .1))} disabled={displayScale <= .3} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface font-semibold text-foreground" aria-label="Zoom document out">−</button>
                <span className="min-w-12 text-center tabular-nums">{Math.round(displayScale * 100)}%</span>
                <button type="button" onClick={() => setDocumentZoom(Math.min(1.5, displayScale + .1))} disabled={displayScale >= 1.5} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface font-semibold text-foreground" aria-label="Zoom document in">+</button>
                <button type="button" onClick={() => setDocumentZoom(null)} aria-pressed={documentZoom === null} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-2.5 font-semibold text-foreground aria-pressed:bg-secondary aria-pressed:text-primary">Fit</button>
                <button type="button" onClick={() => setDocumentZoom(1)} aria-pressed={documentZoom === 1} className="hidden min-h-9 items-center justify-center rounded-lg border border-border bg-surface px-2.5 font-semibold text-foreground aria-pressed:bg-secondary aria-pressed:text-primary sm:inline-flex">100%</button>
            </div>
        </div>
        <div ref={sheetHostRef} className="document-sheet-host w-full overflow-x-auto max-w-full" tabIndex={0} role="region" aria-label="Document writing surface; use the zoom controls or scroll horizontally">
        <div className="document-sheet-scale" style={{ zoom: displayScale }}>
        <article className="document-editor-sheet" data-page-count={pages} aria-label="Document writing surface" style={{ height: pages * PAGE_STEP - PAGE_GAP }}>
        <style>{`
            .document-editor-workspace { width:100%; min-width:0; margin:auto; }
            .document-sheet-scale { width:8.5in; margin:0 auto; transform-origin:top left; }
            @media print {
                .document-editor-workspace, .document-sheet-host { width:8.5in; overflow:visible !important; }
                .document-sheet-scale { width:8.5in; margin:0; zoom:1 !important; }
            }
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
            .document-editor-sheet .sheet-input { display:block; width:100%; margin:0; resize:none; overflow:hidden; min-height:25px; padding:4px 6px; border:0; border-radius:3px; background:transparent; color:inherit; font:inherit; line-height:inherit; box-shadow:none; white-space:pre-wrap; overflow-wrap:break-word; }
            .document-editor-sheet .sheet-input:hover { background:#f7f9fb; }
            .document-editor-sheet .sheet-input:focus { background:#f4f8ff; outline:2px solid #ebedee; }
            .document-editor-sheet .sheet-input::placeholder { color:#94a3b8; }
            .document-editor-sheet .sheet-meta { position:relative; display:grid; grid-template-columns:106px 8px minmax(0,1fr); gap:30px; margin-bottom:8px; }
            .document-editor-sheet .tracking-number { margin:0 0 12px; text-align:right; font-size:9pt; font-weight:700; }
            .document-editor-sheet .sheet-meta strong { padding:4px 0; font-size:11pt; font-weight:700; line-height:1.3; }
            .document-editor-sheet .sheet-value { font-weight:700; }
            .document-editor-sheet .sheet-name { font-size:11pt; line-height:1.3; padding-bottom:0; }
            .document-editor-sheet .sheet-position { font-size:10pt; font-weight:400; line-height:1.25; min-height:22px; padding-top:0; padding-bottom:0; margin-top:0; }
            .document-editor-sheet .sheet-body { margin-top:26px; }
            .document-editor-sheet .sheet-letter-date { position:relative; margin:0 0 22px auto; max-width:48%; }
            .document-editor-sheet .sheet-letter-date .sheet-input { text-align:right; }
            .document-editor-sheet .sheet-letter-date .sheet-meta-remove { position:absolute; left:-22px; top:6px; }
            .document-editor-sheet .sheet-letter-subject { font-weight:700; }
            .document-editor-sheet .sheet-letter-divider { margin-top:22px; }
            .document-editor-sheet .sheet-letter-body { margin-top:22px; }
            .document-editor-sheet .sheet-meta-label { display:flex; align-self:start; align-items:center; justify-content:space-between; gap:4px; min-width:0; }
            .document-editor-sheet .sheet-meta-actions { display:inline-flex; gap:4px; }
            .document-editor-sheet .sheet-recipient-actions { position:absolute; left:0; top:26px; width:106px; display:flex; justify-content:flex-start; gap:6px; }
            .document-editor-sheet .sheet-recipient-add { border:0; border-radius:4px; padding:3px 6px; background:#f1f5f9; color:#334155; font:9pt/1.3 'Document Arial',sans-serif; cursor:pointer; }
            .document-editor-sheet .sheet-recipient-add:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-meta-separator { align-self:start; text-align:center; }
            .document-editor-sheet .sheet-meta-remove { flex:0 0 18px; width:18px; height:18px; display:inline-flex; align-items:center; justify-content:center; padding:0; border:0; border-radius:4px; background:#f1f5f9; color:#475569; font:11pt/1 'Document Arial',sans-serif; cursor:pointer; }
            .document-editor-sheet .sheet-meta-remove:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-meta-remove:focus-visible { outline:2px solid #64748b; outline-offset:2px; }
            .document-editor-sheet .sheet-signature-list { display:grid; gap:16px 24px; margin-top:24px; }
            .document-editor-sheet .sheet-signature-block { position:relative; min-width:0; text-align:left; page-break-inside:avoid; break-inside:avoid; }
            .document-editor-sheet .sheet-signature-block .sheet-input { text-align:left; }
            .document-editor-sheet .sheet-signature-tools { position:absolute; top:0; right:0; z-index:1; display:flex; gap:4px; align-items:center; }
            .document-editor-sheet .sheet-signature-tools button { display:inline-flex; align-items:center; justify-content:center; min-width:20px; height:20px; padding:0 4px; border:0; border-radius:4px; background:#f1f5f9; color:#475569; font:8pt/1.2 'Document Arial',sans-serif; cursor:pointer; }
            .document-editor-sheet .sheet-signature-tools button:hover { background:#e2e8f0; }
            .document-editor-sheet .sheet-signature-tools button[aria-pressed="true"] { background:#cbd5e1; color:#0f172a; }
            .document-editor-sheet .sheet-signature-space { min-height:24px; }
            .document-editor-sheet .sheet-signature-name { max-width:100%; font-weight:700; }
            .document-editor-sheet .sheet-signature-position { max-width:100%; margin-top: -10px;}
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
        {pageTemplate === 'letter' && shown.date && <div className="sheet-letter-date" data-page-field>
            {removeButton('date', 'DATE')}
            <AutoText readOnly={!editable} label="Date" value={displayDocumentDate(String(content.date ?? ''))} placeholder={FIELD_PLACEHOLDERS.date} onChange={value => onChange('date', value)} className="sheet-value" />
        </div>}
        {rowKeys.map(key => key === 'for'
            ? recipients.map((recipient, index) => {
                const suffix = recipients.length > 1 ? ` ${index + 1}` : '';
                return <div key={`for-${recipient.id}`} className="sheet-meta" data-page-field>
                    <div className="sheet-meta-label">
                        {index === 0 ? <>
                            <strong>{recipientLabel}</strong>
                            {editable && <span className="sheet-meta-actions">
                                {recipients.length > 1 && <button type="button" className="sheet-meta-remove print:hidden" aria-label={`Remove ${recipientLabel} 1`} title="Remove first recipient" onClick={() => setRecipients(recipients.slice(1))}>×</button>}
                                {removeButton('for', recipientLabel)}
                            </span>}
                        </> : <>
                            <span />
                            {editable && <button type="button" className="sheet-meta-remove print:hidden" aria-label={`Remove ${recipientLabel} ${index + 1}`} title="Remove recipient" onClick={() => setRecipients(recipients.filter(item => item.id !== recipient.id))}>×</button>}
                        </>}
                    </div>
                    {index === 0 ? <strong className="sheet-meta-separator" aria-hidden="true">:</strong> : <span />}
                    <div>
                        <AutoText readOnly={!editable} label={`${recipientLabel}${suffix}`} value={recipient.name} placeholder={FIELD_PLACEHOLDERS.for} onChange={value => patchRecipient(recipient.id, { name: value })} className="sheet-value sheet-name" />
                        <AutoText readOnly={!editable} label={`${recipientLabel}${suffix} position / designation`} value={recipient.position} placeholder="Position / designation (optional)" onChange={value => patchRecipient(recipient.id, { position: value })} className="sheet-position" />
                        {editable && index === recipients.length - 1 && <div className="sheet-recipient-actions print:hidden">
                            <button type="button" className="sheet-recipient-add" onClick={() => setRecipients([...recipients, { id: newId('recipient'), name: '', position: '' }])}>+ Add recipient</button>
                        </div>}
                    </div>
                </div>;
            })
            : <div key={key} className={`sheet-meta ${pageTemplate === 'letter' && key === 'subject' ? 'sheet-letter-subject' : ''}`} data-page-field>
                <div className="sheet-meta-label"><strong>{key.toUpperCase()}</strong>{removeButton(key, key.toUpperCase())}</div>
                <strong className="sheet-meta-separator" aria-hidden="true">:</strong>
                <div>
                    <AutoText readOnly={!editable} label={key.toUpperCase()} required={['from', 'subject'].includes(key)} value={key === 'date' ? displayDocumentDate(String(content[key] ?? '')) : String(content[key] ?? '')} placeholder={FIELD_PLACEHOLDERS[key]} onChange={value => onChange(key, value)} className={`sheet-value ${['thru', 'attention', 'from'].includes(key) ? 'sheet-name' : ''}`} />
                    {['thru', 'attention', 'from'].includes(key) && <AutoText readOnly={!editable} label={`${key.toUpperCase()} position / designation`} value={String(content[`${key}_position`] ?? '')} placeholder="Position / designation (optional)" onChange={value => onChange(`${key}_position`, value)} className="sheet-position" />}
                </div>
            </div>)}
        {pageTemplate === 'memo' ? <hr className="mt-8" /> : <hr className="sheet-letter-divider" />}
        <section className="sheet-body" aria-label="Document content">
            <RichDocumentEditor hideToolbar={output} toolbarTarget={toolbarTarget} placeholder="Enter document content..." onPageCount={setPages} disabled={disabled || output} value={content.body_document} plainText={content.body ?? ''} onChange={(document, text) => { onChange('body_document', document); onChange('body', text); }} />
        </section>
        {showSignatures && signatureBlocks.length > 0 && <>
            {pageTemplate === 'letter' && <p className="sheet-letter-closing">Sincerely,</p>}
            <section className="sheet-signature-list" aria-label="Signature blocks" style={{ gridTemplateColumns: wideSignatures ? 'repeat(3,minmax(0,1fr))' : 'minmax(0,1fr)' }}>
                {orderedSignatures.map((block, index) => <div
                    className="sheet-signature-block"
                    data-page-field
                    key={block.id}
                    style={{ gridColumn: wideSignatures ? ALIGNS.indexOf(block.align) + 1 : 1, gridRow: block.row }}
                >
                    {editable && <div className="sheet-signature-tools print:hidden">
                        {ALIGNS.map(side => {
                            const Icon = ALIGN_ICONS[side];
                            return <button key={side} type="button" aria-pressed={block.align === side} aria-label={`Align signature ${index + 1} ${side}`} title={`Align ${side}`} onClick={() => patchSignatures(block.id, { align: side })}><Icon size={12} aria-hidden="true" /></button>;
                        })}
                        <button type="button" aria-label={`Remove signature block ${index + 1}`} title="Remove signature" onClick={() => removeSignature(block.id)}>×</button>
                    </div>}
                    <div className="sheet-signature-space" aria-hidden="true" />
                    <AutoText readOnly={!editable} label={`Signatory ${index + 1} name`} value={block.name} placeholder="Signatory name" onChange={value => patchSignatures(block.id, { name: value })} className="sheet-signature-name" />
                    <AutoText readOnly={!editable} label={`Signatory ${index + 1} position or title`} value={block.position} placeholder="Position / title (optional)" onChange={value => patchSignatures(block.id, { position: value })} className="sheet-signature-position" />
                </div>)}
            </section>
        </>}
        {shown.cc && <div className="sheet-meta" data-page-cc>
            <div className="sheet-meta-label"><strong>CC</strong>{removeButton('cc', 'CC')}</div><strong className="sheet-meta-separator" aria-hidden="true">:</strong><div>
                <AutoText readOnly={!editable} label="Copy recipients" value={(content.cc ?? []).join('\n')} placeholder="Copy recipients, one per line" onChange={value => onChange('cc', value.split('\n'))} />
            </div>
        </div>}
        </div>
    </article></div></div></div>;
}
