import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DocumentLifecycleAction from '@/Components/DocumentLifecycleAction';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    ChevronRight,
    ArrowLeft,
    FileCheck2,
    FileClock,
    FileSignature,
    FileText,
    Eye,
    Pencil,
    Search,
} from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

type Page = { current_page: number; last_page: number; total: number; per_page: number };
type ReadyDocument = {
    id: number;
    title: string;
    document_type?: string;
    status: string;
    version_number: number;
    official_document_id?: number | null;
    can_edit?: boolean;
    preview_url: string;
    updated_at?: string;
};
type TrackedDocument = {
    id: number;
    title: string;
    tracking_number: string;
    document_type?: string;
    approval_status: string;
    signature_status: string;
    office?: string;
    revision_draft_id?: number | null;
    updated_at?: string;
};
type QueueKey = 'ready' | 'approvals' | 'submissions' | 'approved';

function Status({ value }: { value: string }) {
    const labels: Record<string, string> = {
        ready_for_routing: 'Ready for routing',
        revision_requested: 'Changes requested',
        changes_requested: 'Changes requested',
        awaiting_approval: 'Awaiting approval',
        needs_signature: 'Needs signature',
        signed: 'Signed',
        approved: 'Approved',
        rejected: 'Rejected',
    };
    const color = ['approved', 'signed', 'ready_for_routing'].includes(value)
        ? 'bg-success-soft text-success'
        : ['rejected', 'failed'].includes(value)
            ? 'bg-danger-soft text-danger'
            : ['awaiting_approval', 'changes_requested', 'revision_requested', 'needs_signature'].includes(value)
                ? 'bg-warning-soft text-warning'
                : 'bg-secondary text-muted';

    return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
        {labels[value] ?? value.replaceAll('_', ' ')}
    </span>;
}

function Pager({ page, query, pageKey }: { page: Page; query: string; pageKey: string }) {
    if (page.last_page < 2) return null;

    const go = (next: number) => router.get(
        route('document-workflow.index'),
        { search: query, [pageKey]: next },
        { preserveScroll: true, preserveState: true },
    );

    return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 text-sm text-muted sm:px-6">
        <span>{page.total} {page.total === 1 ? 'document' : 'documents'} · Page {page.current_page} of {page.last_page}</span>
        <div className="flex gap-2">
            <button type="button" disabled={page.current_page <= 1} onClick={() => go(page.current_page - 1)} className="dots-button-secondary min-h-10 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
            <button type="button" disabled={page.current_page >= page.last_page} onClick={() => go(page.current_page + 1)} className="dots-button-secondary min-h-10 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
        </div>
    </div>;
}

function EmptyQueue({ searching, children }: { searching: boolean; children: ReactNode }) {
    return <div className="mx-4 my-5 rounded-xl border border-dashed border-border bg-background/50 px-5 py-10 text-center sm:mx-6">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-secondary text-muted" aria-hidden="true">
            <FileText size={20} />
        </span>
        <p className="mt-3 font-medium text-foreground">{searching ? 'No matching documents' : children}</p>
        {searching && <p className="mt-1 text-sm text-muted">Try another title or tracking number.</p>}
    </div>;
}

function DocumentRow({ title, details, statuses, action, extraAction, updatedAt }: {
    title: string;
    details: (string | undefined)[];
    statuses: string[];
    action: ReactNode;
    extraAction?: ReactNode;
    updatedAt?: string;
}) {
    return <article className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 flex-1">
            <h3 className="break-words font-semibold text-foreground">{title || 'Untitled document'}</h3>
            <p className="mt-1 break-words text-sm text-muted">{details.filter(Boolean).join(' · ')}</p>
            <div className="mt-3 flex flex-wrap gap-2">{statuses.map((status, index) => <Status key={`${status}-${index}`} value={status} />)}</div>
            {updatedAt && <p className="mt-2 text-xs text-muted">Updated {updatedAt}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {extraAction}
            {action}
        </div>
    </article>;
}

export default function Index({ search: initialSearch = '', readyDocuments = [], readyPagination, mySubmissions = [], submissionPagination, approvalTasks = [], approvalPagination, approvedDocuments = [], approvedPagination, canReview = false }: {
    search?: string;
    readyDocuments: ReadyDocument[];
    readyPagination: Page;
    mySubmissions: TrackedDocument[];
    submissionPagination: Page;
    approvalTasks: TrackedDocument[];
    approvalPagination: Page;
    approvedDocuments: TrackedDocument[];
    approvedPagination: Page;
    canReview?: boolean;
}) {
    const { navigationVisibility } = usePage().props as any;
    const [search, setSearch] = useState(initialSearch);
    const [activeQueue, setActiveQueue] = useState<QueueKey | null>(null);

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('document-workflow.index'), { search }, { preserveScroll: true, preserveState: true, replace: true });
    };

    const openTracked = (id: number) => route('documents.index', { open_document_id: id });
    const queues = [
        { key: 'ready' as const, label: 'Ready to Route', description: 'Finalized generated files available for new routing records.', count: readyPagination.total, icon: FileText },
        ...(canReview ? [{ key: 'approvals' as const, label: 'Approval Tasks', description: 'Tracked files waiting for a decision from your office.', count: approvalPagination.total, icon: FileClock }] : []),
        { key: 'submissions' as const, label: 'My Submissions', description: 'Documents you sent into routing, including returned items.', count: submissionPagination.total, icon: FileSignature },
        { key: 'approved' as const, label: 'Approved Documents', description: 'Tracked submissions that have passed approval.', count: approvedPagination.total, icon: FileCheck2 },
    ];

    const renderTrackedRows = (documents: TrackedDocument[], actionText: string, showRevisionLink = false) => documents.map((document) => (
        <DocumentRow
            key={document.id}
            title={document.title}
            details={[document.tracking_number, document.document_type, document.office]}
            statuses={[document.approval_status, ...(document.signature_status !== 'not_required' ? [document.signature_status] : [])]}
            updatedAt={document.updated_at}
            action={<Link href={openTracked(document.id)} className="dots-button-secondary inline-flex min-h-10 items-center gap-2">{actionText}<ArrowRight size={15} aria-hidden="true" /></Link>}
            extraAction={showRevisionLink && document.approval_status === 'changes_requested' && document.revision_draft_id
                ? <Link href={route('document-creation.index', { edit_draft_id: document.revision_draft_id })} className="dots-button-primary inline-flex min-h-10 items-center">Revise document</Link>
                : undefined}
        />
    ));

    let panelTitle = '';
    let panelDescription = '';
    let panelCount = 0;
    let panelPage: Page = readyPagination;
    let pageKey = 'ready_page';
    let rows: ReactNode = null;
    let emptyText = '';

    if (activeQueue === null) {
        // The workflow landing view shows only the queue directory.
    } else if (activeQueue === 'ready') {
        panelTitle = 'Ready to Route';
        panelDescription = 'Finalized generated documents available for new routing records. A document can be routed more than once.';
        panelCount = readyPagination.total;
        panelPage = readyPagination;
        pageKey = 'ready_page';
        emptyText = 'No generated documents are ready for routing.';
        rows = readyDocuments.map((document) => <DocumentRow
            key={document.id}
            title={document.title}
            details={[document.document_type, `Version ${document.version_number}`, document.updated_at ? `Updated ${document.updated_at}` : undefined]}
            statuses={[document.status === 'revision_requested' ? 'revision_requested' : 'ready_for_routing']}
            action={document.status === 'revision_requested'
                ? <Link href={route('document-creation.index', { edit_draft_id: document.id })} className="dots-button-primary inline-flex min-h-10 items-center gap-2">Revise document<ArrowRight size={15} aria-hidden="true" /></Link>
                : <>
                    <a href={document.preview_url} target="_blank" rel="noreferrer" className="dots-button-secondary inline-flex min-h-10 items-center gap-2">
                        <Eye size={16} aria-hidden="true" />View
                    </a>
                    {document.can_edit && <Link href={route('document-creation.index', { edit_draft_id: document.id })} className="dots-button-secondary inline-flex min-h-10 items-center gap-2">
                        <Pencil size={16} aria-hidden="true" />Edit
                    </Link>}
                    <DocumentLifecycleAction action="archive" title={document.title} url={route('document-creation.archive', document.id)} />
                    {navigationVisibility?.all_documents === true && <Link href={route('documents.index', { create_routing_draft_id: document.id })} className="dots-button-primary inline-flex min-h-10 items-center gap-2">
                        Route<ArrowRight size={15} aria-hidden="true" />
                    </Link>}
                </>}
        />);
    } else if (activeQueue === 'approvals') {
        panelTitle = 'Approval Tasks';
        panelDescription = 'Tracked files waiting for a decision from your office.';
        panelCount = approvalPagination.total;
        panelPage = approvalPagination;
        pageKey = 'approval_page';
        emptyText = 'No tracked files are waiting for your approval.';
        rows = renderTrackedRows(approvalTasks, 'Review in Routing');
    } else if (activeQueue === 'submissions') {
        panelTitle = 'My Submissions';
        panelDescription = 'Documents you sent into routing, including items returned for changes.';
        panelCount = submissionPagination.total;
        panelPage = submissionPagination;
        pageKey = 'submission_page';
        emptyText = 'You have no tracked submissions yet.';
        rows = renderTrackedRows(mySubmissions, 'Open in Routing', true);
    } else {
        panelTitle = 'Approved Documents';
        panelDescription = 'Tracked submissions that have passed approval.';
        panelCount = approvedPagination.total;
        panelPage = approvedPagination;
        pageKey = 'approved_page';
        emptyText = 'No documents have been approved yet.';
        rows = renderTrackedRows(approvedDocuments, 'Open in Routing');
    }

    const activePanelId = activeQueue ? `workflow-panel-${activeQueue}` : undefined;

    return <AuthenticatedLayout header={<div><h1 className="text-2xl font-semibold tracking-tight">Document Workflow</h1></div>}>
        <Head title="Document Workflow" />
        <main className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="max-w-2xl text-sm text-muted">Track documents that need your action, follow your submissions, and find approved files.</p>
                </div>
                <form onSubmit={submitSearch} className="flex w-full gap-2 sm:max-w-md">
                    <label className="sr-only" htmlFor="workflow-search">Search workflow</label>
                    <div className="relative min-w-0 flex-1">
                        <Search size={17} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input id="workflow-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or tracking number" className="h-11 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm" />
                    </div>
                    <button type="submit" className="dots-button-primary min-h-11">Search</button>
                </form>
            </div>

            {activeQueue === null ? <div role="group" aria-label="Document queues" className="no-print divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {queues.map(({ key, label, description, count, icon: Icon }) => <button
                    key={key}
                    type="button"
                    onClick={() => setActiveQueue(key)}
                    className="flex min-h-11 w-full items-center gap-3 p-4 text-left transition-colors hover:bg-background sm:p-5"
                >
                    <Icon size={20} className="shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-foreground">{label}</span>
                        <span className="mt-1 block text-sm text-muted">{description}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted">{count} {count === 1 ? 'document' : 'documents'}</span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </button>)}
            </div> : <div className="space-y-4">
            <button type="button" onClick={() => setActiveQueue(null)} className="dots-button-secondary inline-flex min-h-10 items-center gap-2">
                <ArrowLeft size={16} aria-hidden="true" />All workflow queues
            </button>
            <section id={activePanelId} aria-labelledby="workflow-panel-heading" tabIndex={0} className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className="border-b border-border px-4 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 id="workflow-panel-heading" className="text-lg font-semibold text-foreground">{panelTitle}<span className="ml-2 inline-flex min-w-7 items-center justify-center rounded-full bg-secondary px-2 py-0.5 align-middle text-xs font-semibold text-primary">{panelCount}</span></h2>
                            <p className="mt-1 text-sm text-muted">{panelDescription}</p>
                        </div>
                        <p className="text-xs text-muted">{panelCount} {panelCount === 1 ? 'document' : 'documents'}</p>
                    </div>
                </div>
                {panelCount > 0
                    ? <div className="divide-y divide-border">{rows}</div>
                    : <EmptyQueue searching={Boolean(search.trim())}>{emptyText}</EmptyQueue>}
                <Pager page={panelPage} query={search} pageKey={pageKey} />
            </section>
            </div>}
        </main>
    </AuthenticatedLayout>;
}
