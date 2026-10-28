import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/WorkspaceAlert';
import InfoTip from '@/Components/InfoTip';
import DashboardCharts from '@/Components/DashboardCharts';
import SearchableSelect, { type SearchableSelectOption } from '@/Components/SearchableSelect';
import ProcessingPerformanceChart, { ProcessingPerformanceRow } from '@/Components/ProcessingPerformanceChart';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowDownToLine, LoaderCircle, Search, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

type DashboardStats = {
    awaiting_my_approval?: number;
    my_submissions_awaiting_approval?: number;
    returned_for_revision?: number;
    incoming_documents?: number;
    active_users?: number;
    pending_documents?: number;
    released_documents?: number;
    archived_documents?: number;
};

type RecentDocument = {
    id?: string | number;
    title?: string;
    tracking_number?: string;
    status?: string;
    created_at?: string;
    office?: { name?: string; short_name?: string | null } | null;
};

type IncomingDocument = {
    id: number;
    tracking_number: string;
    title: string;
    from_office?: string | null;
    creator_name?: string | null;
};

type CrudAlert = { title: string; message: string; onConfirm?: () => void; confirmLabel?: string };

const formatNumber = (value?: number | string) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number.toLocaleString() : '0';
};

const displayDate = (date?: string) => {
    if (!date || !Number.isFinite(new Date(date).getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(date));
};

export default function Dashboard({
    analytics, canFilterCharts = false, chartOffices = [], selectedChartOfficeId = null,
    stats = {},
    recentDocuments = [],
    incomingDocuments = [],
    canReceiveDocuments = false,
}: {
    analytics?: {
        documentTypeCounts?: { name: string; count: number }[];
        chartStats?: DashboardStats;
        processingPerformance?: ProcessingPerformanceRow[];
    };
    stats?: DashboardStats;
    canFilterCharts?: boolean;
    chartOffices?: { id: number; name: string; range_name?: string | null }[];
    selectedChartOfficeId?: number | null;
    recentDocuments?: RecentDocument[];
    incomingDocuments?: IncomingDocument[];
    canReceiveDocuments?: boolean;
}) {
    const { navigationVisibility } = usePage().props as any;
    const [chartLoading, setChartLoading] = useState(false);
    const [chartError, setChartError] = useState('');
    const [query, setQuery] = useState('');
    const [incomingQuery, setIncomingQuery] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [receiveError, setReceiveError] = useState('');
    const [receivingId, setReceivingId] = useState<number | null>(null);
    const [crudAlert, setCrudAlert] = useState<CrudAlert | null>(null);
    const documents = useMemo(() => recentDocuments.filter((document) => {
        const search = query.trim().toLowerCase();
        return !search || [document.title, document.tracking_number, document.office?.short_name, document.office?.name].some((value) => value?.toLowerCase().includes(search));
    }), [recentDocuments, query]);
    const visibleIncoming = useMemo(() => {
        const search = incomingQuery.trim().toLowerCase();
        return incomingDocuments.filter((document) => !search || [
            document.tracking_number, document.title, document.from_office, document.creator_name,
        ].some((value) => value?.toLowerCase().includes(search)));
    }, [incomingDocuments, incomingQuery]);

    const receive = (document: IncomingDocument) => {
        if (!canReceiveDocuments || receivingId !== null) return;
        setReceivingId(document.id);
        setReceiveError('');
        router.post(`/documents/${document.id}/receive`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setTrackingNumber('');
                setCrudAlert({ title: 'Document received', message: 'Document received successfully.' });
            },
            onError: (errors) => setReceiveError(errors.tracking_number ?? 'Could not receive this document. Refresh the incoming list and try again.'),
            onFinish: () => setReceivingId(null),
        });
    };

    const confirmReceive = (document: IncomingDocument) => {
        if (!canReceiveDocuments || receivingId !== null) return;
        setCrudAlert({
            title: 'Receive document?',
            message: `Confirm receipt of ${document.tracking_number || 'this document'}?`,
            confirmLabel: 'Receive',
            onConfirm: () => {
                setCrudAlert(null);
                receive(document);
            },
        });
    };

    const receiveByTrackingNumber = () => {
        if (!canReceiveDocuments || receivingId !== null) return;
        const normalized = trackingNumber.trim().toLowerCase();
        const document = incomingDocuments.find((item) => item.tracking_number.toLowerCase() === normalized);
        if (!document) {
            setReceiveError('No available incoming document matches that tracking number.');
            return;
        }
        confirmReceive(document);
    };

    const cards = [
        { label: 'Incoming', value: stats.incoming_documents, detail: 'Awaiting receipt in your access scope.', color: 'text-primary' },
        { label: 'Pending release', value: stats.pending_documents, detail: 'Latest transaction is pending.', color: 'text-warning' },
        { label: 'Released', value: stats.released_documents, detail: 'Documents with a release transaction.', color: 'text-success' },
        { label: 'Archived', value: stats.archived_documents, detail: 'Archived records you can access.', color: 'text-sidebar' },
    ];
    const taskRows: [string, number | undefined, string][] = [
        ['Awaiting my approval', stats.awaiting_my_approval, 'approval'],
        ['My pending submissions', stats.my_submissions_awaiting_approval, 'submitted'],
        ['Returned for revision', stats.returned_for_revision, 'revision'],
    ];
    const tasks = taskRows.filter(([, count]) => Number(count ?? 0) > 0);
    const chartScope = selectedChartOfficeId !== null
        ? chartOffices.find((office) => office.id === selectedChartOfficeId)?.name ?? 'Selected office'
        : canFilterCharts ? 'All offices' : 'Your office';

    return (
        <AuthenticatedLayout header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>}>
            <Head title="Dashboard" />
            <div className="mx-auto max-w-[1440px] space-y-6">
                <section aria-label="Document summary" className="rounded-lg border border-border bg-surface">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
                        <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Within your access</h2><InfoTip label="About document totals">These counts can overlap. Released counts unique documents with a release transaction, not release events. Totals are independent of the analytics office filter. The receiving queue below contains only documents addressed to your office.</InfoTip></div>
                        {navigationVisibility?.all_documents === true && <Link href={route('documents.index')} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline">All documents <ChevronRight size={16} /></Link>}
                    </div>
                    <dl className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4">
                        {cards.map(({ label, value, detail, color }) => <div key={label} className="p-4 sm:p-5">
                            <dt className="text-sm text-muted">{label}</dt>
                            <dd className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${color}`}>{formatNumber(value)}</dd>
                            <dd className="mt-2 text-xs text-muted">{detail}</dd>
                        </div>)}
                    </dl>
                </section>

                <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                    <section aria-labelledby="receive-document-title" className="min-w-0 rounded-lg border border-border bg-surface">
                        <div className="border-b border-border p-5">
                            <div className="mb-2 flex items-center gap-2"><ArrowDownToLine size={20} className="text-primary" aria-hidden="true" /><h2 id="receive-document-title" className="text-xl font-semibold">Receive a document</h2></div><p className="mb-4 text-sm text-muted">Confirm receipt of documents addressed to your office.</p>
                            {!canReceiveDocuments && <p className="mb-4 rounded-lg bg-background p-3 text-sm text-muted">View only. Your role or office assignment does not allow receiving documents.</p>}
                            <form onSubmit={(event) => { event.preventDefault(); receiveByTrackingNumber(); }} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="min-w-0 flex-1"><label htmlFor="receive-tracking-number" className="mb-1 block text-sm font-medium">Tracking number</label><input id="receive-tracking-number" disabled={!canReceiveDocuments || receivingId !== null} value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); setReceiveError(''); }} placeholder="Enter tracking number" className="h-12 w-full rounded-lg border-border bg-surface text-base disabled:opacity-50" /></div>
                                <button type="submit" disabled={!canReceiveDocuments || !trackingNumber.trim() || receivingId !== null} className="dots-button-primary min-h-12">Review receipt</button>
                            </form>
                            {receiveError && <p role="alert" className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{receiveError}</p>}
                        </div>
                        <div className="p-5">
                            <div id="incoming-documents" className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Incoming to your office <span className="ml-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-primary">{incomingDocuments.length}</span></h3>
                                <label className="relative w-full sm:w-60"><span className="sr-only">Search incoming documents</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={incomingQuery} onChange={(event) => setIncomingQuery(event.target.value)} placeholder="Search incoming" className="h-11 w-full rounded-lg border-border pl-9 text-sm" /></label>
                            </div>
                            <div className="max-h-[500px] divide-y divide-border overflow-y-auto" role="region" aria-label="Incoming documents" tabIndex={0}>
                                {visibleIncoming.length === 0 ? <p className="py-10 text-center text-sm text-muted">{incomingQuery ? 'No incoming documents match your search.' : 'No documents are waiting to be received.'}</p> : visibleIncoming.map((document) => <div key={document.id} className="flex items-start justify-between gap-3 py-4">
                                    <div className="min-w-0"><p className="break-words font-semibold">{document.title || 'Untitled document'}</p><p className="mt-1 break-all font-mono text-xs text-muted">{document.tracking_number}</p><p className="mt-1 text-xs text-muted">{document.from_office ? `From ${document.from_office}` : 'Sending office unavailable'}</p></div>
                                    <button type="button" onClick={() => confirmReceive(document)} disabled={!canReceiveDocuments || receivingId !== null} className="dots-button-secondary shrink-0 border-primary px-3 text-primary">{receivingId === document.id ? 'Receiving…' : 'Receive'}</button>
                                </div>)}
                            </div>
                        </div>
                    </section>
                    <div className="min-w-0 space-y-6">
                        <section aria-labelledby="creation-tasks-title" className="rounded-lg border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center justify-between gap-2"><h2 id="creation-tasks-title" className="text-lg font-semibold">Approval tasks</h2></div>
                            {tasks.length ? <div className="divide-y divide-border">{tasks.map(([label, count, queue]) => navigationVisibility?.document_workflow === true
                                ? <Link key={queue} href={route('document-workflow.index')} className="flex items-center justify-between gap-3 rounded-md py-3 text-sm hover:text-primary"><span>{label}</span><span className="rounded-md bg-warning-soft px-2 py-1 font-semibold tabular-nums text-warning">{formatNumber(count)}</span></Link>
                                : <div key={queue} className="flex items-center justify-between gap-3 rounded-md py-3 text-sm"><span>{label}</span><span className="rounded-md bg-warning-soft px-2 py-1 font-semibold tabular-nums text-warning">{formatNumber(count)}</span></div>)}</div> : <p className="py-3 text-sm text-muted">No approval tasks need attention.</p>}
                            {navigationVisibility?.document_workflow === true && <Link href={route('document-workflow.index')} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">Document Workflow <ChevronRight size={15} /></Link>}
                        </section>
                        <section aria-labelledby="recent-documents-title" className="rounded-lg border border-border bg-surface p-5">
                            <div className="mb-3 flex items-center justify-between"><h2 id="recent-documents-title" className="text-lg font-semibold">Recent documents</h2></div>
                            <p className="mb-3 text-xs text-muted">Latest records by creation date · Manila time</p><label className="sr-only" htmlFor="recent-document-search">Search recent documents</label><input id="recent-document-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recent documents" className="mb-2 h-11 w-full rounded-lg border-border text-sm" />
                            {documents.length === 0 ? <p className="py-6 text-sm text-muted">{query ? 'No documents match your search.' : 'No recent documents available.'}</p> : <ul className="divide-y divide-border">{documents.map((document, index) => <li key={document.id ?? index} className="py-3">
                                <p className="break-words text-sm font-semibold">{document.title || document.tracking_number || 'Untitled document'}</p><p className="mt-1 break-words text-xs text-muted">{[document.tracking_number, document.office?.short_name || document.office?.name, document.status].filter(Boolean).join(' · ')}</p><time dateTime={document.created_at} className="mt-1 block text-xs text-muted">{displayDate(document.created_at)}</time>
                            </li>)}</ul>}
                        </section>
                    </div>
                </div>

                <section aria-labelledby="analytics-title" className="space-y-4 border-t border-border pt-6" aria-busy={chartLoading || !analytics}>
                    <div className="flex flex-wrap items-end justify-between gap-4">
                        <div><div className="flex items-center gap-2"><h2 id="analytics-title" className="text-xl font-semibold">Document insights</h2><InfoTip label="About analytics scope">The office filter applies only to the charts below. Your receiving list, summary totals, and approval tasks stay unchanged.</InfoTip></div><p role="status" className="mt-1 inline-flex items-center gap-2 text-sm text-muted">{chartLoading && <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{chartLoading ? 'Updating charts…' : !analytics ? 'Loading analytics…' : chartScope}</p></div>
                        {canFilterCharts && <div className="w-full sm:w-72"><label htmlFor="chart-office" className="mb-1 block text-sm font-medium">Chart office</label><SearchableSelect id="chart-office" ariaLabel="Chart office" disabled={chartLoading} value={selectedChartOfficeId ?? ''} options={chartOffices.map((office): SearchableSelectOption => ({ value: String(office.id), label: `${office.name}${office.range_name ? ` — ${office.range_name}` : ''}`, searchText: `${office.range_name ?? ''} ${office.id}` }))} onChange={(officeId) => {
                            setChartError('');
                            router.get(route('dashboard'), officeId ? { chart_office_id: officeId } : {}, {
                                preserveState: true, preserveScroll: true, replace: true,
                                only: ['analytics', 'selectedChartOfficeId'],
                                onStart: () => setChartLoading(true), onFinish: () => setChartLoading(false),
                                onError: () => setChartError('Could not apply this office filter. Please try again.'),
                            });
                        }} placeholder="All offices" emptyOptionLabel="All offices" searchPlaceholder="Search office or range" className="w-full" buttonClassName="h-11" /></div>}
                    </div>
                    {chartError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{chartError}</p>}
                    {!analytics ? <div className="space-y-4" aria-hidden="true">
                        <div className="grid gap-4 lg:grid-cols-2">
                            {[0, 1].map((panel) => <div key={panel} className="min-h-64 animate-pulse rounded-xl border border-border bg-surface p-5 motion-reduce:animate-none sm:p-6">
                                <div className="h-5 w-40 rounded bg-secondary" />
                                <div className="mt-3 h-3 w-56 max-w-full rounded bg-secondary" />
                                <div className="mt-8 space-y-5">{[0, 1, 2, 3].map((row) => <div key={row} className="flex items-center gap-4"><div className="h-3 w-24 rounded bg-secondary" /><div className="h-3 flex-1 rounded-full bg-secondary" /></div>)}</div>
                            </div>)}
                        </div>
                        <div className="min-h-64 animate-pulse rounded-xl border border-border bg-surface p-5 motion-reduce:animate-none sm:p-6">
                            <div className="h-5 w-48 rounded bg-secondary" /><div className="mt-3 h-3 w-64 max-w-full rounded bg-secondary" />
                            <div className="mt-8 space-y-5">{[0, 1, 2, 3].map((row) => <div key={row} className="flex items-center gap-4"><div className="h-3 w-28 rounded bg-secondary" /><div className="h-3 flex-1 rounded-full bg-secondary" /></div>)}</div>
                        </div>
                    </div> : <>
                        <DashboardCharts stats={analytics.chartStats ?? stats} documentTypes={analytics.documentTypeCounts ?? []} officeFiltered={selectedChartOfficeId !== null} />
                        <ProcessingPerformanceChart data={analytics.processingPerformance ?? []} />
                    </>}
                </section>
            </div>
            {crudAlert && <CrudAlertModal {...crudAlert} onClose={() => setCrudAlert(null)} />}
        </AuthenticatedLayout>
    );
}
