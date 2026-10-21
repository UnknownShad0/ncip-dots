import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { FileCheck2, FileClock, FileSignature, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

type Page = { current_page: number; last_page: number; total: number; per_page: number };
type ReadyDocument = { id: number; title: string; document_type?: string; status: string; version_number: number; official_document_id?: number | null; updated_at?: string };
type TrackedDocument = { id: number; title: string; tracking_number: string; document_type?: string; approval_status: string; signature_status: string; office?: string; revision_draft_id?: number | null; updated_at?: string };

function Status({ value }: { value: string }) {
    const label = value.replaceAll('_', ' ');
    const color = ['approved', 'signed'].includes(value) ? 'bg-success-soft text-success' : ['rejected'].includes(value) ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning';
    return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${color}`}>{label}</span>;
}

function Pager({ page, query, pageKey }: { page: Page; query: string; pageKey: string }) {
    if (page.last_page < 2) return null;
    const go = (next: number) => router.get(route('document-workflow.index'), { search: query, [pageKey]: next }, { preserveScroll: true, preserveState: true });
    return <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{page.total} item{page.total === 1 ? '' : 's'} · Page {page.current_page} of {page.last_page}</span>
        <div className="flex gap-2">
            <button type="button" disabled={page.current_page <= 1} onClick={() => go(page.current_page - 1)} className="dots-button-secondary disabled:opacity-50">Previous</button>
            <button type="button" disabled={page.current_page >= page.last_page} onClick={() => go(page.current_page + 1)} className="dots-button-secondary disabled:opacity-50">Next</button>
        </div>
    </div>;
}

function Section({ title, description, icon: Icon, empty, page, query, pageKey, children }: {
    title: string; description: string; icon: typeof FileText; empty: string; page: Page; query: string; pageKey: string; children: ReactNode;
}) {
    return <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex items-start gap-3">
            <span className="rounded-lg bg-secondary p-2 text-primary"><Icon size={19} aria-hidden="true" /></span>
            <div><h2 className="font-semibold text-foreground">{title}</h2><p className="mt-1 text-sm text-muted">{description}</p></div>
        </div>
        {page.total ? <div className="divide-y divide-border">{children}</div> : <p className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted">{empty}</p>}
        <Pager page={page} query={query} pageKey={pageKey} />
    </section>;
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
    const [search, setSearch] = useState(initialSearch);
    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('document-workflow.index'), { search }, { preserveScroll: true, preserveState: true, replace: true });
    };
    const openTracked = (id: number) => route('documents.index', { open_document_id: id });
    const trackedRow = (document: TrackedDocument, actionText = 'Open in Routing') => <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
        <div className="min-w-0 flex-1">
            <p className="break-words font-medium text-foreground">{document.title}</p>
            <p className="mt-1 text-xs text-muted">{[document.tracking_number, document.document_type, document.office].filter(Boolean).join(' · ')}</p>
            <div className="mt-2 flex flex-wrap gap-2"><Status value={document.approval_status} />{document.signature_status !== 'not_required' && <Status value={document.signature_status} />}</div>
        </div>
        <Link href={openTracked(document.id)} className="dots-button-secondary">{actionText}</Link>
    </article>;

    return <AuthenticatedLayout header={<div><h1 className="text-2xl font-semibold tracking-tight">Document Workflow</h1></div>}>
        <Head title="Document Workflow" />
        <main className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="max-w-3xl text-sm text-muted">Find generated files ready for routing, follow your tracked submissions, and open approval tasks in Tracking/Routing.</p></div>
                <form onSubmit={submitSearch} className="flex w-full max-w-md gap-2">
                    <label className="sr-only" htmlFor="workflow-search">Search workflow</label>
                    <input id="workflow-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or tracking number" className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2" />
                    <button type="submit" className="dots-button-primary inline-flex items-center gap-2"><Search size={16} />Search</button>
                </form>
            </div>

            <Section title="Ready for Routing" description="Finalized generated files that have not been attached to a routing record." icon={FileText} empty="No generated documents are ready for routing." page={readyPagination} query={search} pageKey="ready_page">
                {readyDocuments.map((document) => <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1"><p className="break-words font-medium text-foreground">{document.title}</p><p className="mt-1 text-xs text-muted">{[document.document_type, `Version ${document.version_number}`, document.updated_at].filter(Boolean).join(' · ')}</p><div className="mt-2"><Status value={document.status === 'revision_requested' ? 'changes_requested' : 'ready_for_routing'} /></div></div>
                    {document.status === 'revision_requested' ? <Link href={route('document-creation.index', { edit_draft_id: document.id })} className="dots-button-secondary">Revise document</Link> : <div className="flex flex-wrap gap-2"><Link href={route('document-creation.index', { edit_draft_id: document.id })} className="dots-button-secondary">Edit document</Link><Link href={route('documents.index', { create_routing_draft_id: document.id })} className="dots-button-primary">Create routing record</Link></div>}
                </article>)}
            </Section>

            {canReview && <Section title="Approval Tasks" description="Tracked files waiting for a decision from your office." icon={FileClock} empty="No tracked files are waiting for your approval." page={approvalPagination} query={search} pageKey="approval_page">{approvalTasks.map((document) => trackedRow(document))}</Section>}

            <Section title="My Submissions" description="Documents you sent into routing, including items returned for changes." icon={FileSignature} empty="You have no tracked submissions yet." page={submissionPagination} query={search} pageKey="submission_page">
                {mySubmissions.map((document) => <div key={document.id}>{trackedRow(document, 'Open in Routing')}{document.approval_status === 'changes_requested' && document.revision_draft_id && <div className="-mt-2 pb-4"><Link href={route('document-creation.index', { edit_draft_id: document.revision_draft_id })} className="text-sm font-semibold text-primary hover:underline">Edit the returned generated document</Link></div>}</div>)}
            </Section>

            <Section title="Approved Documents" description="Tracked submissions that have passed approval." icon={FileCheck2} empty="No documents have been approved yet." page={approvedPagination} query={search} pageKey="approved_page">{approvedDocuments.map((document) => trackedRow(document))}</Section>
        </main>
    </AuthenticatedLayout>;
}
