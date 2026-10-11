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
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Document management</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Archives</h1></div>}
        >
            <Head title="Archives" />

            <div className="mx-auto max-w-[1440px] rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-[#171717]">Archived documents</h2><p className="mt-1 text-sm text-[#73736e]">Browse documents moved to archive.</p></div>

                {documents && <div className="mb-5 flex flex-wrap gap-4">
                    {canFilterOffices && <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700">
                        Originating bureau / office
                        <select className="max-w-full rounded-lg border-slate-300 text-sm sm:max-w-md" value={filters.office_id ?? ''} onChange={event => updateFilters(event.target.value, filters.sort)}>
                            <option value="">All bureaus / offices</option>
                            {offices.map(office => <option key={office.id} value={office.id}>{office.name}</option>)}
                        </select>
                    </label>}
                    <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                        Sort by
                        <select className="rounded-lg border-slate-300 text-sm" value={filters.sort} onChange={event => updateFilters(String(filters.office_id ?? ''), event.target.value)}>
                            <option value="newest">Date created: newest first</option>
                            <option value="oldest">Date created: oldest first</option>
                            <option value="bureau_asc">Bureau / office: A–Z</option>
                            <option value="bureau_desc">Bureau / office: Z–A</option>
                        </select>
                    </label>
                </div>}
                {rows.length === 0 ? (
                    <p className="text-slate-500">No archived documents found.</p>
                ) : (
                    <div className="space-y-3">
                        {rows.map((document) => (
                            <div key={document.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                                <div>
                                    <div className="font-medium text-slate-800">{document.title}</div>
                                    <div className="text-sm text-slate-500">{document.tracking_number}</div>
                                    <div className="mt-1 text-xs text-slate-500">Originating office: {document.office?.name ?? 'Unassigned'}</div>
                                </div>
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                                    Archived
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                {documents && documents.total > 0 && <nav aria-label="Archive pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
                    <p className="text-slate-600">{documents.from ?? 0}–{documents.to ?? 0} of {documents.total.toLocaleString()} documents · Page {documents.current_page} of {documents.last_page}</p>
                    <div className="flex gap-2">
                        {documents.prev_page_url ? <Link href={documents.prev_page_url} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">Previous</Link> : <span aria-disabled="true" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-400">Previous</span>}
                        {documents.next_page_url ? <Link href={documents.next_page_url} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">Next</Link> : <span aria-disabled="true" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-400">Next</span>}
                    </div>
                </nav>}
            </div>
        </AuthenticatedLayout>
    );
}
