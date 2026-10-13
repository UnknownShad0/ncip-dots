import QRCode from 'react-qr-code';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type DocumentItem = {
    tracking_number?: string;
    tracking_url?: string;
    title?: string;
    office_name?: string;
    office_short_name?: string | null;
    created_at?: string;
    remarks?: string;
    document_type?: string | { name?: string } | null;
    documentType?: { name?: string } | null;
    other_document_type?: string | null;
    purpose_type?: string;
    transactions?: Array<{
        action?: string | null;
        status?: string | null;
        remarks?: string | null;
        from_office?: string | null;
        from_office_short_name?: string | null;
        to_office?: string | null;
        to_office_short_name?: string | null;
        holder?: string | null;
        holder_short_name?: string | null;
        created_by?: string | null;
        created_by_short_name?: string | null;
        created_at?: string | null;
    }>;
};

const getDocumentTypeName = (document: any): string => {
    const type = document.document_type ?? document.documentType;
    const name = typeof type === 'string' ? type : type?.name ?? '';
    return name.trim().toLowerCase() === 'others' && document.other_document_type
        ? name + ' (' + document.other_document_type + ')'
        : name;
};
type DispositionPrintBlock = {
    key: string;
    type: 'title' | 'fields' | 'remarks-value' | 'trail-remarks' | 'trail-action';
    text?: string;
    start?: number;
    end?: number;
};
const DISPOSITION_PAGE_BODY_HEIGHT = 700;

export default function DocumentDispositionPrint({ document }: { document: DocumentItem }) {
    const transactions = document.transactions ?? [];
    const latest = transactions[0];
    const measure = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<DispositionPrintBlock[][]>([]);
    const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
    const trailBlocks = transactions.flatMap((entry, index) => {
        const actionType = (entry.action || entry.status || '').toLowerCase();
        const fromOffice = entry.from_office_short_name || entry.from_office;
        const toOffice = entry.to_office_short_name || entry.to_office;
        const holder = entry.holder_short_name || entry.holder;
        const office = actionType.includes('releas')
            ? fromOffice || holder || toOffice
            : actionType.includes('receiv')
                ? toOffice || holder || fromOffice
                : holder || fromOffice || toOffice;
        return [
            ...(entry.remarks ? [{ key: `trail-remarks-${index}`, type: 'trail-remarks' as const, text: `Remarks: '${entry.remarks}'` }] : []),
            {
                key: `trail-action-${index}`,
                type: 'trail-action' as const,
                text: `✔ ${entry.action || entry.status || 'Processed'} by ${entry.created_by_short_name || entry.created_by || 'Unknown user'} of ${office || 'Unknown office'}${entry.created_at ? ` at ${entry.created_at}` : ''}`,
            },
        ];
    });
    const blocks: DispositionPrintBlock[] = [
        { key: 'title', type: 'title' },
        { key: 'fields', type: 'fields' },
        ...(document.remarks ? [{ key: 'remarks-value', type: 'remarks-value' as const, text: document.remarks }] : []),
        ...trailBlocks,
    ];
    const serialized = JSON.stringify(blocks);
    const image = (name: string) => `/images/${name}`;

    useLayoutEffect(() => {
        const portal = window.document.createElement('div');
        portal.className = 'disposition-print-portal';
        window.document.body.appendChild(portal);
        setPortalRoot(portal);
        return () => portal.remove();
    }, []);

    useLayoutEffect(() => {
        const node = measure.current;
        if (!node) return;
        const measuredBlocks = Array.from(node.querySelectorAll<HTMLElement>('[data-disposition-block]'));
        if (measuredBlocks.length !== blocks.length) return;

        const next: DispositionPrintBlock[][] = [[]];
        let remaining = DISPOSITION_PAGE_BODY_HEIGHT;
        const newPage = () => {
            next.push([]);
            remaining = DISPOSITION_PAGE_BODY_HEIGHT;
        };
        const getHeight = (element: HTMLElement) => {
            const margin = window.getComputedStyle(element);
            return Math.ceil(
                element.getBoundingClientRect().height
                + Number.parseFloat(margin.marginTop)
                + Number.parseFloat(margin.marginBottom),
            );
        };

        for (const [index, block] of blocks.entries()) {
            const measuredBlock = measuredBlocks[index];
            if (block.text !== undefined) {
                const textNode = measuredBlock.querySelector<HTMLElement>('[data-disposition-text]');
                if (!textNode) continue;
                const fullEnd = block.text.length;
                let start = 0;

                while (start < fullEnd) {
                    textNode.textContent = block.text.slice(start, fullEnd);
                    const fullHeight = getHeight(measuredBlock);
                    if (fullHeight <= remaining) {
                        next[next.length - 1].push({ ...block, start, end: fullEnd });
                        remaining -= fullHeight;
                        break;
                    }
                    if (next[next.length - 1].length > 0) {
                        newPage();
                        continue;
                    }

                    let low = 0;
                    let high = fullEnd - start;
                    while (low < high) {
                        const middle = Math.ceil((low + high) / 2);
                        textNode.textContent = block.text.slice(start, start + middle);
                        if (getHeight(measuredBlock) <= remaining) low = middle;
                        else high = middle - 1;
                    }
                    let end = start + low;
                    if (end < fullEnd && low > 0) {
                        const part = block.text.slice(start, end);
                        const boundary = Math.max(part.lastIndexOf('\n'), part.lastIndexOf(' '));
                        if (boundary > 0) end = start + boundary + 1;
                        if (end > start && /[\uD800-\uDBFF]/.test(block.text[end - 1])) end--;
                    }
                    if (end === start) {
                        newPage();
                        continue;
                    }

                    textNode.textContent = block.text.slice(start, end);
                    const height = getHeight(measuredBlock);
                    next[next.length - 1].push({ ...block, start, end });
                    remaining -= height;
                    start = end;
                    if (start < fullEnd) newPage();
                }
                continue;
            }

            const height = getHeight(measuredBlock);
            if (height > remaining && next[next.length - 1].length > 0) newPage();
            next[next.length - 1].push(block);
            remaining -= height;
        }
        setPages(next);
    }, [portalRoot, serialized]);

    const renderBlock = (block: DispositionPrintBlock) => {
        if (block.type === 'title') return <h1 className="disposition-title">DISPOSITION FORM</h1>;
        if (block.type === 'fields') return <table className="disposition-fields">
            <tbody>
                <tr>
                    <td className="field-label">TO/FOR:</td>
                    <td className="field-value">{latest?.to_office_short_name || latest?.to_office || 'Not specified'}</td>
                    <td className="qr-cell" rowSpan={6}>
                        <div className="disposition-qr">{document.tracking_url ? <QRCode value={document.tracking_url} size={88} level="M" bgColor="#ffffff" fgColor="#111827" /> : 'No tracking URL'}</div>
                        <div className="disposition-qr-note"><strong>DOTS No.:</strong><br />{document.tracking_number || 'Not assigned'}</div>
                    </td>
                </tr>
                <tr><td className="field-label">FROM:</td><td className="field-value">{latest?.from_office_short_name || latest?.from_office || document.office_short_name || document.office_name || 'Not specified'}</td></tr>
                <tr><td className="field-label">SUBJECT:</td><td className="field-value">{document.title || '—'}</td></tr>
                <tr><td className="field-label">PURPOSE:</td><td className="field-value">{document.purpose_type || 'For Appropriate Action'}</td></tr>
                <tr><td className="field-label">DOCUMENT:</td><td className="field-value">{getDocumentTypeName(document) || 'No document attached'}</td></tr>
                <tr><td className="field-label">DATE CREATED:</td><td className="field-value">{document.created_at || '—'}</td></tr>
            </tbody>
        </table>;
        const start = block.start ?? 0;
        const end = block.end ?? block.text?.length ?? 0;
        const text = block.text?.slice(start, end);
        const isLastPiece = end === block.text?.length;
        if (block.type === 'remarks-value') return <section className="disposition-remarks">
            <div className="disposition-remarks-heading">
                {start === 0 && <strong className="disposition-remarks-label">REMARKS:</strong>}
                <div className="disposition-remarks-value" data-disposition-text>{text}</div>
            </div>
        </section>;
        if (block.type === 'trail-remarks') return <div className={`disposition-trail-remarks ${start === 0 ? 'disposition-trail-first-piece' : ''} ${isLastPiece ? 'disposition-trail-last-piece' : ''}`} data-disposition-text>{text}</div>;
        return <div className={`disposition-trail-action ${isLastPiece ? 'disposition-trail-last-piece' : ''}`} data-disposition-text>{text}</div>;
    };

    const renderFooter = (pageIndex: number) => <footer className="disposition-footer">
        <div className="disposition-footer-main">
            <img className="disposition-logo" src={image('bagong-pilipinas.png')} alt="Bagong Pilipinas" />
            <div className="disposition-footer-details">
                <div className="disposition-footer-copy"><strong>{(document.office_name || latest?.from_office || 'Office not assigned').toUpperCase()}</strong><br />6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue, South Triangle, Quezon City 1103</div>
                <div className="disposition-contact-row">
                    <span className="disposition-contact-item"><img className="disposition-contact-icon" src={image('telephone-icon.png')} alt="" />(02) 875 1200</span>
                    <span className="disposition-contact-item"><img className="disposition-contact-icon" src={image('website-icon.png')} alt="" />ncip.gov.ph</span>
                    <span className="disposition-contact-item"><img className="disposition-contact-icon" src={image('email-icon.png')} alt="" />csc@ncip.gov.ph</span>
                </div>
                <img className="disposition-tagline" src={image('ncip-footer.png')} alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran" />
            </div>
        </div>
        <span className="disposition-page-number">{pageIndex + 1} / {pages.length}</span>
    </footer>;

    if (!portalRoot) return null;

    return createPortal(
        <article className="disposition-print-root" data-printing="true" data-ready={pages.length > 0}>
            <style>{`
                @page { size: letter portrait; margin: 0; }
                .disposition-sheet { box-sizing: border-box; width: 8.5in; height: 11in; padding: .5in .65in; margin: 0 0 28px; display: grid; grid-template-rows: 96px minmax(0, 728px) 104px; row-gap: 16px; color: #111; font: 9pt Arial, Helvetica, sans-serif; background: #fff; }
                .disposition-header { display: block; width: 100%; height: 90px; object-fit: contain; }
                .disposition-body { min-height: 0; overflow: hidden; }
                .disposition-content-block { display: flow-root; }
                .disposition-title { margin: 0 0 12px; text-align: center; font: bold 12pt Georgia, 'Times New Roman', serif; }
                .disposition-fields { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.3pt; }
                .disposition-fields td { border: 1px solid #b9b9b9; padding: 4px 5px; vertical-align: middle; overflow-wrap: anywhere; }
                .disposition-fields .field-label { width: 19%; font-size: 7.4pt; font-weight: bold; text-transform: uppercase; }
                .disposition-fields .field-value { width: 58%; }
                .disposition-fields .qr-cell { width: 23%; text-align: center; }
                .disposition-qr { width: .95in; height: .95in; margin: 0 auto 5px; border: 1px dashed #777; display: flex; align-items: center; justify-content: center; color: #555; font-size: 8pt; font-weight: bold; }
                .disposition-qr svg { width: 88px; height: 88px; }
                .disposition-qr-note { font-size: 7pt; line-height: 1.4; overflow-wrap: anywhere; }
                .disposition-remarks { margin-top: 5px; font-size: 8.5pt; overflow-wrap: anywhere; }
                .disposition-remarks-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; line-height: 1.4; }
                .disposition-remarks-label { flex: 0 0 .8in; font-size: 7.4pt; font-weight: bold; text-transform: uppercase; }
                .disposition-remarks-value { flex: 1; min-width: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
                .disposition-trail-remarks { margin: 4px 0 12px .3in; line-height: 1.45; overflow-wrap: anywhere; }
                .disposition-trail-remarks:not(.disposition-trail-first-piece) { margin-top: 0; }
                .disposition-trail-remarks:not(.disposition-trail-last-piece) { margin-bottom: 0; }
                .disposition-trail-action { margin: 0; padding-left: .35in; line-height: 1.45; overflow-wrap: anywhere; break-inside: avoid; }
                .disposition-trail-action.disposition-trail-last-piece { margin-bottom: 8px; }
                .disposition-footer { box-sizing: border-box; border-top: 1px solid #aaa; padding-top: 10px; position: relative; font: 8px/1.4 Arial, sans-serif; }
                .disposition-footer-main { display: flex; align-items: center; gap: 10px; width: 100%; }
                .disposition-logo { flex: 0 0 .55in; width: .60in; height: .60in; object-fit: contain; }
                .disposition-footer-details { flex: 1; min-width: 0; }
                .disposition-footer-copy { font-size: 6.8pt; line-height: 1.4; }
                .disposition-footer-copy strong { font-size: 8.5pt; }
                .disposition-contact-row { display: flex; justify-content: left; flex-wrap: wrap; gap: 3px 9px; font-size: 6.5pt; line-height: 1.3; }
                .disposition-contact-item { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
                .disposition-contact-icon { width: 8px; height: 8px; object-fit: contain; }
                .disposition-tagline { display: block; width: calc(100% - .60in - 10px); max-height: .20in; object-fit: contain; object-position: left center; margin: 0; }
                .disposition-page-number { position: absolute; bottom: 0; right: 0; font-size: 9px; color: #666; }
                .disposition-measure { position: fixed; top: 0; left: -10000px; width: 691.2px; visibility: hidden; }
                .disposition-measure .disposition-sheet { margin: 0; box-shadow: none; }
                @media print {
                    body.disposition-printing * { visibility: hidden !important; }
                    body.disposition-printing .disposition-print-root,
                    body.disposition-printing .disposition-print-root * { visibility: visible !important; }
                    body.disposition-printing > *:not(.disposition-print-portal) { display: none !important; }
                    body.disposition-printing > .disposition-print-portal { display: block !important; position: static !important; width: 8.5in; margin: 0 auto; overflow: visible !important; }
                    body.disposition-printing .disposition-print-root[data-printing="true"] { display: block !important; position: static !important; width: 8.5in; margin: 0; background: #fff; }
                    .disposition-sheet { margin: 0; box-shadow: none; break-after: page; break-inside: avoid; }
                    .disposition-sheet:last-of-type { break-after: auto; }
                    .disposition-body { overflow: hidden; }
                    .disposition-print-root img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .disposition-measure { display: none !important; }
                }
                @media screen { .disposition-print-root { position: fixed; top: 0; left: -10000px; display: block; visibility: hidden; } }
            `}</style>
            <div ref={measure} className="disposition-measure" aria-hidden="true">
                <main className="disposition-sheet">
                    <div className="disposition-header" />
                    <div className="disposition-body">
                        {blocks.map(block => <div key={block.key} data-disposition-block className="disposition-content-block">{renderBlock(block)}</div>)}
                    </div>
                    <div className="disposition-footer" />
                </main>
            </div>
            <div className="disposition-pages">
                {pages.map((pageBlocks, pageIndex) => <article key={pageIndex} className="disposition-sheet" aria-label={`Disposition form page ${pageIndex + 1}`}>
                    {pageIndex === 0
                        ? <header className="disposition-header"><img src={image('header.png')} alt="National Commission on Indigenous Peoples" /></header>
                        : <div className="disposition-header" aria-hidden="true" />}
                    <div className="disposition-body">{pageBlocks.map(block => <div key={block.key} className="disposition-content-block">{renderBlock(block)}</div>)}</div>
                    {renderFooter(pageIndex)}
                </article>)}
            </div>
        </article>,
        portalRoot,
    );
}

