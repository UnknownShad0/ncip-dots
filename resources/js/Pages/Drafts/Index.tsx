import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, Link, router } from "@inertiajs/react";
import { FileText, Pencil, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type DraftItem = {
    id: number;
    source: "tracking" | "generation";
    title: string;
    status: string;
    document_type?: string | null;
    tracking_number?: string | null;
    office?: string | null;
    created_at?: string | null;
};

type Pagination = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};

export default function Index({
    drafts = [],
    pagination = { current_page: 1, last_page: 1, per_page: 5, total: 0 },
    source = "tracking",
    filters = {},
}: {
    drafts: DraftItem[];
    pagination?: Pagination;
    source?: "tracking" | "generation";
    filters?: { source?: "tracking" | "generation"; search?: string };
}) {
    const [search, setSearch] = useState(filters.search ?? "");

    useEffect(() => setSearch(filters.search ?? ""), [filters.search, source]);

    const visit = (changes: Record<string, string | number>) => {
        router.get(
            route("drafts.index"),
            { source, search, ...changes },
            { preserveScroll: true, preserveState: true, replace: true },
        );
    };

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        visit({ page: 1 });
    };

    const sourceLabel = source === "tracking" ? "Document Tracking" : "Document Generation";

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Drafts</h1>
                    <p className="mt-1 text-sm text-muted">
                        Resume saved documents from either workflow.
                    </p>
                </div>
            }
        >
            <Head title="Drafts" />
            <div className="mx-auto max-w-[1440px] space-y-6">
                <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4">
                        <div>
                            <h2 className="text-lg font-semibold">Saved drafts</h2>
                            <p className="mt-1 text-sm text-muted">
                                Choose a source to find and continue a draft.
                            </p>
                        </div>
                        <form onSubmit={submitSearch} className="flex w-full gap-2 sm:w-auto">
                            <label className="relative min-w-0 flex-1 sm:w-72">
                                <span className="sr-only">Search {sourceLabel} drafts</span>
                                <Search
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                                    aria-hidden="true"
                                />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search drafts"
                                    className="h-11 w-full rounded-lg border-border pl-9 text-sm"
                                />
                            </label>
                            <button type="submit" className="dots-button-secondary">
                                Search
                            </button>
                        </form>
                    </div>

                    <div className="flex gap-2 border-b border-border px-5 pt-3" role="tablist" aria-label="Draft source">
                        <Link
                            href={route("drafts.index", { source: "tracking" })}
                            role="tab"
                            aria-selected={source === "tracking"}
                            className={`rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold ${source === "tracking" ? "border-border bg-background text-primary" : "border-transparent text-muted hover:bg-background"}`}
                        >
                            Document Tracking
                        </Link>
                        <Link
                            href={route("drafts.index", { source: "generation" })}
                            role="tab"
                            aria-selected={source === "generation"}
                            className={`rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold ${source === "generation" ? "border-border bg-background text-primary" : "border-transparent text-muted hover:bg-background"}`}
                        >
                            Document Generation
                        </Link>
                    </div>

                    <div className="px-5">
                        <div className="flex items-center justify-between gap-3 py-4">
                            <h3 className="font-semibold">{sourceLabel} drafts</h3>
                            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-primary">
                                {pagination.total}
                            </span>
                        </div>
                        <div className="divide-y divide-border">
                            {drafts.length === 0 ? (
                                <div className="rounded-lg bg-background px-5 py-10 text-center">
                                    <FileText size={24} className="mx-auto text-muted" aria-hidden="true" />
                                    <p className="mt-3 font-medium">No {sourceLabel.toLowerCase()} drafts found</p>
                                    <p className="mt-1 text-sm text-muted">
                                        {search ? "Try a different search." : "Saved drafts will appear here so you can continue later."}
                                    </p>
                                </div>
                            ) : drafts.map((draft) => (
                                <article key={`${draft.source}-${draft.id}`} className="flex flex-wrap items-center justify-between gap-4 py-4">
                                    <div className="min-w-0">
                                        <h4 className="truncate font-semibold">{draft.title || "Untitled draft"}</h4>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                                            {draft.document_type && <span>{draft.document_type}</span>}
                                            {draft.tracking_number && <span>Tracking no. {draft.tracking_number}</span>}
                                            {draft.office && <span>{draft.office}</span>}
                                            {draft.created_at && <time dateTime={draft.created_at}>{new Date(draft.created_at).toLocaleDateString()}</time>}
                                        </div>
                                        <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                            Draft
                                        </span>
                                    </div>
                                    {draft.source === "generation" ? (
                                        <Link
                                            href={route("document-creation.index", { edit_draft_id: draft.id })}
                                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary"
                                        >
                                            <Pencil size={16} aria-hidden="true" />
                                            Continue editing
                                        </Link>
                                    ) : (
                                        <Link
                                            href={route("documents.index", {
                                                status: "all",
                                                edit_draft_id: draft.id,
                                            })}
                                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-primary hover:bg-secondary"
                                        >
                                            <Pencil size={16} aria-hidden="true" />
                                            Continue editing
                                        </Link>
                                    )}
                                </article>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-5 py-4 text-sm text-muted">
                        <span>{pagination.total} drafts | {pagination.per_page} per page</span>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                disabled={pagination.current_page <= 1}
                                onClick={() => visit({ page: pagination.current_page - 1 })}
                                className="dots-button-secondary"
                            >
                                Previous
                            </button>
                            <span>Page {pagination.current_page} of {pagination.last_page}</span>
                            <button
                                type="button"
                                disabled={pagination.current_page >= pagination.last_page}
                                onClick={() => visit({ page: pagination.current_page + 1 })}
                                className="dots-button-secondary"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
