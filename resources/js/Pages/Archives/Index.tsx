import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';

type ArchivePage = {
    data: { id: number; title: string; tracking_number: string; office?: { name: string; short_name: string | null } | null }[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function ArchivesIndex({ documents, canFilterOffices = false, offices = [], filters = { office_id: null, sort: 'newest' } }: {
    documents?: ArchivePage;
    canFilterOffices?: boolean;
    offices?: { id: number; name: string }[];
    filters?: { office_id: number | null; sort: string };
}) {
    const updateFilters = (officeId: string, sort: string) => router.get(route('archives.index'), {
        ...(officeId ? { office_id: officeId } : {}), sort,
    }, { preserveScroll: true, preserveState: true, replace: true });
    const rows = documents?.data ?? [];

    return (
        <AuthenticatedLayout
            header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Archives</h1>}
        >
            <Head title="Archives" />

            <div className="mx-auto max-w-[1440px] space-y-6">
                <p className="text-sm text-muted">Browse archived documents.</p>

                <section className="rounded-xl border border-border bg-surface p-5">
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
                                            onChange={event => updateFilters(event.target.value, filters.sort)}
                                            className="h-10 w-full rounded-lg border-border text-sm sm:w-auto"
                                        >
                                            <option value="">All bureaus / offices</option>
                                            {offices.map(office => <option key={office.id} value={office.id}>{office.name}</option>)}
                                        </select>
                                    </label>
                                )}
                                <label>
                                    <span className="sr-only">Sort archived documents</span>
                                    <select
                                        aria-label="Sort archived documents"
                                        value={filters.sort}
                                        onChange={event => updateFilters(String(filters.office_id ?? ''), event.target.value)}
                                        className="h-10 w-full rounded-lg border-border text-sm sm:w-auto"
                                    >
                                        <option value="newest">Date created: newest first</option>
                                        <option value="oldest">Date created: oldest first</option>
                                        <option value="bureau_asc">Bureau / office: A–Z</option>
                                        <option value="bureau_desc">Bureau / office: Z–A</option>
                                    </select>
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="divide-y divide-border">
                        {rows.length === 0 ? (
                            <p className="rounded-lg bg-background p-5 text-sm text-muted">No archived documents found.</p>
                        ) : (
                            rows.map(document => (
                                <article key={document.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                                    <div className="min-w-0">
                                        <h3 className="break-words font-semibold text-foreground" title={document.title}>
                                            {document.title.length > 72 ? `${document.title.slice(0, 72)}…` : document.title}
                                        </h3>
                                        <p className="mt-1 break-words text-sm text-muted">
                                            {document.tracking_number} · {document.office?.name ?? 'Unassigned'}
                                        </p>
                                    </div>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Archived</span>
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
                                    <Link href={documents.prev_page_url} className="rounded-lg border border-border px-3 py-2 hover:bg-background">Previous</Link>
                                ) : (
                                    <span aria-disabled="true" className="rounded-lg border border-border px-3 py-2 text-muted">Previous</span>
                                )}
                                {documents.next_page_url ? (
                                    <Link href={documents.next_page_url} className="rounded-lg border border-border px-3 py-2 hover:bg-background">Next</Link>
                                ) : (
                                    <span aria-disabled="true" className="rounded-lg border border-border px-3 py-2 text-muted">Next</span>
                                )}
                            </div>
                        </nav>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
