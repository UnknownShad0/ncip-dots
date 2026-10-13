import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentDispositionPrint from '@/Components/DocumentDispositionPrint';
import WorkspaceDialog from '@/Components/WorkspaceDialog';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import { Eye, FileText, LoaderCircle, Printer, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type ArchiveDocument = {
    id: number;
    title: string;
    tracking_number: string;
    tracking_url?: string | null;
    office?: { name: string; short_name: string | null } | null;
    office_name?: string;
    office_short_name?: string | null;
    document_type?: string;
    other_document_type?: string | null;
    purpose_type?: string;
    origin_type?: string;
    status?: string;
    remarks?: string;
    is_finalized?: boolean;
    created_at?: string;
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

export default function ArchivesIndex({ documents, canFilterOffices = false, offices = [], filters = { office_id: null, year: null, search: '', sort: 'newest' } }: {
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
        ...(officeId ? { office_id: officeId } : {}), ...(year ? { year } : {}), ...(search.trim() ? { search: search.trim() } : {}), sort,
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
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold text-foreground">
                            Archived documents
                            {documents && <span className="ml-1 text-sm font-normal text-muted">({documents.total})</span>}
                        </h2>
                        {documents && (
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                {canFilterOffices && (
                                    <label>
                                        <span className="sr-only">Filter by originating bureau or office</span>
                                        <select
                                            aria-label="Filter by originating bureau or office"
                                            value={filters.office_id ?? ''}
                                            onChange={event => updateFilters(event.target.value, String(filters.year ?? ''), filters.sort)}
                                            className="h-10 w-full rounded-lg border-border text-sm sm:w-auto"
                                        >
                                            <option value="">All bureaus / offices</option>
                                            {offices.map(office => <option key={office.id} value={office.id}>{office.name}</option>)}
                                        </select>
                                    </label>
                                )}
                                <label>
                                    <span className="sr-only">Filter by year</span>
                                    <select
                                        aria-label="Filter by year"
                                        value={filters.year ?? ''}
                                        onChange={event => updateFilters(String(filters.office_id ?? ''), event.target.value, filters.sort)}
                                        className="h-10 w-full rounded-lg border-border text-sm sm:w-auto"
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
                                        className="h-10 w-full rounded-lg border-border text-sm sm:w-auto"
                                    >
                                        <option value="newest">Date created: newest first</option>
                                        <option value="oldest">Date created: oldest first</option>
                                        <option value="bureau_asc">Bureau / office: A–Z</option>
                                        <option value="bureau_desc">Bureau / office: Z–A</option>
                                    </select>
                                </label>
                                <form onSubmit={event => { event.preventDefault(); updateFilters(String(filters.office_id ?? ''), String(filters.year ?? ''), filters.sort); }} className="flex min-w-0 gap-2">
                                    <label className="relative min-w-0 flex-1 sm:flex-none">
                                        <span className="sr-only">Search title or tracking number by prefix</span>
                                        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                                        <input type="search" aria-label="Search title or tracking number by prefix" value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Title or tracking number" maxLength={100} className="h-10 w-full rounded-lg border-border pl-9 text-sm sm:w-56" />
                                    </label>
                                    <button type="submit" className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-secondary">Search</button>
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
                                            <span className="select-all font-mono text-xs">{document.tracking_number || 'No tracking number'}</span>
                                            <span>{document.office?.name ?? 'Unassigned'}</span>
                                            <span>{document.created_at || 'Date not recorded'}</span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">{(document.status || 'archived').replace(/[_-]+/g, ' ')}</span>
                                        <button type="button" aria-label="View document" title="View document" onClick={() => openDocumentDetails(document)} className="rounded-md bg-slate-100 p-2 text-foreground hover:bg-slate-200"><Eye size={15} aria-hidden="true" /></button>
                                        {document.is_finalized && <button type="button" aria-label="Print disposition form" title="Print disposition form" disabled={printLoadingId === document.id} onClick={() => printDisposition(document)} className="rounded-md bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-60">{printLoadingId === document.id ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Printer size={15} aria-hidden="true" />}</button>}
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

            <WorkspaceDialog open={Boolean(viewingDocument)} onClose={() => setViewingDocument(null)} labelledBy="archive-document-details-title" width="max-w-4xl">
                {viewingDocument && <section>
                    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><FileText size={20} aria-hidden="true" /></span>
                            <div className="min-w-0"><h2 id="archive-document-details-title" className="text-lg font-semibold text-foreground">Document details</h2><p className="mt-0.5 break-words text-sm text-muted">Review document information and transaction history.</p></div>
                        </div>
                        <button type="button" onClick={() => setViewingDocument(null)} aria-label="Close document details" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground"><X size={19} aria-hidden="true" /></button>
                    </div>
                    <div className="space-y-6 p-5 sm:p-6" aria-busy={viewingDocument.details_loading}>
                        {viewingDocument.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading transaction history and attachments…</p>}
                        {viewingDocument.details_error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{viewingDocument.details_error}</p>}
                        <section aria-label="Document information" className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
                            <ArchiveDetail label="Tracking number" value={viewingDocument.tracking_number || '—'} />
                            <ArchiveDetail label="Title" value={viewingDocument.title || 'Untitled'} />
                            <ArchiveDetail label="Document type" value={`${viewingDocument.document_type || '—'}${viewingDocument.other_document_type ? ` (${viewingDocument.other_document_type})` : ''}`} />
                            <ArchiveDetail label="Origin" value={viewingDocument.origin_type || '—'} />
                            <ArchiveDetail label="Office" value={viewingDocument.office_short_name || viewingDocument.office?.short_name || viewingDocument.office_name || viewingDocument.office?.name || '—'} />
                            <div><p className="text-xs font-semibold uppercase text-muted">Status</p><span className="mt-1 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">{archiveStatusLabel(viewingDocument.status)}</span></div>
                            <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-semibold uppercase text-muted">Remarks</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{viewingDocument.remarks || '—'}</p></div>
                        </section>
                        <section aria-labelledby="archive-transaction-history-title">
                            <div className="mb-3 flex items-center justify-between gap-3"><div><h3 id="archive-transaction-history-title" className="font-semibold text-foreground">Transaction history</h3><p className="mt-0.5 text-sm text-muted">Document activity in workflow order.</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted">{viewingDocument.transactions?.length ?? 0} transactions</span></div>
                            {viewingDocument.transactions?.length ? <ol className="space-y-3 border-l-2 border-border pl-4">{viewingDocument.transactions.map((transaction, index) => <li key={`${transaction.created_at ?? 'transaction'}-${index}`} className="relative rounded-xl border border-border bg-background p-3 before:absolute before:-left-[22px] before:top-4 before:h-2.5 before:w-2.5 before:rounded-full before:bg-primary"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-foreground">{transaction.action || transaction.status || 'Transaction'}</span><span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium uppercase text-muted">{transaction.status || '—'}</span></div><p className="mt-1 text-sm text-muted">{[transaction.from_office_short_name || transaction.from_office, transaction.to_office_short_name || transaction.to_office].filter(Boolean).join(' → ') || (transaction.holder_short_name || transaction.holder ? `Held by ${transaction.holder_short_name || transaction.holder}` : 'Office details unavailable')}</p><p className="mt-1 text-xs text-muted">{[transaction.created_by_short_name || transaction.created_by, transaction.created_at].filter(Boolean).join(' · ') || 'Date and user unavailable'}</p></li>)}</ol> : viewingDocument.details_loading ? null : <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No transactions recorded.</p>}
                        </section>
                    </div>
                    <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-5 py-4 sm:px-6"><button type="button" onClick={() => setViewingDocument(null)} className="dots-button-secondary">Close</button></div>
                </section>}
            </WorkspaceDialog>
            {printDocument && <DocumentDispositionPrint document={printDocument} />}
        </AuthenticatedLayout>
    );
}

function ArchiveDetail({ label, value }: { label: string; value: string }) {
    return <div><p className="text-xs font-semibold uppercase text-muted">{label}</p><p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p></div>;
}

function archiveStatusLabel(status?: string) {
    return (status || 'archived').replace(/[_-]+/g, ' ').toUpperCase();
}
