import QRCode from 'react-qr-code';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type PrintRouteStep = {
    id?: number;
    office?: string | null;
    position: number;
    status: string;
    child_routes?: PrintRoute[];
};

type PrintRoute = {
    id: number;
    mode?: 'sequential' | 'parallel' | null;
    status?: string | null;
    steps: PrintRouteStep[];
};

type DocumentItem = {
    tracking_number?: string;
    tracking_url?: string | null;
    title?: string;
    office_name?: string;
    office_short_name?: string | null;
    created_at?: string;
    remarks?: string;
    document_type?: string | { name?: string } | null;
    documentType?: { name?: string } | null;
    other_document_type?: string | null;
    purpose_type?: string;
    route_mode?: 'sequential' | 'parallel' | null;
    route_status?: string | null;
    route_steps?: Array<{ office?: string | null; position: number; status: string }>;
    route_tree?: PrintRoute[];
    transactions?: Array<{
        id?: number;
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
        created_at_timestamp?: number | null;
    }>;
};

const getDocumentTypeName = (document: any): string => {
    const type = document.document_type ?? document.documentType;
    const name = typeof type === 'string' ? type : type?.name ?? '';
    return name.trim().toLowerCase() === 'others' && document.other_document_type
        ? name + ' (' + document.other_document_type + ')'
        : name;
};

// ---------------------------------------------------------------------------
// "Journey line" on paper
//   - One thin vertical line. Filled dot = done, hollow dot = still to do.
//   - Offices that forward the document appear as an indented branch.
//   - Geometry (px): each lane is LANE_W wide, the dot is 9px at top 3px (center y = 7.5px).
//   - Rows use padding (never margin) so the line stays continuous across blocks and pages.
// ---------------------------------------------------------------------------
const LANE_W = 22;
const DOT_CENTER_Y = 7.5;
const PENDING_STATUSES = ['waiting', 'available', 'in_progress', 'waiting_on_branch', 'paused'];

const modeLabel = (mode?: string | null) => mode === 'parallel' ? 'Parallel approval' : 'Sequential approval';

const pendingStatusText = (status: string) => ({
    waiting: 'Waiting for its turn',
    available: 'Waiting to receive the document',
    in_progress: 'Reviewing now',
    waiting_on_branch: 'Waiting for the offices it forwarded to',
    paused: 'On hold',
}[status] ?? status.replaceAll('_', ' '));

const routeStatusText = (status?: string | null) => {
    if (!status) return 'Still in progress';
    if (status === 'approved') return 'Approved by all offices';
    if (['pending', 'in_progress', 'ongoing'].includes(status)) return 'Still in progress';
    return status.replaceAll('_', ' ');
};

type Rail = { lane: number; from: 'top' | 'dot'; to: 'bottom' | 'dot'; dashed: boolean };

type JourneyRow = {
    kind: 'event' | 'label' | 'todo';
    depth: number;
    // event
    date?: string;
    headline?: string;
    detail?: string;
    handledBy?: string;
    remarks?: string;
    latest?: boolean;
    // label
    labelText?: string;
    // todo
    office?: string;
    statusText?: string;
    note?: string;
    branchStart?: boolean;
    // computed layout
    rails?: Rail[];
    elbowFrom?: number;
};

type DispositionPrintBlock = {
    key: string;
    type: 'title' | 'fields' | 'remarks-value' | 'journey-heading' | 'journey-row' | 'journey-empty';
    text?: string;
    start?: number;
    end?: number;
    row?: JourneyRow;
};

const DISPOSITION_PAGE_BODY_HEIGHT = 700;

export default function DocumentDispositionPrint({ document }: { document: DocumentItem }) {
    const transactions = [...(document.transactions ?? [])].sort((left, right) => {
        const leftTime = left.created_at_timestamp ?? 0;
        const rightTime = right.created_at_timestamp ?? 0;
        return leftTime - rightTime || (left.id ?? 0) - (right.id ?? 0);
    });
    const latest = transactions.at(-1);
    const measure = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<DispositionPrintBlock[][]>([]);
    const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);

    // ----- Done: what already happened, oldest first, in plain words -----
    const eventRows: JourneyRow[] = transactions.map((entry, index) => {
        const action = (entry.action || '').toLowerCase();
        const status = (entry.status || '').toLowerCase();
        const fromOffice = entry.from_office_short_name || entry.from_office;
        const toOffice = entry.to_office_short_name || entry.to_office;
        const holder = entry.holder_short_name || entry.holder;
        const anyOffice = toOffice || holder || fromOffice;
        let headline = entry.action || entry.status || 'Processed';
        let detail = anyOffice ? `at ${anyOffice}` : '';

        if (action.includes('releas') || action.includes('forward')) {
            headline = 'Forwarded';
            detail = fromOffice && toOffice && fromOffice !== toOffice
                ? `from ${fromOffice} to ${toOffice}`
                : toOffice ? `to ${toOffice}` : fromOffice ? `by ${fromOffice}` : '';
        } else if (action.includes('receiv')) {
            headline = 'Received';
            detail = anyOffice ? `by ${toOffice || holder || fromOffice}` : '';
        } else if (action.includes('change') || status.includes('change')) {
            headline = 'Changes requested';
            detail = anyOffice ? `by ${holder || fromOffice || toOffice}` : '';
        } else if (action.includes('reject') || status.includes('reject')) {
            headline = 'Rejected';
            detail = anyOffice ? `by ${holder || fromOffice || toOffice}` : '';
        } else if (action.includes('approv') || status.includes('approv')) {
            headline = 'Approved';
            detail = anyOffice ? `by ${holder || fromOffice || toOffice}` : '';
        } else if (action.includes('terminal')) {
            headline = 'Marked as finished';
        } else if (action.includes('creat') || action.includes('regist') || action.includes('draft')) {
            headline = 'Document created';
        }

        return {
            kind: 'event',
            depth: 0,
            date: entry.created_at || 'Date unavailable',
            headline,
            detail,
            handledBy: entry.created_by_short_name || entry.created_by || '',
            remarks: entry.remarks || '',
            latest: index === transactions.length - 1,
        };
    });

    // ----- Still to do: offices that have not finished, with forwarded branches indented -----
    const routeTree: PrintRoute[] = document.route_tree?.length
        ? document.route_tree
        : document.route_steps?.length
            ? [{
                id: 0,
                mode: document.route_mode || 'sequential',
                status: document.route_status || 'pending',
                steps: document.route_steps.map((step, index) => ({ ...step, id: index + 1, child_routes: [] })),
            }]
            : [];
    const collectTodo = (routes: PrintRoute[], depth: number, ownerOffice?: string | null): JourneyRow[] => routes.flatMap((route) => {
        let first = true;
        return route.steps.filter((step) => PENDING_STATUSES.includes(step.status)).flatMap((step): JourneyRow[] => {
            const row: JourneyRow = {
                kind: 'todo',
                depth,
                office: step.office || 'Office unavailable',
                statusText: pendingStatusText(step.status),
                note: depth > 0 && first ? `Forwarded by ${ownerOffice || 'the office above'} · ${modeLabel(route.mode)}` : undefined,
                branchStart: depth > 0 && first,
            };
            first = false;
            return [row, ...collectTodo(step.child_routes ?? [], depth + 1, step.office)];
        });
    });
    const todoRows = collectTodo(routeTree, 0);
    const modes = Array.from(new Set(routeTree.map((route) => route.mode || 'sequential')));
    const labelText = `STILL TO DO${modes.length === 1 ? ` · ${modeLabel(modes[0])}` : ''}`;

    const rows: JourneyRow[] = [
        ...eventRows,
        ...(todoRows.length ? [{ kind: 'label', depth: 0, labelText } as JourneyRow] : []),
        ...todoRows,
    ];

    // Work out which line pieces each row draws, so the line connects from the first dot to the last.
    rows.forEach((row, index) => {
        const previous = rows[index - 1];
        const next = rows[index + 1];
        const depth = row.depth;
        const dashed = row.kind !== 'event'; // "dashed" now only means the lighter "still to do" color
        const firstInBranch = Boolean(row.branchStart);
        const from: 'top' | 'dot' = firstInBranch || index === 0 ? 'dot' : 'top';
        // This row's own line ends at its dot when the next row leaves this lane,
        // or when the next row starts a different branch on this same lane.
        const endsHere = !next || next.depth < depth || (next.branchStart === true && next.depth === depth);
        const to: 'bottom' | 'dot' = row.kind !== 'label' && endsHere ? 'dot' : 'bottom';
        const rails: Rail[] = [];

        if (!(from === 'dot' && to === 'dot')) rails.push({ lane: depth, from, to, dashed });
        // Lines of the lanes to the left (parents). A parent's line only keeps going while something
        // still attaches to it further down: a later row on that same lane, or another branch starting from it.
        // (Rows on shallower lanes that come after the branch are NOT a reason to keep a deeper lane going.)
        for (let lane = 0; lane < depth; lane++) {
            let continues = false;
            for (let j = index + 1; j < rows.length; j++) {
                if (rows[j].depth <= lane) { continues = rows[j].depth === lane; break; }
                if (rows[j].branchStart && rows[j].depth === lane + 1) { continues = true; break; }
            }
            if (continues) rails.push({ lane, from: 'top', to: 'bottom', dashed: true });
            else if (firstInBranch && lane === depth - 1) rails.push({ lane, from: 'top', to: 'dot', dashed: true });
        }
        row.rails = rails;
        row.elbowFrom = firstInBranch ? depth - 1 : undefined;
    });

    const blocks: DispositionPrintBlock[] = [
        { key: 'title', type: 'title' },
        { key: 'fields', type: 'fields' },
        ...(document.remarks ? [{ key: 'remarks-value', type: 'remarks-value' as const, text: document.remarks }] : []),
        { key: 'journey-heading', type: 'journey-heading' },
        ...(rows.length
            ? rows.map((row, index): DispositionPrintBlock => ({ key: `journey-${index}`, type: 'journey-row', row }))
            : [{ key: 'journey-empty', type: 'journey-empty' as const }]),
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

    const renderJourneyRow = (row: JourneyRow) => {
        const dotLeft = row.depth * LANE_W;

        return <div className="journey-row" style={{ paddingLeft: (row.depth + 1) * LANE_W + 4 }}>
            {row.rails?.map((rail, index) => {
                const top = rail.from === 'dot' ? DOT_CENTER_Y : 0;
                const style: React.CSSProperties = { left: rail.lane * LANE_W + 4, top };
                if (rail.to === 'bottom') style.bottom = 0;
                else style.height = DOT_CENTER_Y - top;
                return <span key={index} className={`journey-rail${rail.dashed ? ' is-dashed' : ''}`} style={style} aria-hidden="true" />;
            })}
            {row.elbowFrom !== undefined && <span className="journey-elbow" style={{ left: row.elbowFrom * LANE_W + 4, width: LANE_W, top: DOT_CENTER_Y }} aria-hidden="true" />}
            {row.kind === 'event' && <span className="journey-dot-done" style={{ left: dotLeft }} aria-hidden="true" />}
            {row.kind === 'todo' && <span className="journey-dot-todo" style={{ left: dotLeft }} aria-hidden="true" />}

            {row.kind === 'event' && <>
                <div className="journey-date"><strong>{row.date}</strong>{row.latest && <span className="journey-latest"> · Latest update</span>}</div>
                <div><strong>{row.headline}</strong>{row.detail ? ` ${row.detail}` : ''}</div>
                {row.handledBy && <div className="journey-meta">Recorded by {row.handledBy}</div>}
                {row.remarks && <div className="journey-remarks">Note: {row.remarks}</div>}
            </>}
            {row.kind === 'label' && <div className="journey-label">{row.labelText}</div>}
            {row.kind === 'todo' && <>
                {row.note && <div className="journey-meta">{row.note}</div>}
                <div><strong>{row.office}</strong> · {row.statusText}</div>
            </>}
        </div>;
    };

    const renderBlock = (block: DispositionPrintBlock) => {
        if (block.type === 'title') return <h1 className="disposition-title">DISPOSITION FORM</h1>;
        if (block.type === 'fields') return <table className="disposition-fields">
            <tbody>
                <tr>
                    <td className="field-label">TO/FOR:</td>
                    <td className="field-value">{document.route_steps?.map((step) => step.office).filter(Boolean).join(', ') || latest?.to_office_short_name || latest?.to_office || 'Not specified'}</td>
                    <td className="qr-cell" rowSpan={7}>
                        <div className="disposition-qr">{document.tracking_url ? <QRCode value={document.tracking_url} size={88} level="M" bgColor="#ffffff" fgColor="#111827" /> : 'No tracking URL'}</div>
                        <div className="disposition-qr-note"><strong>DOTS No.:</strong><br />{document.tracking_number || 'Not assigned'}</div>
                    </td>
                </tr>
                <tr><td className="field-label">FROM:</td><td className="field-value">{latest?.from_office_short_name || latest?.from_office || document.office_short_name || document.office_name || 'Not specified'}</td></tr>
                <tr><td className="field-label">SUBJECT:</td><td className="field-value">{document.title || '—'}</td></tr>
                <tr><td className="field-label">PURPOSE:</td><td className="field-value">{document.purpose_type || 'For Appropriate Action'}</td></tr>
                <tr><td className="field-label">DOCUMENT:</td><td className="field-value">{getDocumentTypeName(document) || 'No document attached'}</td></tr>
                <tr><td className="field-label">DATE CREATED:</td><td className="field-value">{document.created_at || '—'}</td></tr>
                <tr><td className="field-label">APPROVAL FLOW:</td><td className="field-value">{document.route_mode ? `${modeLabel(document.route_mode)}. ${routeStatusText(document.route_status)}.` : 'Standard office routing'}</td></tr>
            </tbody>
        </table>;
        if (block.type === 'journey-heading') return <>
            <h2 className="disposition-section-heading">WHERE THIS DOCUMENT HAS BEEN</h2>
            <p className="journey-legend">● Done &nbsp;&nbsp; ○ Still to do &nbsp;&nbsp; Newest at the bottom of the done list</p>
        </>;
        if (block.type === 'journey-empty') return <p className="journey-empty">No activity has been recorded yet.</p>;
        if (block.type === 'journey-row' && block.row) return renderJourneyRow(block.row);
        const start = block.start ?? 0;
        const end = block.end ?? block.text?.length ?? 0;
        const text = block.text?.slice(start, end);
        if (block.type === 'remarks-value') return <section className="disposition-remarks">
            <div className="disposition-remarks-heading">
                {start === 0 && <strong className="disposition-remarks-label">REMARKS:</strong>}
                <div className="disposition-remarks-value" data-disposition-text>{text}</div>
            </div>
        </section>;
        return null;
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
                .disposition-section-heading { margin: 12px 0 3px; border-bottom: 1px solid #777; padding-bottom: 3px; font-size: 8pt; font-weight: bold; letter-spacing: .04em; break-after: avoid; }
                .journey-legend { margin: 0 0 8px; font-size: 7.4pt; color: #333; }
                .journey-empty { margin: 6px 0; font-size: 8.5pt; }
                .journey-row { position: relative; box-sizing: border-box; padding-bottom: 9px; font-size: 8.5pt; line-height: 1.4; overflow-wrap: anywhere; break-inside: avoid; }
                .journey-rail { position: absolute; width: 0; border-left: 1px solid #111; }
                .journey-rail.is-dashed { border-left: 1px dashed #444; }
                .journey-elbow { position: absolute; height: 0; border-top: 1px dashed #444; }
                .journey-dot-done { position: absolute; top: 3px; width: 0; height: 0; border: 4.5px solid #111; border-radius: 50%; }
                .journey-dot-todo { position: absolute; top: 3px; box-sizing: content-box; width: 6px; height: 6px; border: 1.5px solid #111; border-radius: 50%; background: #fff; }
                .journey-date { font-size: 7.6pt; color: #333; }
                .journey-latest { font-weight: bold; color: #111; }
                .journey-meta { font-size: 7.6pt; color: #444; }
                .journey-remarks { margin-top: 2px; white-space: pre-wrap; }
                .journey-label { font-size: 7.6pt; font-weight: bold; letter-spacing: .04em; color: #333; }
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
                    .disposition-print-root .journey-dot-done, .disposition-print-root .journey-dot-todo { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
