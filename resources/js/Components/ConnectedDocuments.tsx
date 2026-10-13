import ConnectedSystemsLayout from '@/Layouts/ConnectedSystemsLayout';
import WorkspaceDialog from './WorkspaceDialog';
import InfoTip from './InfoTip';
import { Head, router } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, FileText, Files, Printer, Search, X, XCircle, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type SigningTrail = {
    step: number;
    name: string;
    email: string;
    signedAt: string;
    declined: boolean;
    remarks: string | null;
};

export type ConnectedDocument = {
    dotsId: string;
    fileName: string;
    fileType: string;
    originatorName: string;
    originatorEmail: string;
    uploadedAt: string;
    sharedAt: string;
    signers: string;
    status: string;
    signingTrails: SigningTrail[];
};

function statusBadge(status: string) {
    const map: Record<string, string> = {
        SIGNED: 'bg-success-soft text-success',
        'IN PROGRESS': 'bg-secondary text-primary',
        DECLINED: 'bg-danger-soft text-danger',
        UPLOADED: 'bg-warning-soft text-warning',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                map[status.toUpperCase()] ?? 'bg-slate-100 text-foreground'
            }`}
        >
            {status.toUpperCase()}
        </span>
    );
}

const toEpoch = (value?: string) => {
    const time = new Date(value ?? '').getTime();
    return Number.isNaN(time) ? 0 : time;
};

const renderSignerSummary = (doc: ConnectedDocument) => {
    const trails = doc.signingTrails ?? [];
    if (!trails.length) return <span className="text-xs text-muted">No signers</span>;
    const signed = trails.filter((trail) => !trail.declined && trail.signedAt && !['Pending', 'N/A'].includes(trail.signedAt)).length;
    const declined = trails.filter((trail) => trail.declined).length;
    return <div className="text-xs"><p className="whitespace-nowrap font-medium">{signed} of {trails.length} signed</p>{declined > 0 && <p className="mt-1 text-danger">{declined} declined</p>}</div>;
};

export default function ConnectedDocuments({ documents = [], system }: { documents?: ConnectedDocument[]; system: string }) {
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');
    const refresh = () => {
        if (loading) return;
        setLoading(true);
        setLoadError('');
        router.reload({ only: ['documents'], onFinish: () => setLoading(false), onError: () => setLoadError('Could not reload this page. Please try again.') });
    };
    const [selected, setSelected] = useState<ConnectedDocument | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('ALL');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);

    const handlePrint = () => {
        window.print();
    };

    const orderedDocuments = useMemo(() => {
        return [...documents].sort((a, b) => {
            const dateA = toEpoch(a.sharedAt || a.uploadedAt);
            const dateB = toEpoch(b.sharedAt || b.uploadedAt);

            return dateB - dateA; // newest first
        });
    }, [documents]);

    const filteredDocuments = useMemo(() => {
        return orderedDocuments.filter((doc) => {
            const matchesSearch =
                !search ||
                doc.dotsId.toLowerCase().includes(search.toLowerCase()) ||
                doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
                doc.originatorName.toLowerCase().includes(search.toLowerCase()) ||
                doc.originatorEmail.toLowerCase().includes(search.toLowerCase()) ||
                doc.signers.toLowerCase().includes(search.toLowerCase());

            const matchesStatus =
                status === 'ALL' || doc.status.toUpperCase() === status;

            return matchesSearch && matchesStatus;
        });
    }, [orderedDocuments, search, status]);

    const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / perPage));

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    useEffect(() => {
        setPage(1);
    }, [search, status, perPage]);

    const paginatedDocuments = filteredDocuments.slice(
        (page - 1) * perPage,
        page * perPage
    );

    const summary = {
        total: documents.length,
        signed: documents.filter((d) => d.status === 'SIGNED').length,
        inProgress: documents.filter((d) => d.status === 'IN PROGRESS').length,
        declined: documents.filter((d) => d.status === 'DECLINED').length,
    };

    const cards = [
        { label: 'Shared documents', value: summary.total },
        { label: 'Signed', value: summary.signed },
        { label: 'In progress', value: summary.inProgress },
        { label: 'Declined', value: summary.declined },
    ];

    return (
        <ConnectedSystemsLayout>
            <Head title={system} />

            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-table-only, .print-table-only * { visibility: visible !important; }
                    .print-table-only { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
                    .no-print { display: none !important; }
                    table { width: 100% !important; }
                    th, td { font-size: 14px !important; }
                }
            `}</style>

            <div className="mx-auto max-w-[1440px]">
                <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><h2 className="text-lg font-semibold">{system}</h2><span className="rounded-md bg-secondary px-2 py-1 text-xs text-primary">Read only</span><InfoTip label="About document summaries">Counts reflect the records returned by {system}, before search and status filters. Select a document to see its signing history.</InfoTip></div>
                    <button type="button" onClick={refresh} disabled={loading} className="dots-button-secondary"><RefreshCw size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>
                </div>
                {loadError && <p role="alert" className="mb-4 rounded-lg bg-danger-soft p-3 text-sm text-danger">{loadError}</p>}
                <p role="status" className="sr-only">{loading ? 'Refreshing shared documents' : ''}</p>
                <section aria-label="Shared document summary" className="no-print mb-5 grid grid-cols-2 divide-x divide-border rounded-xl border border-border bg-surface sm:grid-cols-4">
                    {cards.map(({ label, value }) => <article key={label} className="p-4"><h3 className="text-xs font-medium text-muted">{label}</h3><p className="mt-2 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p></article>)}
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm print-table-only" aria-busy={loading} aria-labelledby="connected-register-title">
                    <div className="border-b border-border px-5 py-5 sm:px-6">
                        <div className="mb-4">
                            <h2 id="connected-register-title" className="text-lg font-semibold text-foreground">Shared documents</h2>
                            <p className="mt-1 text-sm text-muted">Review shared files and signature progress.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] no-print">
                            <label className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:col-span-1">
                                <Search size={18} aria-hidden="true" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search DOTS ID, file, or originator"
                                    aria-label={`Search ${system} documents`}
                                    className="w-full border-0 bg-transparent px-0 py-2.5 text-sm text-foreground placeholder:text-muted focus:ring-0"
                                />
                            </label>
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                aria-label="Filter by signature status"
                                className="col-span-2 h-11 min-w-0 rounded-xl border border-border bg-background pl-3 pr-8 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:col-span-1"
                            >
                                <option value="ALL">All statuses</option>
                                <option value="SIGNED">Signed</option>
                                <option value="IN PROGRESS">In Progress</option>
                                <option value="DECLINED">Declined</option>
                                <option value="UPLOADED">Uploaded</option>
                            </select>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
                            >
                                <Printer size={17} aria-hidden="true" />
                                Print
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <h3 className="font-semibold text-foreground">Documents</h3>
                        <p className="text-sm text-muted">
                            {filteredDocuments.length === 0 ? 'No results' : `Showing ${((page - 1) * perPage) + 1}–${Math.min(page * perPage, filteredDocuments.length)} of ${filteredDocuments.length} documents`}
                        </p>
                    </div>

                    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Shared documents table">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-background text-muted">
                                <tr>
                                    
                                    <th scope="col" className="min-w-[190px] px-4 py-3.5 font-semibold">Document</th>
                                    <th scope="col" className="min-w-[180px] px-4 py-3.5 font-semibold">Originator</th>
                                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Uploaded At</th>
                                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Shared At</th>
                                    <th scope="col" className="min-w-[120px] px-4 py-3.5 font-semibold">Signers</th>
                                    <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
                                    <th scope="col" className="px-4 py-3.5 font-semibold no-print">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDocuments.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-muted">
                                            {search || status !== 'ALL' ? `No ${system} documents match these filters.` : `No shared records available from ${system}.`}
                                        </td>
                                    </tr>
                                ) : paginatedDocuments.map((doc) => (
                                    <tr key={doc.dotsId} className="border-t border-border transition-colors hover:bg-background">
                                        
                                        <td className="px-4 py-4">
                                            <div className="flex items-start gap-2.5">
                                                {/* <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary"><FileText size={16} aria-hidden="true" /></span> */}
                                                <div className="min-w-0">
                                                    <button type="button" onClick={() => setSelected(doc)} className="break-words text-left font-semibold text-foreground hover:text-primary hover:underline">{doc.fileName}</button><p className="mt-1 font-mono text-xs text-muted">{doc.dotsId}</p>
                                                    {/* <p className="mt-0.5 text-xs text-muted">{doc.fileType || 'Document'}</p> */}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-medium text-foreground">{doc.originatorName}</p>
                                            <p className="mt-1 break-all text-xs text-muted">{doc.originatorEmail}</p>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-muted">{doc.uploadedAt || '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-muted">{doc.sharedAt || '—'}</td>
                                        <td className="px-4 py-3 align-top">{renderSignerSummary(doc)}</td>
                                        <td className="whitespace-nowrap px-4 py-4">{statusBadge(doc.status)}</td>
                                        <td className="px-4 py-4 no-print">
                                            <button
                                                type="button"
                                                onClick={() => setSelected(doc)}
                                                aria-label={`View signing details for ${doc.dotsId}`}
                                                title="View signing details"
                                                className="dots-button-secondary gap-1.5 px-3 text-primary"
                                            >
                                                <Eye size={16} aria-hidden="true" /> Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
                        <label className="flex items-center gap-2 text-sm text-muted">
                            <span>Rows per page</span>
                            <select value={perPage} onChange={(event) => setPerPage(Number(event.target.value))} className="rounded-lg border border-border bg-surface py-1.5 pl-2 pr-8 text-sm">
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </label>
                        <div className="flex items-center gap-2">
                            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
                                <ChevronLeft size={16} aria-hidden="true" /> Previous
                            </button>
                            <span className="px-1 text-sm text-muted">Page {page} of {totalPages}</span>
                            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">
                                Next <ChevronRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <WorkspaceDialog open={Boolean(selected)} onClose={() => setSelected(null)} labelledBy="connected-details-title" width="max-w-5xl">
                {selected && (<section>
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><FileText size={20} aria-hidden="true" /></span>
                                <div className="min-w-0">
                                    <h2 id="connected-details-title" className="text-lg font-semibold text-foreground">Signing details</h2>
                                    <p className="mt-1 break-words text-sm text-muted">{selected.dotsId} · {selected.fileName}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelected(null)} aria-label="Close signing details" className="rounded-md p-2 text-muted hover:bg-slate-100 hover:text-foreground">
                                <X size={19} />
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            <section aria-label="Document details" className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div><p className="text-xs font-semibold uppercase text-muted">Originator</p><p className="mt-1 break-words text-sm font-medium text-foreground">{selected.originatorName}</p><p className="mt-1 break-all text-xs text-muted">{selected.originatorEmail}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-muted">File type</p><p className="mt-1 text-sm font-medium text-foreground">{selected.fileType || 'Document'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-muted">Status</p><div className="mt-1">{statusBadge(selected.status)}</div></div>
                                <div><p className="text-xs font-semibold uppercase text-muted">Uploaded</p><p className="mt-1 text-sm text-foreground">{selected.uploadedAt || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-muted">Shared</p><p className="mt-1 text-sm text-foreground">{selected.sharedAt || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-muted">Signers</p><p className="mt-1 text-sm text-foreground">{selected.signingTrails.length}</p></div>
                            </section>

                            <section aria-labelledby="signing-trails-title">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div><h3 id="signing-trails-title" className="font-semibold text-foreground">Signing trail</h3><p className="mt-1 text-sm text-muted">Signer actions in workflow order.</p></div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-muted">{selected.signingTrails.length} steps</span>
                                </div>
                                {selected.signingTrails.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No signing trail is available for this document.</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-border">
                                        <table className="min-w-full text-left text-sm">
                                            <thead className="bg-background text-muted"><tr><th scope="col" className="px-3 py-3 font-semibold">Step</th><th scope="col" className="px-3 py-3 font-semibold">Signer</th><th scope="col" className="px-3 py-3 font-semibold">Email</th><th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">Signed At</th><th scope="col" className="px-3 py-3 font-semibold">Status</th><th scope="col" className="px-3 py-3 font-semibold">Remarks</th></tr></thead>
                                            <tbody>
                                                {selected.signingTrails.map((trail) => {
                                                    const isPending = !trail.declined && (!trail.signedAt || trail.signedAt === 'Pending' || trail.signedAt === 'N/A');
                                                    const TrailIcon = trail.declined ? XCircle : isPending ? Clock3 : CheckCircle2;
                                                    const trailTone = trail.declined ? 'bg-danger-soft text-danger' : isPending ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success';
                                                    const trailLabel = trail.declined ? 'Declined' : isPending ? 'Pending' : 'Signed';

                                                    return (
                                                        <tr key={`${selected.dotsId}-${trail.step}`} className="border-t border-border align-top">
                                                            <td className="px-3 py-3 font-medium text-foreground">{trail.step}</td>
                                                            <td className="px-3 py-3 font-medium text-foreground">{trail.name}</td>
                                                            <td className="max-w-[220px] break-all px-3 py-3 text-muted">{trail.email}</td>
                                                            <td className="whitespace-nowrap px-3 py-3 text-muted">{trail.signedAt || '—'}</td>
                                                            <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${trailTone}`}><TrailIcon size={13} aria-hidden="true" />{trailLabel}</span></td>
                                                            <td className="min-w-[160px] whitespace-pre-wrap px-3 py-3 text-muted">{trail.remarks || '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </div>
                    </section>)}
            </WorkspaceDialog>
        </ConnectedSystemsLayout>
    );
}
