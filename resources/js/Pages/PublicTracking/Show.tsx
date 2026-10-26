import WorkspaceDialog from '@/Components/WorkspaceDialog';
import { Head, router, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Download, Eye, FileSignature, Search, Send, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

type Trail = {
    action?: string | null;
    status?: string | null;
    from_office?: string | null;
    to_office?: string | null;
    holder?: string | null;
    created_at?: string | null;
};

type PublicRouteStep = {
    id: number;
    office?: string | null;
    position: number;
    status: string;
    signature_required?: boolean;
    signature_status?: string | null;
    signed_at?: string | null;
    child_routes?: PublicRoute[];
};

type PublicRoute = {
    id: number;
    mode: 'sequential' | 'parallel';
    status: string;
    from_office?: string | null;
    steps: PublicRouteStep[];
};

type TrackedDocument = {
    tracking_number: string;
    title?: string | null;
    status?: string | null;
    document_type?: string | null;
    purpose?: string | null;
    office_name?: string | null;
    created_at?: string | null;
    route_mode?: 'sequential' | 'parallel' | null;
    route_status?: string | null;
    route_from_office?: string | null;
    route_steps?: Array<{ office?: string | null; position: number; status: string }>;
    route_tree?: PublicRoute[];
    trails: Trail[];
};

type WorkflowFile = { id: number; name: string; type: string; size_bytes: number; is_pdf: boolean; view_url?: string | null; download_url: string };
type WorkflowOption = { id: number; name: string };
type QrWorkflow = {
    state: 'public' | 'otp_pending' | 'verified';
    can_start: boolean;
    masked_email?: string | null;
    request_otp_url: string;
    verify_otp_url?: string | null;
    resend_otp_url?: string | null;
    resend_available_at?: string | null;
    session_end_url: string;
    user?: { name: string; office?: string | null; role?: string | null } | null;
    expires_at?: string | null;
    step_status?: string | null;
    can_receive: boolean;
    can_approve: boolean;
    can_forward: boolean;
    receive_url?: string | null;
    decision_url?: string | null;
    wet_signed_url?: string | null;
    forward_url?: string | null;
    signature_status?: string | null;
    step_signature_required?: boolean;
    source_document_file_id?: number | null;
    ipluma_available: boolean;
    files: WorkflowFile[];
    action_types: WorkflowOption[];
    offices: WorkflowOption[];
};

const routeStepLabels: Record<string, string> = {
    waiting: 'Waiting',
    available: 'Waiting to receive',
    in_progress: 'In progress',
    waiting_on_branch: 'Waiting on branch',
    approved: 'Approved',
    changes_requested: 'Changes requested',
    rejected: 'Rejected',
    paused: 'Paused',
};

const routeStepLabel = (status: string) => routeStepLabels[status] ?? status.replaceAll('_', ' ');

// Git-graph geometry shared by the route map and the activity timeline:
//   - rail at x = 7px (`left-[6px]` + 2px border)
//   - dot is 14px (h-3.5 w-3.5) at top-4, so its center is y = 23px
//   - cards start at x = 32px (pl-8)
//   - a forwarded branch is rendered INSIDE its parent step's <li>, right under the parent card,
//     indented 32px (ml-8). Its header is 8px top padding + 24px label row + 8px gap = 40px,
//     and a connector drops from the parent card's bottom edge into the child lane.
//   - the terminal card (if any) sits right below the last route with 12px top padding;
//     its dot center is at y = 12 + 23 = 35px, and the last route's main rail continues
//     (`continues`) all the way down to it.
// Rows are separated with padding (never margin) so rails stay continuous.
// One color per depth, like colored git lanes. Full class names so Tailwind can see them.
const LANE_BORDER = ['border-blue-500/60', 'border-sky-500/70', 'border-violet-500/70', 'border-amber-500/70'];
const LANE_TEXT = ['text-blue-800', 'text-sky-800', 'text-violet-800', 'text-amber-800'];
const LANE_BG = ['bg-blue-50', 'bg-sky-50', 'bg-violet-50', 'bg-amber-50'];

const findTerminalTrail = (trails: Trail[]) => trails.find((trail) => trail.status?.toLowerCase() === 'terminal');

export default function Show({ document, workflow }: { document: TrackedDocument; workflow: QrWorkflow }) {
    return (
        <>
            <Head title={`Track ${document.tracking_number}`} />
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
                <div className="mx-auto max-w-3xl">
                    <header className="mb-6 text-center">
                        <img src="/images/logo/ncip-logo.png" alt="NCIP logo" className="mx-auto mb-3 h-16 w-16 object-contain" />
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Document Tracking System</p>
                        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Public document tracking</h1>
                        <p className="mt-2 text-sm text-slate-600">Current routing information for this tracking number.</p>
                    </header>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="document-summary-title">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                            <div className="min-w-0">
                                <h2 id="document-summary-title" className="break-words text-xl font-semibold">{document.title || 'Untitled document'}</h2>
                                <p className="mt-1 break-all font-mono text-sm text-slate-600">{document.tracking_number}</p>
                            </div>
                            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium capitalize text-primary">{document.status || 'Status unavailable'}</span>
                        </div>

                        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Detail label="Document type" value={document.document_type} />
                            <Detail label="Purpose" value={document.purpose} />
                            <Detail label="Originating office" value={document.office_name} />
                            <Detail label="Date created" value={document.created_at} />
                        </dl>
                    </section>

                    {workflow.can_start && <QrWorkflowPanel workflow={workflow} document={document} />}

                    {document.route_tree?.length || document.route_steps?.length || findTerminalTrail(document.trails) ? <RouteBranchMap document={document} /> : null}

                    {/* <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="routing-history-title">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <h2 id="routing-history-title" className="text-lg font-semibold">Activity timeline</h2>
                                <p className="mt-1 text-sm text-slate-600">Latest activity first.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{document.trails.length} events</span>
                        </div>
                        {document.trails.length ? <ol className="relative mt-5" aria-label="Routing activity, latest first">
                            {document.trails.map((trail, index) => {
                                const isFirst = index === 0;
                                const isLast = index === document.trails.length - 1;
                                // Rail starts at the first dot, ends at the last dot, and runs through everything in between.
                                const railClass = isFirst && isLast
                                    ? null
                                    : `${isFirst ? 'top-[23px]' : 'top-0'} ${isLast ? 'h-[23px]' : 'bottom-0'}`;
                                const dotClass = trail.status === 'approved'
                                    ? 'border-emerald-500 bg-emerald-500'
                                    : ['rejected', 'changes_requested'].includes(trail.status || '')
                                        ? 'border-rose-500 bg-rose-500'
                                        : 'border-blue-600 bg-blue-600';

                                return <li key={`${trail.created_at ?? 'trail'}-${index}`} className={`relative pl-8 ${isLast ? '' : 'pb-3'}`}>
                                    {railClass && <span className={`absolute left-[6px] w-0 border-l-2 border-solid border-blue-500/60 ${railClass}`} aria-hidden="true" />}
                                    <span className={`absolute left-0 top-4 z-[1] h-3.5 w-3.5 rounded-full border-2 ${dotClass} ${isFirst ? 'ring-4 ring-blue-100' : ''}`} aria-hidden="true" />
                                    <span className="absolute left-3.5 top-[22px] h-0.5 w-[18px] bg-slate-200" aria-hidden="true" />
                                    <article className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="break-words text-sm font-semibold text-slate-900">{trail.action || trail.status || 'Document activity'}</h3>
                                                {trail.status && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${publicStatusClass(trail.status)}`}>{trail.status.replaceAll('_', ' ')}</span>}
                                            </div>
                                            {trail.created_at && <time className="shrink-0 text-xs text-slate-500">{trail.created_at}</time>}
                                        </div>
                                        {(trail.from_office || trail.to_office || trail.holder) && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                            {trail.from_office && <span className="font-medium text-slate-800"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{trail.from_office === trail.to_office ? 'At' : 'From'}</span>{trail.from_office}</span>}
                                            {trail.from_office && trail.to_office && trail.from_office !== trail.to_office && <span className="text-blue-700" aria-label="to">→</span>}
                                            {trail.to_office && trail.from_office !== trail.to_office && <span className="font-medium text-slate-800"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</span>{trail.to_office}</span>}
                                            {!trail.from_office && !trail.to_office && trail.holder && <span className="text-slate-600">Current holder: <strong className="font-medium text-slate-900">{trail.holder}</strong></span>}
                                        </div>}
                                    </article>
                                </li>;
                            })}
                        </ol> : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No routing activity is available yet.</p>}
                    </section> */}

                    <p className="mt-6 text-center text-xs text-slate-500">National Commission on Indigenous Peoples · Document Tracking System</p>
                </div>
            </main>
        </>
    );
}

function QrWorkflowPanel({ workflow, document }: { workflow: QrWorkflow; document: TrackedDocument }) {
    const page = usePage();
    const errors = (page.props.errors ?? {}) as Record<string, string>;
    const success = (page.props.flash as { success?: string } | undefined)?.success;
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [remarks, setRemarks] = useState('');
    const [signedFile, setSignedFile] = useState<File | null>(null);
    const [actionTypeId, setActionTypeId] = useState('');
    const [otherAction, setOtherAction] = useState('');
    const [officeIds, setOfficeIds] = useState<string[]>([]);
    const [signatureOfficeIds, setSignatureOfficeIds] = useState<string[]>([]);
    const [routingMode, setRoutingMode] = useState<'sequential' | 'parallel'>('sequential');
    const [reviewOpen, setReviewOpen] = useState(false);
    const [forwardOpen, setForwardOpen] = useState(false);
    const [officeSearch, setOfficeSearch] = useState('');
    const [documentSource, setDocumentSource] = useState<'current' | 'upload'>('current');
    const [forwardFile, setForwardFile] = useState<File | null>(null);
    const [forwardError, setForwardError] = useState('');
    const [busy, setBusy] = useState(false);
    const [resendRemaining, setResendRemaining] = useState(0);

    useEffect(() => {
        const updateRemaining = () => {
            if (!workflow.resend_available_at) {
                setResendRemaining(0);
                return;
            }

            setResendRemaining(Math.max(0, Math.ceil((new Date(workflow.resend_available_at).getTime() - Date.now()) / 1000)));
        };

        updateRemaining();
        const timer = window.setInterval(updateRemaining, 1000);
        return () => window.clearInterval(timer);
    }, [workflow.resend_available_at]);

    const post = (url: string | null | undefined, data: Record<string, any> = {}, forceFormData = false, onSuccess?: () => void) => {
        if (!url || busy) return;
        setBusy(true);
        router.post(url, data, { preserveScroll: true, forceFormData, onFinish: () => setBusy(false), onSuccess });
    };

    const submitEmail = (event: FormEvent) => {
        event.preventDefault();
        post(workflow.request_otp_url, { email });
    };
    const submitCode = (event: FormEvent) => {
        event.preventDefault();
        post(workflow.verify_otp_url, { code });
    };

    const toggleOffice = (officeId: string) => {
        setForwardError('');
        const removing = officeIds.includes(officeId);
        setOfficeIds((current) => current.includes(officeId)
            ? current.filter((id) => id !== officeId)
            : current.length < 30 ? [...current, officeId] : current);
        if (removing) setSignatureOfficeIds((current) => current.filter((id) => id !== officeId));
    };

    const toggleSignatureOffice = (officeId: string) => {
        const next = signatureOfficeIds.includes(officeId)
            ? signatureOfficeIds.filter((id) => id !== officeId)
            : [...signatureOfficeIds, officeId];
        setSignatureOfficeIds(next);
        if (next.length > 0) setRoutingMode('sequential');
        setForwardError('');
    };

    const moveOffice = (officeId: string, direction: -1 | 1) => {
        setOfficeIds((current) => {
            const from = current.indexOf(officeId);
            const to = from + direction;
            if (from < 0 || to < 0 || to >= current.length) return current;
            const next = [...current];
            [next[from], next[to]] = [next[to], next[from]];
            return next;
        });
    };

    const submitForward = (event: FormEvent) => {
        event.preventDefault();
        const selectedAction = workflow.action_types.find((option) => String(option.id) === actionTypeId);
        const needsOtherAction = selectedAction?.name.trim().toLowerCase() === 'others';
        if (!actionTypeId || officeIds.length === 0 || (needsOtherAction && !otherAction.trim())) {
            setForwardError('Complete the required fields before submitting.');
            return;
        }
        if (documentSource === 'upload' && !forwardFile) {
            setForwardError('Choose a file to upload.');
            return;
        }
        if (forwardFile && forwardFile.size > 102400 * 1024) {
            setForwardError('The selected file must be 100 MB or smaller.');
            return;
        }
        if (forwardFile && !/\.(pdf|jpe?g|png|docx?)$/i.test(forwardFile.name)) {
            setForwardError('Choose a PDF, JPG, PNG, DOC, or DOCX file.');
            return;
        }
        if (signatureOfficeIds.length > 0 && forwardFile && !/\.pdf$/i.test(forwardFile.name)) {
            setForwardError('Signature-required offices can only be forwarded with a PDF version.');
            return;
        }

        setForwardError('');
        post(workflow.forward_url, {
            action_type_id: actionTypeId,
            other_action: needsOtherAction ? otherAction.trim() : '',
            to_office_ids: officeIds,
            signature_required_office_ids: signatureOfficeIds,
            routing_mode: routingMode,
            remarks,
            document_source: documentSource,
            file: documentSource === 'upload' ? forwardFile : null,
        }, true, () => setForwardOpen(false));
    };

    const filteredOffices = workflow.offices.filter((office) => office.name.toLowerCase().includes(officeSearch.trim().toLowerCase()));
    const qrErrors = Object.values(errors);

    return <><section className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="qr-actions-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Secure QR processing</p>
                <h2 id="qr-actions-title" className="mt-1 text-lg font-semibold text-slate-900">Receive and process this document</h2>
                <p className="mt-1 text-sm text-slate-600">Use the official email attached to your existing DOTS account.</p>
            </div>
            {workflow.state === 'verified' && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Email verified</span>}
        </div>

        {success && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>}
        {Object.keys(errors).length > 0 && <div className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {Object.values(errors).map((error, index) => <p key={index}>{error}</p>)}
        </div>}

        {workflow.state === 'public' && <form onSubmit={submitEmail} className="mt-5 space-y-3">
            <label className="block text-sm font-medium text-slate-800" htmlFor="official-email">Registered official email</label>
            <input id="official-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-blue-500" placeholder="name@ncip.gov.ph" />
            <button disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {busy ? 'Sending…' : 'Send verification code'}
            </button>
            <p className="text-xs text-slate-500">The email must exactly match an active and eligible DOTS account for the current office route step.</p>
        </form>}

        {workflow.state === 'otp_pending' && <form onSubmit={submitCode} className="mt-5 space-y-3">
            <p className="text-sm text-slate-700">Enter the 6-digit code sent to <strong>{workflow.masked_email}</strong>.</p>
            <label className="block text-sm font-medium text-slate-800" htmlFor="otp-code">Verification code</label>
            <input id="otp-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-center font-mono text-xl tracking-[0.35em] focus:border-blue-500 focus:ring-blue-500" />
            <button disabled={busy} className="w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                {busy ? 'Checking…' : 'Verify and continue'}
            </button>
            <button type="button" disabled={busy || resendRemaining > 0} onClick={() => post(workflow.resend_otp_url)}
                className="w-full rounded-xl border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 disabled:opacity-60">
                {resendRemaining > 0 ? `Send a new code in ${resendRemaining}s` : 'Send a new code'}
            </button>
            <button type="button" onClick={() => router.delete(workflow.session_end_url, { preserveScroll: true })}
                className="w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Use a different email</button>
        </form>}

        {workflow.state === 'verified' && <div className="mt-5 space-y-5">
            <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
                <p className="font-semibold">{workflow.user?.name}</p>
                <p className="mt-0.5 text-blue-800">{workflow.user?.office || 'No office'} · Route step: {routeStepLabel(workflow.step_status || 'unknown')}</p>
                <p className="mt-2 text-xs text-blue-700">This access is limited to this document and expires automatically.</p>
            </div>

            {workflow.can_receive && <button type="button" disabled={busy} onClick={() => post(workflow.receive_url)}
                className="w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">Mark physical document as received</button>}

            {(workflow.can_approve || workflow.can_forward) && <div className="grid gap-3 sm:grid-cols-2">
                {workflow.can_approve && <button type="button" disabled={busy} onClick={() => setReviewOpen(true)} className="dots-button-primary justify-center py-3 disabled:opacity-60">
                    <FileSignature size={17} aria-hidden="true" /> Review and Decide
                </button>}
                {workflow.can_forward && <button type="button" disabled={busy} onClick={() => setForwardOpen(true)} className="dots-button-secondary justify-center py-3 disabled:opacity-60">
                    <Send size={17} aria-hidden="true" /> Forward
                </button>}
            </div>}

            {!workflow.can_receive && !workflow.can_approve && workflow.step_status === 'available' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Your DOTS role cannot receive this available route step.</p>}
            <button type="button" onClick={() => router.delete(workflow.session_end_url, { preserveScroll: true })} className="text-sm font-medium text-slate-600 hover:underline">End secure QR session</button>
        </div>}
    </section>

    <WorkspaceDialog open={reviewOpen} onClose={() => setReviewOpen(false)} labelledBy="qr-review-title" width="max-w-3xl" busy={busy}>
        <section aria-busy={busy}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <h2 id="qr-review-title" className="break-words text-lg font-semibold text-foreground">{document.title || 'Document details'}</h2>
                    <p className="mt-1 break-all font-mono text-sm text-muted">{document.tracking_number}</p>
                </div>
                <button type="button" onClick={() => setReviewOpen(false)} aria-label="Close document review" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground"><X size={19} /></button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
                <section aria-labelledby="qr-files-title">
                    <h3 id="qr-files-title" className="font-semibold text-foreground">Document files and versions</h3>
                    {workflow.files.length > 0 ? <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-background">
                        {workflow.files.map((file) => <li key={file.id} className="flex flex-col gap-3 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0"><p className="break-words font-medium text-foreground">{file.name}</p><p className="mt-0.5 text-xs capitalize text-muted">{file.type} · {(file.size_bytes / 1024).toFixed(1)} KB</p></div>
                            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap">
                                {file.view_url && <a href={file.view_url} target="_blank" rel="noreferrer" className="dots-button-secondary w-full px-3 py-2 sm:w-auto"><Eye size={15} /> View</a>}
                                <a href={file.download_url} className="dots-button-secondary w-full px-3 py-2 sm:w-auto"><Download size={15} /> Download</a>
                                {file.type === 'original' && file.is_pdf && workflow.signature_status === 'needs_signature' && <button type="button" disabled title="iPluma signing is not connected yet." className="dots-button-secondary col-span-2 w-full cursor-not-allowed px-3 py-2 opacity-50 sm:w-auto"><FileSignature size={15} aria-hidden="true" /> Sign with iPluma</button>}
                                {file.type === 'signed' && <span className="col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-success-soft px-3 py-2 text-xs font-medium text-success sm:w-auto"><FileSignature size={15} aria-hidden="true" /> Signed</span>}
                            </div>
                        </li>)}
                    </ul> : <p className="mt-3 rounded-lg bg-background p-3 text-sm text-muted">No document files are available.</p>}
                </section>

                <section className="rounded-xl border border-border bg-background p-4" aria-label="Approval and signing status">
                    <div><h3 className="font-semibold text-foreground">Approval and signing</h3><p className="mt-1 text-sm text-muted">Review the attached files before recording a decision.</p></div>
                    <div className="mt-4 space-y-3">
                        <label htmlFor="qr-approval-remarks" className="block text-sm font-medium text-foreground">Remarks</label>
                        <textarea id="qr-approval-remarks" maxLength={4000} rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Add a note for this decision" />
                        {qrErrors.length > 0 && <div role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{qrErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}

                        {workflow.step_signature_required && <div className="rounded-xl border border-warning/30 bg-warning-soft p-4">
                            <p className="text-sm font-semibold text-foreground">A signed copy is required</p>
                            <p className="mt-1 text-xs text-muted">Scan the wet-signed paper as a clear PDF. The upload is attached to this office’s step and approves it.</p>
                            <input type="file" accept="application/pdf,.pdf" onChange={(event) => { const input = event.currentTarget; setSignedFile(input.files?.[0] ?? null); input.value = ''; }} className="mt-3 block w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
                            {signedFile && <SelectedWorkflowFile file={signedFile} onRemove={() => setSignedFile(null)} />}
                        </div>}

                        <div className="space-y-2">
                            <div className="grid grid-cols-2 items-stretch gap-2">
                                <button type="button" disabled={busy} onClick={() => post(workflow.decision_url, { decision: 'rejected', remarks }, false, () => setReviewOpen(false))} className="dots-button-secondary w-full text-danger disabled:opacity-50">Reject</button>
                                <button type="button" disabled={busy} onClick={() => post(workflow.decision_url, { decision: 'changes_requested', remarks }, false, () => setReviewOpen(false))} className="dots-button-secondary w-full px-2 disabled:opacity-50">Request changes</button>
                            </div>
                            {workflow.step_signature_required
                                ? <button type="button" disabled={busy || !signedFile || !workflow.source_document_file_id} onClick={() => post(workflow.wet_signed_url, { signed_file: signedFile, source_document_file_id: workflow.source_document_file_id, remarks }, true, () => { setReviewOpen(false); setSignedFile(null); })} className="dots-button-primary w-full disabled:opacity-50">Upload signed PDF and approve</button>
                                : <button type="button" disabled={busy} onClick={() => post(workflow.decision_url, { decision: 'approved', remarks }, false, () => setReviewOpen(false))} className="dots-button-primary w-full disabled:opacity-50">Approve</button>}
                        </div>
                    </div>
                </section>
            </div>
            <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-5 py-4 sm:px-6"><button type="button" onClick={() => setReviewOpen(false)} className="dots-button-secondary w-full sm:w-auto">Close</button></div>
        </section>
    </WorkspaceDialog>

    <WorkspaceDialog open={forwardOpen} onClose={() => setForwardOpen(false)} labelledBy="qr-forward-title" width="max-w-3xl" busy={busy}>
        <form onSubmit={submitForward} aria-busy={busy}>
            <fieldset disabled={busy} className="min-w-0">
                <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                    <div><h2 id="qr-forward-title" className="text-lg font-semibold text-foreground">Forward document</h2><p className="mt-1 text-sm text-muted">Choose where this document should go next.</p></div>
                    <button type="button" onClick={() => setForwardOpen(false)} aria-label="Close forwarding dialog" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground"><X size={19} /></button>
                </div>

                <div className="space-y-6 p-5 sm:p-6">
                    <section className="grid gap-4 sm:grid-cols-2" aria-label="Forwarding details">
                        <div>
                            <label htmlFor="qr-action-type" className="mb-1 block text-sm font-medium text-foreground">Action required <span className="text-danger">*</span></label>
                            <select id="qr-action-type" required value={actionTypeId} onChange={(event) => { setActionTypeId(event.target.value); setOtherAction(''); setForwardError(''); }} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10 text-sm">
                                <option value="">Select action</option>{workflow.action_types.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                            </select>
                        </div>
                        {workflow.action_types.find((option) => String(option.id) === actionTypeId)?.name.trim().toLowerCase() === 'others' && <div>
                            <label htmlFor="qr-other-action" className="mb-1 block text-sm font-medium text-foreground">Please specify <span className="text-danger">*</span></label>
                            <input id="qr-other-action" required maxLength={255} value={otherAction} onChange={(event) => { setOtherAction(event.target.value); setForwardError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                        </div>}

                        <div className="sm:col-span-2">
                            <p className="mb-2 text-sm font-medium text-foreground">Approval flow</p>
                            <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Approval flow">
                                {([['sequential', 'Sequential approval', 'Offices review in order. Signers receive the latest PDF.'], ['parallel', 'Parallel approval', 'All selected offices can review independently.']] as const).map(([mode, label, description]) => <button key={mode} type="button" disabled={mode === 'parallel' && signatureOfficeIds.length > 0} aria-pressed={routingMode === mode} onClick={() => setRoutingMode(mode)} className={`rounded-xl border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${routingMode === mode ? 'border-primary bg-secondary' : 'border-border bg-surface'}`}><span className="block text-sm font-semibold text-foreground">{label}</span><span className="mt-1 block text-xs text-muted">{description}</span></button>)}
                            </div>
                            <p className="mt-2 text-xs text-muted">Mark signature requirements on individual offices in the route order. Any required signatures use sequential routing.</p>
                        </div>

                        <div className="sm:col-span-2">
                            <p className="mb-2 text-sm font-medium text-foreground">Required offices <span className="text-danger">*</span><span className="ml-2 text-xs font-normal text-muted">Choose up to 30.</span></p>
                            <div className="mb-2 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                                <Search size={17} className="shrink-0" /><label htmlFor="qr-office-search" className="sr-only">Search required offices</label>
                                <input id="qr-office-search" type="search" value={officeSearch} onChange={(event) => setOfficeSearch(event.target.value)} placeholder="Search offices…" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted focus:ring-0" />
                                {officeSearch && <button type="button" onClick={() => setOfficeSearch('')} className="rounded-md p-1 text-muted hover:bg-secondary"><X size={15} /></button>}
                            </div>
                            <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-2 sm:grid-cols-2">
                                {filteredOffices.map((office) => {
                                    const selected = officeIds.includes(String(office.id));
                                    const officeId = String(office.id);
                                    return <div key={office.id} className={`flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm ${officeIds.length >= 30 && !selected ? 'opacity-50' : ''} ${selected ? 'border-primary bg-secondary' : 'border-border bg-surface'}`}>
                                        <label className={`flex min-w-0 flex-1 items-center gap-3 ${officeIds.length >= 30 && !selected ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                            <input type="checkbox" checked={selected} disabled={officeIds.length >= 30 && !selected} onChange={() => toggleOffice(officeId)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                                            <span className="text-foreground">{office.name}</span>
                                        </label>
                                        {selected && <label className="flex items-center gap-2 text-xs font-medium text-foreground"><input type="checkbox" checked={signatureOfficeIds.includes(officeId)} onChange={() => toggleSignatureOffice(officeId)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />Requires signature</label>}
                                    </div>;
                                })}
                                {filteredOffices.length === 0 && <p className="p-2 text-sm text-muted sm:col-span-2">No offices match your search.</p>}
                            </div>
                            <p className="mt-2 text-xs text-muted">{officeIds.length}/30 offices selected</p>
                        </div>

                        {routingMode === 'sequential' && officeIds.length > 0 && <div className="sm:col-span-2">
                            <p className="mb-2 text-sm font-medium text-foreground">Route order</p>
                            <ol className="space-y-2">{officeIds.map((officeId, index) => <li key={officeId} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3">
                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{index + 1}</span>
                                <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">{workflow.offices.find((office) => String(office.id) === officeId)?.name}</span>
                                <button type="button" disabled={index === 0} onClick={() => moveOffice(officeId, -1)} aria-label="Move office up" className="rounded-md p-2 text-muted hover:bg-secondary disabled:opacity-30"><ArrowUp size={15} /></button>
                                <button type="button" disabled={index === officeIds.length - 1} onClick={() => moveOffice(officeId, 1)} aria-label="Move office down" className="rounded-md p-2 text-muted hover:bg-secondary disabled:opacity-30"><ArrowDown size={15} /></button>
                                <button type="button" onClick={() => toggleOffice(officeId)} aria-label="Remove office" className="rounded-md p-2 text-muted hover:bg-danger-soft hover:text-danger"><X size={15} /></button>
                            </li>)}</ol>
                        </div>}

                        <div className="sm:col-span-2"><label htmlFor="qr-forward-remarks" className="mb-1 block text-sm font-medium text-foreground">Remarks</label><textarea id="qr-forward-remarks" maxLength={250} rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm" /><p className="mt-1 text-right text-xs text-muted">{remarks.length}/250</p></div>

                        <div className="sm:col-span-2">
                            <p className="mb-2 text-sm font-medium text-foreground">Document version</p>
                            <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Document version source">
                                <button type="button" aria-pressed={documentSource === 'current'} onClick={() => { setDocumentSource('current'); setForwardFile(null); setForwardError(''); }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${documentSource === 'current' ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>Keep current document</button>
                                <button type="button" aria-pressed={documentSource === 'upload'} onClick={() => { setDocumentSource('upload'); setForwardError(''); }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${documentSource === 'upload' ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>Upload new version</button>
                            </div>
                            {documentSource === 'current' ? <p className="text-xs text-muted">Forward with the current document version.</p> : <><label htmlFor="qr-forward-file" className="mb-1 block text-sm font-medium text-foreground">New version</label><input id="qr-forward-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const input = event.currentTarget; setForwardFile(input.files?.[0] ?? null); input.value = ''; setForwardError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />{forwardFile && <SelectedWorkflowFile file={forwardFile} onRemove={() => { setForwardFile(null); setForwardError(''); }} />}<p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC, or DOCX. Maximum 100 MB.</p></>}
                        </div>
                    </section>
                    {(forwardError || qrErrors.length > 0) && <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{forwardError && <p>{forwardError}</p>}{qrErrors.map((error, index) => <p key={index}>{error}</p>)}</div>}
                </div>

                <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-border bg-surface px-5 py-4 sm:flex sm:justify-end sm:px-6"><button type="button" onClick={() => setForwardOpen(false)} className="dots-button-secondary w-full sm:w-auto">Cancel</button><button type="submit" className="dots-button-primary w-full sm:w-auto">{busy ? 'Forwarding…' : 'Forward document'}</button></div>
            </fieldset>
        </form>
    </WorkspaceDialog></>;
}

function SelectedWorkflowFile({ file, onRemove }: { file: File; onRemove: () => void }) {
    return <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
        <span className="min-w-0 break-all text-foreground">{file.name}<span className="ml-2 text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span></span>
        <button type="button" onClick={onRemove} className="shrink-0 rounded-md p-1 text-muted hover:bg-secondary hover:text-foreground" aria-label={`Remove ${file.name}`} title="Remove file"><X size={16} aria-hidden="true" /></button>
    </div>;
}

function RouteBranchMap({ document }: { document: TrackedDocument }) {
    // Always show routes oldest to newest (Route 1 first), whatever order the backend sends them in.
    const routes: PublicRoute[] = document.route_tree?.length
        ? [...document.route_tree].sort((a, b) => a.id - b.id)
        : document.route_steps?.length
            ? [{
                id: 0,
                mode: document.route_mode || 'sequential',
                status: document.route_status || 'pending',
                from_office: document.route_from_office,
                steps: document.route_steps.map((step, index) => ({ ...step, id: index + 1, child_routes: [] })),
            }]
            : [];
    const allSteps = routes.flatMap((route) => route.steps.flatMap((step) => [
        step,
        ...(step.child_routes ?? []).flatMap((child) => collectPublicRouteSteps(child)),
    ]));
    const approvedCount = allSteps.filter((step) => step.status === 'approved').length;
    const collectRequiredSignatureSteps = (items: PublicRoute[]): PublicRouteStep[] => items.flatMap((route) => {
        if (!['pending', 'approved'].includes(route.status)) return [];
        return route.steps.flatMap((step) => [
            ...(step.signature_required ? [step] : []),
            ...collectRequiredSignatureSteps(step.child_routes ?? []),
        ]);
    });
    const requiredSignatureSteps = collectRequiredSignatureSteps(routes);
    const signedStepCount = requiredSignatureSteps.filter((step) => step.signature_status === 'signed').length;
    const routeStatus = routes.some((route) => route.status === 'pending') ? 'pending' : (document.status || document.route_status || 'pending');
    // The earliest route is where the document started.
    const originOffice = document.route_from_office || routes[0]?.from_office || document.office_name || 'Originating office';
    // Trails are latest first, so find() returns the most recent terminal entry.
    const terminalTrail = findTerminalTrail(document.trails);
    // With routes above it, the last route's rail must run straight down into the terminal dot.
    const terminalConnected = Boolean(terminalTrail) && routes.length > 0;

    return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="office-route-title">
        <div className="border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Route map</p>
                    <h2 id="office-route-title" className="mt-1 text-lg font-semibold text-slate-900">Office approval route</h2>
                    <p className="mt-1 text-sm text-slate-600">{requiredSignatureSteps.length > 0 ? 'All listed offices must approve. Offices marked as requiring a signature must sign in order. Forwarded offices branch off to the side, and the parent office still makes its own decision.' : 'Every listed office must approve. Forwarded offices branch off to the side, and the parent office still makes its own decision.'}</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${publicStatusClass(routeStatus)}`}>{routeStatus.replaceAll('_', ' ')}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                <span><strong className="text-slate-900">{allSteps.length}</strong> {allSteps.length === 1 ? 'office' : 'offices'}</span>
                <span><strong className="text-emerald-700">{approvedCount}</strong> approved</span>
                <span><strong className="text-slate-900">{allSteps.length - approvedCount}</strong> remaining</span>
                {requiredSignatureSteps.length > 0 && <span><strong className="text-blue-700">{signedStepCount} of {requiredSignatureSteps.length}</strong> signatures complete</span>}
            </div>
            {/* Small legend so the lines are easy to read */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600" aria-label="Legend">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-0 border-l-2 border-solid border-blue-500/60" aria-hidden="true" />Sequential approval</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-0 border-l-2 border-dashed border-blue-500/60" aria-hidden="true" />Parallel approval</span>
                <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-blue-600 bg-blue-600 ring-4 ring-blue-100" aria-hidden="true" />Current</span>
                <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-emerald-500" aria-hidden="true" />Approved</span>
            </div>
        </div>

        <div className="p-4 sm:p-7">
            <div className="rounded-xl border border-blue-100 bg-slate-50 p-3.5 sm:p-4">
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">S</span>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route started from</p>
                        <p className="break-words text-sm font-semibold text-slate-900">{originOffice}</p>
                        <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{document.tracking_number}</p>
                    </div>
                    <span className="ml-auto hidden rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 ring-1 ring-blue-100 sm:inline-flex">{routes.length} {routes.length === 1 ? 'route' : 'routes'}</span>
                </div>
            </div>

            <div className="mt-5">
                {routes.length > 0 && <div className="space-y-6">
                    {routes.map((route, index) => <PublicRouteGroup key={route.id} route={route} depth={0} round={index + 1} continues={terminalConnected && index === routes.length - 1} />)}
                </div>}
                {terminalTrail && <ol className="relative" aria-label="Terminal transaction">
                    <li className={`relative pl-8 ${terminalConnected ? 'pt-3' : ''}`}>
                        {/* Rail from the previous step straight into the terminal dot (12px padding + 23px dot center = 35px) */}
                        {terminalConnected && <span className="absolute left-[6px] top-0 h-[35px] w-0 border-l-2 border-solid border-blue-500/60" aria-hidden="true" />}
                        <span className={`absolute left-0 z-[1] h-3.5 w-3.5 rounded-full border-2 border-slate-700 bg-slate-700 ring-4 ring-slate-200 ${terminalConnected ? 'top-7' : 'top-4'}`} aria-hidden="true" />
                        <span className={`absolute left-3.5 h-0.5 w-[18px] bg-slate-200 ${terminalConnected ? 'top-[34px]' : 'top-[22px]'}`} aria-hidden="true" />
                        <article className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 sm:p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-700 text-xs font-bold text-white">{allSteps.length + 1}</span>
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-semibold text-slate-900">{terminalTrail.from_office || terminalTrail.holder || terminalTrail.to_office || originOffice}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{terminalTrail.action || 'Tagged as Terminal'}</p>
                                    </div>
                                </div>
                                <RouteStepStatus status="terminal" />
                            </div>
                            {terminalTrail.created_at && <p className="mt-3 border-t border-slate-200 pt-2.5 text-xs text-slate-500">Recorded {terminalTrail.created_at}</p>}
                        </article>
                    </li>
                </ol>}
            </div>
        </div>
    </section>;
}

function collectPublicRouteSteps(route: PublicRoute): PublicRouteStep[] {
    return route.steps.flatMap((step) => [step, ...(step.child_routes ?? []).flatMap((child) => collectPublicRouteSteps(child))]);
}

function PublicRouteGroup({ route, depth, round, continues = false }: { route: PublicRoute; depth: number; round?: number; continues?: boolean }) {
    const isParallel = route.mode === 'parallel';
    const lane = depth % 4;
    const childLane = (depth + 1) % 4;

    return <section aria-label={depth > 0 ? `Forwarded route from ${route.from_office || 'office'}` : `Route round ${round}`}>
        {depth === 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="text-xs font-semibold text-slate-900">Route {round}</p>
                <p className="text-[11px] text-slate-500">{isParallel ? 'Parallel approval · offices can act independently' : 'Sequential approval · next office waits for approval'}</p>
            </div>
            <RouteStepStatus status={route.status} />
        </div>}

        <ol className="relative" aria-label={isParallel ? 'Parallel office branches' : 'Sequential office steps'}>
            {route.steps.map((step, index) => {
                const isFirst = index === 0;
                const isLast = index === route.steps.length - 1;
                const startsAtDot = isFirst && depth === 0;
                // The last step keeps its rail going to the bottom when something (the terminal card) follows this route.
                const runsThrough = isLast && continues;

                // Rail segment for this step. Solid = step by step, dashed = parallel.
                // On the last step the rail ends at the dot, even if the step has children,
                // because the children hang off their own (indented) lane.
                const start = startsAtDot ? 'top-[23px]' : 'top-0';
                const end = isLast && !runsThrough ? 'h-[23px]' : 'bottom-0';
                const rail = startsAtDot && isLast && !runsThrough ? null : <span
                    className={`absolute left-[6px] w-0 border-l-2 ${LANE_BORDER[lane]} ${isParallel ? 'border-dashed' : 'border-solid'} ${start} ${end}`}
                    aria-hidden="true"
                />;

                const active = ['in_progress', 'available', 'waiting_on_branch'].includes(step.status);
                const branchComplete = step.child_routes?.some((child) => child.status === 'approved');
                const children = step.child_routes ?? [];

                return <li key={step.id} className={`relative pl-8 ${isLast ? '' : 'pb-3'}`}>
                    {rail}
                    <span className={`absolute left-0 top-4 z-[1] h-3.5 w-3.5 rounded-full border-2 ${publicMarkerClass(step.status)}`} aria-hidden="true" />
                    <span className="absolute left-3.5 top-[22px] h-0.5 w-[18px] bg-slate-200" aria-hidden="true" />
                    <article className={`rounded-xl border ${depth > 0 ? 'p-3' : 'p-3.5 sm:p-4'} ${active ? 'border-blue-200 bg-blue-50/60' : step.status === 'approved' ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={`grid shrink-0 place-items-center rounded-lg font-bold ${depth > 0 ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs'} ${step.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{step.position}</span>
                                <div className="min-w-0">
                                    <p className={`break-words font-semibold text-slate-900 ${depth > 0 ? 'text-xs' : 'text-sm'}`}>{step.office || 'Office unavailable'}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{isParallel ? `Branch ${step.position}` : `Step ${step.position}`}</p>
                                </div>
                            </div>
                            <RouteStepStatus status={step.status} compact={depth > 0} />
                        </div>
                        {step.status === 'waiting_on_branch' && <p className="mt-3 text-xs text-slate-600">This office is waiting for its forwarded offices to finish.</p>}
                        {branchComplete && step.status === 'in_progress' && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Forwarded branch complete. This office still needs to approve.</p>}
                        {step.signature_required && <p className={`mt-3 inline-block max-w-full rounded-lg border px-3 py-2 text-xs font-medium ${step.signature_status === 'signed' ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{step.signature_status === 'signed' ? `Signature recorded${step.signed_at ? ` · ${step.signed_at}` : ''}` : 'Signature required for this office'}</p>}
                    </article>

                    {/* Forwarded routes: nested under the parent card so they visibly branch from it */}
                    {children.map((child) => {
                        const childParallel = child.mode === 'parallel';
                        const childStyle = `${LANE_BORDER[childLane]} ${childParallel ? 'border-dashed' : 'border-solid'}`;

                        return <div key={child.id} className="relative ml-4 pt-2 sm:ml-8">
                            {/* Connector: drops from the parent card's bottom edge into the child lane (8 + 24 + 8 = 40px) */}
                            <span className={`absolute left-[6px] top-0 h-10 w-0 border-l-2 ${childStyle}`} aria-hidden="true" />
                            {/* Elbow into the label pill, at the pill's vertical center (8 + 12 = 20px) */}
                            <span className={`absolute left-[7px] top-[19px] w-[25px] border-t-2 ${childStyle}`} aria-hidden="true" />
                            <div className="flex h-8 items-center gap-2 overflow-hidden pb-2 pl-8">
                                <span className={`min-w-0 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${LANE_BG[childLane]} ${LANE_TEXT[childLane]}`}>
                                    Forwarded by {step.office} · {childParallel ? 'Parallel approval' : 'Sequential approval'}
                                </span>
                                <RouteStepStatus status={child.status} compact />
                            </div>
                            <PublicRouteGroup route={child} depth={depth + 1} />
                        </div>;
                    })}
                </li>;
            })}
        </ol>
    </section>;
}

function RouteStepStatus({ status, compact = false }: { status: string; compact?: boolean }) {
    return <span className={`shrink-0 rounded-full font-semibold capitalize ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${publicStatusClass(status)}`}>{routeStepLabel(status)}</span>;
}

function publicStatusClass(status: string) {
    if (['approved', 'completed', 'released', 'processed', 'done'].includes(status)) return 'bg-emerald-100 text-emerald-800';
    if (['rejected', 'changes_requested'].includes(status)) return 'bg-rose-100 text-rose-800';
    if (['pending', 'ongoing', 'available', 'waiting', 'in_progress', 'waiting_on_branch', 'paused'].includes(status)) return 'bg-amber-100 text-amber-900';
    return 'bg-slate-100 text-slate-700';
}

function publicMarkerClass(status: string) {
    if (status === 'approved') return 'border-emerald-500 bg-emerald-500';
    if (['rejected', 'changes_requested'].includes(status)) return 'border-rose-500 bg-rose-500';
    if (['available', 'in_progress', 'waiting_on_branch'].includes(status)) return 'border-blue-600 bg-blue-600 ring-4 ring-blue-100';
    return 'border-slate-300 bg-white';
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value || '—'}</dd></div>;
}
