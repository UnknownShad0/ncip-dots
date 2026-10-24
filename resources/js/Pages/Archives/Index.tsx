import DocumentLifecycleAction from "@/Components/DocumentLifecycleAction";
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentDispositionPrint from '@/Components/DocumentDispositionPrint';
import WorkspaceDialog from '@/Components/WorkspaceDialog';
import { DocumentRouteProgress, type RouteTree, type RouteTreeStep } from '@/Pages/Documents/Index';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { Download, Eye, FileSignature, FileText, LoaderCircle, Printer, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ArchiveDocument = {
    id: number;
    title: string;
    tracking_number: string;
    archived_at?: string | null;
    preview_url?: string;
    can_restore?: boolean;
    tracking_url?: string | null;
    office?: { name: string; short_name: string | null } | null;
    office_name?: string;
    office_short_name?: string | null;
    document_type?: string;
    other_document_type?: string | null;
    purpose_type?: string;
    other_purpose?: string | null;
    origin_type?: string;
    status?: string;
    remarks?: string;
    is_finalized?: boolean;
    created_at?: string;
    created_by_name?: string | null;
    created_by_short_name?: string | null;
    approval_status?: string | null;
    signature_status?: string | null;
    file_name?: string | null;
    file_url?: string | null;
    files?: Array<{ id: number; name: string; type: string; url?: string | null; view_url?: string | null; is_pdf?: boolean; uploaded_at?: string | null }>;
    route_mode?: 'sequential' | 'parallel';
    route_status?: string | null;
    route_from_office?: string | null;
    route_steps?: RouteTreeStep[];
    route_tree?: RouteTree[];
    details_loading?: boolean;
    details_error?: string;
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

type ArchivePage = {
    data: ArchiveDocument[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function ArchivesIndex({ source = 'tracking', documents, canFilterOffices = false, offices = [], filters = { office_id: null, year: null, search: '', sort: 'newest' } }: {
    source?: 'tracking' | 'generation';
    documents?: ArchivePage;
    canFilterOffices?: boolean;
    offices?: { id: number; name: string }[];
    filters?: { office_id: number | null; year: number | null; search: string; sort: string };
}) {
    const [updating, setUpdating] = useState(false);
    const [viewingDocument, setViewingDocument] = useState<ArchiveDocument | null>(null);
    const [printDocument, setPrintDocument] = useState<ArchiveDocument | null>(null);
    const [printLoadingId, setPrintLoadingId] = useState<number | null>(null);
    const [printError, setPrintError] = useState('');
    const [searchTerm, setSearchTerm] = useState(filters.search ?? '');
    const updateFilters = (officeId: string, year: string, sort: string, search = searchTerm) => router.get(route('archives.index'), {
        source, ...(officeId ? { office_id: officeId } : {}), ...(year ? { year } : {}), ...(search.trim() ? { search: search.trim() } : {}), sort,
    }, { preserveScroll: true, preserveState: true, replace: true, onStart: () => setUpdating(true), onFinish: () => setUpdating(false) });
    const rows = documents?.data ?? [];

    useEffect(() => setSearchTerm(filters.search ?? ''), [filters.search]);

    const fetchDetails = async (document: ArchiveDocument) => {
        const { data } = await axios.get(route('documents.details', document.id));
        return { ...document, ...data };
    };

    const openDocumentDetails = async (document: ArchiveDocument) => {
        setViewingDocument({ ...document, details_loading: true, details_error: undefined });
        try {
            const details = await fetchDetails(document);
            setViewingDocument(current => current?.id === document.id ? { ...details, details_loading: false } : current);
        } catch {
            setViewingDocument(current => current?.id === document.id
                ? { ...current, details_loading: false, details_error: 'Could not load this document’s history. Please try again.' }
                : current);
        }
    };

    const printDisposition = async (document: ArchiveDocument) => {
        setPrintError('');
        setPrintLoadingId(document.id);
        try {
            setPrintDocument(await fetchDetails(document));
        } catch {
            setPrintError(`Could not load the disposition history for ${document.tracking_number || 'this document'}. Please try again.`);
        } finally {
            setPrintLoadingId(null);
        }
    };

    useEffect(() => {
        if (!printDocument) return;

        let cancelled = false;
        const clearPrintMode = () => window.document.body.classList.remove('disposition-printing');
        const onAfterPrint = () => {
            clearPrintMode();
            setPrintDocument(null);
        };
        window.document.body.classList.add('disposition-printing');
        window.addEventListener('afterprint', onAfterPrint);
        let animationFrame = 0;
        const printWhenReady = async () => {
            if (cancelled) return;
            const printRoot = window.document.querySelector('.disposition-print-root');
            if (printRoot?.getAttribute('data-ready') !== 'true') {
                animationFrame = window.requestAnimationFrame(printWhenReady);
                return;
            }
            const images = Array.from(printRoot.querySelectorAll('img'));
            await Promise.all(images.map(image => image.decode().catch(() => undefined)));
            if (!cancelled) window.print();
        };
        animationFrame = window.requestAnimationFrame(printWhenReady);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('afterprint', onAfterPrint);
            clearPrintMode();
        };
    }, [printDocument]);

    return (
        <AuthenticatedLayout
            header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Archives</h1>}
        >
            <Head title="Archives" />

            <div className="mx-auto max-w-[1440px] space-y-6">
                <p className="text-sm text-muted">Browse archived documents.</p>

                <section aria-busy={updating} className="rounded-xl border border-border bg-surface p-5">
                    <div className="mb-5 flex gap-2 border-b border-border" role="tablist" aria-label="Archive source">
                        {(['tracking', 'generation'] as const).map(value => (
                            <Link key={value} href={route('archives.index', { source: value })} role="tab" aria-selected={source === value}
                                className={`rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold ${source === value ? 'border-border bg-background text-primary' : 'border-transparent text-muted hover:bg-background'}`}>
                                {value === 'tracking' ? 'Document Tracking' : 'Document Generation'}
                            </Link>
                        ))}
                    </div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-foreground">
                            {source === 'generation' ? 'Archived generated documents' : 'Archived tracking documents'}
                            {documents && <span className="ml-1 text-sm font-normal text-muted">({documents.total})</span>}
                        </h2>
                        {documents && (
                            <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                                {source === 'tracking' && canFilterOffices && (
                                    <label>
                                        <span className="sr-only">Filter by originating bureau or office</span>
                                        <select
                                            aria-label="Filter by originating bureau or office"
                                            value={filters.office_id ?? ''}
                                            onChange={event => updateFilters(event.target.value, String(filters.year ?? ''), filters.sort)}
                                            className="h-11 w-full rounded-lg border-border text-sm sm:w-80"
                                        >
                                            <option value="">All bureaus / offices</option>
                                            {offices.map(office => <option key={office.id} value={office.id}>{office.name}</option>)}
                                        </select>
                                    </label>
                                )}
                                {source === 'tracking' && <>
                                <label>
                                    <span className="sr-only">Filter by year</span>
                                    <select
                                        aria-label="Filter by year"
                                        value={filters.year ?? ''}
                                        onChange={event => updateFilters(String(filters.office_id ?? ''), event.target.value, filters.sort)}
                                        className="h-11 w-full rounded-lg border-border text-sm sm:w-auto"
                                    >
                                        <option value="">All years</option>
                                        {[2022, 2023, 2024, 2025, 2026].map(year => <option key={year} value={year}>{year}</option>)}
                                    </select>
                                </label>
                                <label>
                                    <span className="sr-only">Sort archived documents</span>
                                    <select
                                        aria-label="Sort archived documents"
                                        value={filters.sort}
                                        onChange={event => updateFilters(String(filters.office_id ?? ''), String(filters.year ?? ''), event.target.value)}
                                        className="h-11 w-full rounded-lg border-border text-sm sm:w-auto"
                                    >
                                        <option value="newest">Date created: newest first</option>
                                        <option value="oldest">Date created: oldest first</option>
                                        <option value="bureau_asc">Bureau / office: A–Z</option>
                                        <option value="bureau_desc">Bureau / office: Z–A</option>
                                    </select>
                                </label>
                                </>}
                                <form onSubmit={event => { event.preventDefault(); updateFilters(String(filters.office_id ?? ''), String(filters.year ?? ''), filters.sort); }} className="flex min-w-0 gap-2">
                                    <label className="relative min-w-0 flex-1 sm:flex-none">
                                        <span className="sr-only">Search archived documents</span>
                                        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <input type="search" aria-label="Search archived documents" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder={source === 'generation' ? "Title or document type" : "Title or tracking no."} maxLength={100} className="h-11 w-full rounded-lg border-border pl-9 text-sm sm:w-56" />
                                    </label>
                                    <button type="submit" className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-secondary">Search</button>
                                </form>
                            </div>
                        )}
                    </div>

                    {updating && <p role="status" className="mb-3 inline-flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Updating archives…</p>}
                    {printError && <p role="alert" className="mb-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{printError}</p>}

                    <div className="divide-y divide-border" aria-busy={updating}>
                        {rows.length === 0 ? (
                            <p className="rounded-lg bg-background p-5 text-sm text-muted">No archived documents found.</p>
                        ) : (
                            rows.map(document => (
                                <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="break-words font-semibold text-foreground" title={document.title}>
                                            {document.title.length > 72 ? `${document.title.slice(0, 72)}…` : document.title}
                                        </h3>
                                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                                            {source === 'tracking' ? <>
                                                <span className="select-all font-mono text-xs">{document.tracking_number || 'No tracking number'}</span>
                                                <span>{document.office?.name ?? 'Unassigned'}</span>
                                            </> : <span>{document.document_type || 'Generated document'}</span>}
                                            <span>{document.archived_at ? `Archived ${new Date(document.archived_at).toLocaleString()}` : 'Archive date not recorded'}</span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="rounded-md bg-sidebar/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-sidebar">{(document.status || 'archived').replace(/[_-]+/g, ' ')}</span>
                                        {document.can_restore && <DocumentLifecycleAction action="restore" iconOnly title={document.title}
                                            url={route(source === 'generation' ? 'document-creation.restore' : 'archives.restore', document.id)} />}
                                        {source === 'generation' ? <a href={document.preview_url} target="_blank" rel="noopener noreferrer" title="View / download PDF" aria-label={`View PDF: ${document.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Eye size={17} aria-hidden="true" /></a> : <button type="button" aria-label="View document details" title="View details" onClick={() => openDocumentDetails(document)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Eye size={17} aria-hidden="true" /></button>}
                                    </div>
                                </article>
                            ))
                        )}
                    </div>

                    {documents && documents.total > 0 && (
                        <nav aria-label="Archive pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                            <p className="text-muted">
                                {documents.from ?? 0}–{documents.to ?? 0} of {documents.total.toLocaleString()} documents
                                {' · '}Page {documents.current_page} of {documents.last_page}
                            </p>
                            <div className="flex gap-2">
                                {documents.prev_page_url ? (
                                    <Link href={documents.prev_page_url} onStart={() => setUpdating(true)} onFinish={() => setUpdating(false)} className="rounded-lg border border-border px-3 py-2 hover:bg-background">Previous</Link>
                                ) : (
                                    <span aria-disabled="true" className="rounded-lg border border-border px-3 py-2 text-muted">Previous</span>
                                )}
                                {documents.next_page_url ? (
                                    <Link href={documents.next_page_url} onStart={() => setUpdating(true)} onFinish={() => setUpdating(false)} className="rounded-lg border border-border px-3 py-2 hover:bg-background">Next</Link>
                                ) : (
                                    <span aria-disabled="true" className="rounded-lg border border-border px-3 py-2 text-muted">Next</span>
                                )}
                            </div>
                        </nav>
                    )}
                </section>
            </div>

            <WorkspaceDialog open={Boolean(viewingDocument)} onClose={() => setViewingDocument(null)} labelledBy="archive-document-details-title" width="max-w-3xl">
                {viewingDocument && <section>
                    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                        <div className="min-w-0">
                            <h2 id="archive-document-details-title" className="break-words text-lg font-semibold text-foreground">{viewingDocument.title || 'Document details'}</h2>
                            <p className="mt-1 break-all font-mono text-sm text-muted">{viewingDocument.tracking_number || 'Tracking number unavailable'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            {viewingDocument.is_finalized && <button type="button" onClick={() => printDisposition(viewingDocument)} disabled={printLoadingId === viewingDocument.id} className="dots-button-secondary px-3" aria-label="Print disposition form">{printLoadingId === viewingDocument.id ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Printer size={16} aria-hidden="true" />} Print disposition</button>}
                            <button type="button" onClick={() => setViewingDocument(null)} aria-label="Close document details" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground"><X size={19} aria-hidden="true" /></button>
                        </div>
                    </div>
                    <div className="space-y-6 p-5 sm:p-6" aria-busy={viewingDocument.details_loading}>
                        {viewingDocument.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading document details and attachments…</p>}
                        {viewingDocument.details_error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{viewingDocument.details_error}</p>}
                        <ArchiveDocumentReferenceDetails document={viewingDocument} loading={viewingDocument.details_loading} />
                        {viewingDocument.approval_status && viewingDocument.approval_status !== 'not_required' && <section className="rounded-xl border border-border bg-background p-4" aria-label="Approval and signing status">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div><h3 className="font-semibold text-foreground">Approval and signing</h3><p className="mt-1 text-sm text-muted">Approval follows the routing record. Signing applies only to the primary PDF; iPluma submission is not connected yet.</p></div>
                                <div className="flex flex-wrap gap-2"><span className={'rounded-full px-2.5 py-1 text-xs font-semibold capitalize ' + archiveStatusClasses(viewingDocument.approval_status)}>{viewingDocument.approval_status.replaceAll('_', ' ')}</span><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-foreground">{(viewingDocument.signature_status || 'not_required').replaceAll('_', ' ')}</span></div>
                            </div>
                        </section>}
                        <DocumentRouteProgress document={viewingDocument} />
                    </div>
                    <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-5 py-4 sm:px-6"><button type="button" onClick={() => setViewingDocument(null)} className="dots-button-secondary">Close</button></div>
                </section>}
            </WorkspaceDialog>
            {printDocument && <DocumentDispositionPrint document={printDocument} />}
        </AuthenticatedLayout>
    );
}

function ArchiveReadOnlyDetail({ label, value }: { label: string; value?: string | null }) {
    return <div role="row" className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"><p role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p><p role="cell" className="break-words text-sm font-medium text-foreground">{value || '—'}</p></div>;
}

function archiveDocumentTypeName(document: ArchiveDocument) {
    const name = document.document_type || '';
    return name.trim().toLowerCase() === 'others' && document.other_document_type ? name + ' (' + document.other_document_type + ')' : name;
}

function archivePurposeName(document: ArchiveDocument) {
    const name = document.purpose_type || '';
    return name.trim().toLowerCase() === 'others' && document.other_purpose ? 'Others (' + document.other_purpose + ')' : name;
}

function ArchiveDocumentReferenceDetails({ document, loading = false }: { document: ArchiveDocument; loading?: boolean }) {
    return <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground">Document details and attachments</h3>
        <section role="table" aria-label="Archived document details" className="mt-3 divide-y divide-border rounded-xl border border-border bg-background px-3 py-1 sm:px-4">
            <ArchiveReadOnlyDetail label="Tracking number" value={document.tracking_number} />
            <ArchiveReadOnlyDetail label="Title" value={document.title} />
            <ArchiveReadOnlyDetail label="Type" value={archiveDocumentTypeName(document)} />
            <ArchiveReadOnlyDetail label="Purpose" value={archivePurposeName(document)} />
            <ArchiveReadOnlyDetail label="Origin" value={document.origin_type} />
            <ArchiveReadOnlyDetail label="Office" value={document.office_short_name || document.office?.short_name || document.office_name || document.office?.name} />
            <div role="row" className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                <p role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
                <span role="cell" className={'inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ' + archiveStatusClasses(document.status)}>{(document.status || 'archived').replaceAll('_', ' ').toUpperCase()}</span>
            </div>
            <ArchiveReadOnlyDetail label="Approval" value={(document.approval_status || 'not_required').replaceAll('_', ' ')} />
            <ArchiveReadOnlyDetail label="Signing" value={(document.signature_status || 'not_required').replaceAll('_', ' ')} />
            <ArchiveReadOnlyDetail label="Created by" value={document.created_by_short_name || document.created_by_name} />
            <ArchiveReadOnlyDetail label="Date created" value={document.created_at} />
            <div role="row" className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"><p role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted">Remarks</p><p role="cell" className="whitespace-pre-wrap break-words text-sm text-foreground">{document.remarks || '—'}</p></div>
        </section>
        <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-foreground">Attached files</p>
                {document.signature_status && document.signature_status !== 'not_required' && <p className="text-xs text-muted">Signing applies to the primary document only. iPluma PDF submission is not connected yet.</p>}
            </div>
            {document.files?.length ? <ul className="mt-3 space-y-2">{document.files.map(file => <li key={file.id} className="rounded-xl border border-border bg-surface p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 rounded-lg bg-secondary p-2 text-primary"><FileText size={17} aria-hidden="true" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold text-foreground">{file.name}</p><div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><span>{file.type === 'original' ? 'Primary document' : file.type === 'supporting' ? 'Supporting file' : file.type}</span>{file.is_pdf && <><span aria-hidden="true">·</span><span>PDF</span></>}{file.uploaded_at && <><span aria-hidden="true">·</span><span>{file.uploaded_at}</span></>}{!file.url && !file.view_url && <span className="text-warning">File not available</span>}</div></div></div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{file.view_url && <a href={file.view_url} target="_blank" rel="noopener noreferrer" className="dots-button-secondary min-h-9 px-3 py-1.5 text-xs"><Eye size={14} aria-hidden="true" />View</a>}{file.url && <a href={file.url} className="dots-button-secondary min-h-9 px-3 py-1.5 text-xs"><Download size={14} aria-hidden="true" />Download</a>}{file.type === 'original' && file.is_pdf && document.signature_status === 'needs_signature' && <button type="button" disabled title={document.approval_status === 'approved' ? 'iPluma file submission is not connected yet.' : 'Available after approval.'} className="dots-button-secondary min-h-9 px-3 py-1.5 text-xs"><FileSignature size={14} aria-hidden="true" />Sign with iPluma</button>}{file.type === 'signed' && <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-medium text-success"><FileSignature size={14} aria-hidden="true" />Signed</span>}</div>
                </div>
            </li>)}</ul> : loading ? null : document.file_url ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="break-all text-sm font-medium text-foreground">{document.file_name || 'Attached file'}</span><a href={document.file_url} className="dots-button-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"><Download size={14} aria-hidden="true" />Download</a></div> : <p className="mt-1 text-sm text-foreground">No file attached.</p>}
        </div>
    </section>;
}

function archiveStatusClasses(status?: string | null) {
    switch ((status || 'pending').toLowerCase()) {
        case 'approved':
        case 'completed':
        case 'released':
        case 'processed':
        case 'done':
            return 'bg-success-soft text-success';
        case 'rejected':
        case 'cancelled':
            return 'bg-danger-soft text-danger';
        case 'archived':
        case 'terminal':
            return 'bg-sidebar/10 text-sidebar';
        case 'pending':
        case 'ongoing':
        case 'available':
        case 'waiting':
        case 'in_progress':
        case 'waiting_on_branch':
        case 'changes_requested':
            return 'bg-warning-soft text-warning';
        default:
            return 'bg-slate-100 text-foreground';
    }
}
