import { useLayoutEffect, useRef } from 'react';
import RichDocumentEditor from './RichDocumentEditor';

export type DocumentTemplate = {
    name: string; version: number; version_id: number | null;
    header_mode: 'image' | 'logos'; header_text: string[]; repeat_header: boolean;
    header_images: { src: string; alt: string }[];
    footer_seal: { src: string; alt: string }; footer_tagline: { src: string; alt: string };
};

function AutoText({ value, label, placeholder, required, onChange, className = '' }: {
    value: string; label: string; placeholder?: string; required?: boolean; onChange: (value: string) => void; className?: string;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);
    useLayoutEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = `${ref.current.scrollHeight}px`; } }, [value]);
    return <textarea ref={ref} aria-label={label} placeholder={placeholder} required={required} rows={1} spellCheck value={value} onChange={event => onChange(event.target.value)} className={`sheet-input ${className}`} />;
}

/** Continuous writing surface. The server-rendered PDF is the paginated preview. */
export default function PaginatedDocument({ title, content, onTitleChange, onChange, disabled = false }: {
    title: string; content: Record<string, any>; onTitleChange: (value: string) => void; onChange: (key: string, value: any) => void; disabled?: boolean;
}) {
    const template = content.template as DocumentTemplate | undefined;
    return <article className="document-editor-sheet" aria-label="Document writing surface">
        <style>{`
            .document-editor-sheet { box-sizing:border-box; width:8.5in; min-height:11in; margin:auto; padding:.5in .65in; background:#fff; color:#111; font:11pt/1.55 Arial,sans-serif; box-shadow:0 2px 5px #15263612,0 20px 45px #15263612; }
            .document-editor-sheet .document-header { height:96px; margin-bottom:28px; display:flex; align-items:center; justify-content:center; }
            .document-editor-sheet .full-header { width:100%; height:90px; object-fit:contain; }
            .document-editor-sheet .logo-header { display:grid; width:100%; grid-template-columns:75px minmax(0,1fr) 75px; gap:12px; align-items:center; text-align:center; font-size:10pt; }
            .document-editor-sheet .logo-header img { max-width:70px; max-height:70px; object-fit:contain; }
            .document-editor-sheet .logo-header p:nth-child(2) { font-weight:700; }
            .document-editor-sheet .sheet-input { display:block; width:100%; resize:none; overflow:hidden; min-height:30px; padding:4px 6px; border:0; border-radius:3px; background:transparent; color:inherit; font:inherit; line-height:inherit; box-shadow:none; }
            .document-editor-sheet .sheet-input:hover { background:#f7f9fb; }
            .document-editor-sheet .sheet-input:focus { background:#f4f8ff; outline:2px solid #93c5fd; }
            .document-editor-sheet .sheet-input::placeholder { color:#94a3b8; }
            .document-editor-sheet .sheet-title { text-align:center; font-size:14pt; font-weight:600; margin-bottom:18px; }
            .document-editor-sheet .sheet-meta { display:grid; grid-template-columns:106px minmax(0,1fr); gap:16px; margin-bottom:8px; }
            .document-editor-sheet .sheet-meta strong { padding:4px 0; font-size:10pt; }
            .document-editor-sheet .sheet-body { margin-top:26px; }
            .document-editor-sheet .sheet-footer { margin-top:32px; border-top:1px solid #b9b9b9; padding-top:12px; display:flex; gap:12px; align-items:center; font:8px/1.4 Arial,sans-serif; }
            .document-editor-sheet .sheet-footer strong { font-size:10px; }
            .document-editor-sheet .sheet-seal { width:55px; height:55px; object-fit:contain; }
            .document-editor-sheet .sheet-tagline { height:17px; max-width:100%; object-fit:contain; object-position:left; margin-top:5px; }
        `}</style>
        <header className="document-header">
            {template?.header_mode === 'logos' ? <div className="logo-header">
                <img src={template.header_images[0].src} alt={template.header_images[0].alt} />
                <div>{template.header_text.map((line, i) => <p key={i}>{line}</p>)}</div>
                {template.header_images[1] ? <img src={template.header_images[1].src} alt={template.header_images[1].alt} /> : <span />}
            </div> : <img className="full-header" src={template?.header_images[0]?.src || '/images/header.png'} alt={template?.header_images[0]?.alt || 'National Commission on Indigenous Peoples'} />}
        </header>
        <AutoText label="Document title" required value={title} placeholder="DOCUMENT TITLE" onChange={onTitleChange} className="sheet-title" />
        {(['for', 'thru', 'attention', 'from', 'subject', 'date'] as const).map(key => <div className="sheet-meta" key={key}>
            <strong>{key.toUpperCase()}:</strong>
            <AutoText label={key.toUpperCase()} required={['from', 'subject', 'date'].includes(key)} value={String(content[key] ?? '')} placeholder={key === 'date' ? 'YYYY-MM-DD' : `${key.toUpperCase()}${['thru', 'attention'].includes(key) ? ' (optional)' : ''}`} onChange={value => onChange(key, value)} />
        </div>)}
        <section className="sheet-body" aria-label="Document content">
            <RichDocumentEditor disabled={disabled} value={content.body_document} plainText={content.body ?? ''} onChange={(document, text) => { onChange('body_document', document); onChange('body', text); }} />
        </section>
        <div className="sheet-meta mt-7"><strong>CC:</strong><AutoText label="Copy recipients" value={(content.cc ?? []).join('\n')} placeholder="Copy recipients, one per line (optional)" onChange={value => onChange('cc', value.split('\n'))} /></div>
        <footer className="sheet-footer">
            <img className="sheet-seal" src={template?.footer_seal.src || '/images/bagong-pilipinas.png'} alt="Bagong Pilipinas" />
            <div><strong>NATIONAL COMMISSION ON INDIGENOUS PEOPLES</strong><p>6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue,<br />South Triangle, Quezon City 1103</p><p>(02) 875 1200 · ncip.gov.ph · csc@ncip.gov.ph</p><img className="sheet-tagline" src={template?.footer_tagline.src || '/images/ncip-footer.png'} alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran" /></div>
        </footer>
    </article>;
}
