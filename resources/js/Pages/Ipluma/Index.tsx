import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, Eye, FileText, Files, Printer, Search, X, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type SigningTrail = {
    step: number;
    name: string;
    email: string;
    signedAt: string;
    declined: boolean;
    remarks: string | null;
};

type DocumentRow = {
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
        SIGNED: 'bg-emerald-100 text-emerald-800',
        'IN PROGRESS': 'bg-sky-100 text-sky-800',
        DECLINED: 'bg-rose-100 text-rose-800',
        UPLOADED: 'bg-amber-100 text-amber-800',
    };

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                map[status.toUpperCase()] ?? 'bg-slate-100 text-slate-700'
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

const renderSignerSummary = (doc: DocumentRow) => {
    if (!doc.signingTrails || doc.signingTrails.length === 0) {
        return (
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    —
                </span>
                <span>No signers</span>
            </div>
        );
    }

    const limited = doc.signingTrails.slice(0, 3);

    return (
        <div className="flex flex-col gap-1.5">
            {limited.map((trail) => {
                const isDeclined = trail.declined;
                const hasSigned =
                    trail.signedAt && trail.signedAt !== 'Pending' && trail.signedAt !== 'N/A';

                const statusConfig = isDeclined
                    ? {
                          icon: XCircle,
                          color: 'bg-rose-100 text-rose-700',
                          label: 'Declined',
                      }
                    : hasSigned
                        ? {
                              icon: CheckCircle2,
                              color: 'bg-emerald-100 text-emerald-700',
                              label: 'Signed',
                          }
                        : {
                              icon: Clock3,
                              color: 'bg-amber-100 text-amber-700',
                              label: 'Pending',
                          };
                const StatusIcon = statusConfig.icon;

                return (
                    <div
                        key={`${doc.dotsId}-${trail.step}`}
                        className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#fafaf8] px-2.5 py-2"
                    >
                        <span
                            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${statusConfig.color}`}
                        >
                            <StatusIcon size={14} aria-label={statusConfig.label} />
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-slate-800">
                                {trail.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                                Step {trail.step} · {trail.signedAt || 'Pending'}
                            </div>
                        </div>
                    </div>
                );
            })}

            {doc.signingTrails.length > 3 && (
                <div className="text-[11px] font-medium text-slate-500">
                    +{doc.signingTrails.length - 3} more
                </div>
            )}
        </div>
    );
};

export default function IplumaIndex({ documents = [] }: { documents?: DocumentRow[] }) {
    const [selected, setSelected] = useState<DocumentRow | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('ALL');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

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
                doc.originatorName.toLowerCase().includes(search.toLowerCase());

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
        { label: 'Total Documents', value: summary.total, detail: 'Files shared through iPLuma', icon: Files, tone: 'border-blue-200 bg-blue-50', iconTone: 'bg-blue-100 text-blue-700', valueTone: 'text-slate-900' },
        { label: 'Signed', value: summary.signed, detail: 'Completed signature requests', icon: CheckCircle2, tone: 'border-emerald-200 bg-emerald-50', iconTone: 'bg-emerald-100 text-emerald-700', valueTone: 'text-emerald-800' },
        { label: 'In Progress', value: summary.inProgress, detail: 'Awaiting signer action', icon: Clock3, tone: 'border-sky-200 bg-sky-50', iconTone: 'bg-sky-100 text-sky-700', valueTone: 'text-sky-800' },
        { label: 'Declined', value: summary.declined, detail: 'Declined signature requests', icon: XCircle, tone: 'border-rose-200 bg-rose-50', iconTone: 'bg-rose-100 text-rose-700', valueTone: 'text-rose-800' },
    ];

    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Integrations</p><h1 className="text-2xl font-bold text-[#171717] sm:text-3xl">iPLuma</h1></div>}
        >
            <Head title="iPLuma" />

            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-table-only, .print-table-only * { visibility: visible !important; }
                    .print-table-only { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
                    .no-print { display: none !important; }
                    table { width: 100% !important; }
                    th, td { font-size: 11px !important; }
                }
            `}</style>

            <div className="mx-auto max-w-[1440px]">
                <section aria-label="iPLuma document summary" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 no-print">
                    {cards.map(({ label, value, detail, icon: Icon, tone, iconTone, valueTone }) => (
                        <article key={label} className={`flex min-h-[158px] flex-col rounded-2xl border px-5 py-5 shadow-sm ${tone}`}>
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
                                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
                                    <Icon size={20} strokeWidth={2} aria-hidden="true" />
                                </span>
                            </div>
                            <p className={`mt-auto pt-3 text-3xl font-bold leading-none ${valueTone}`}>{value.toLocaleString()}</p>
                            <p className="mt-2 text-xs leading-5 text-slate-600">{detail}</p>
                        </article>
                    ))}
                </section>

                <section className="overflow-hidden rounded-2xl border border-[#e2e2df] bg-white shadow-sm print-table-only" aria-labelledby="ipluma-register-title">
                    <div className="border-b border-[#e2e2df] px-5 py-5 sm:px-6">
                        <div className="mb-4">
                            <h2 id="ipluma-register-title" className="text-lg font-semibold text-[#171717]">iPLuma document register</h2>
                            <p className="mt-1 text-sm text-[#73736e]">Review shared files and signature progress.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] no-print">
                            <label className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#deded9] bg-[#fafaf8] px-3 text-[#898984] focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:col-span-1">
                                <Search size={18} aria-hidden="true" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Search DOTS ID, file, or originator"
                                    aria-label="Search iPLuma documents"
                                    className="w-full border-0 bg-transparent px-0 py-2.5 text-sm text-[#171717] placeholder:text-[#898984] focus:ring-0"
                                />
                            </label>
                            <select
                                value={status}
                                onChange={(event) => setStatus(event.target.value)}
                                aria-label="Filter by signature status"
                                className="col-span-2 h-11 min-w-0 rounded-xl border border-[#deded9] bg-[#fafaf8] pl-3 pr-8 text-sm text-[#333] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:col-span-1"
                            >
                                <option value="ALL">All Status</option>
                                <option value="SIGNED">Signed</option>
                                <option value="IN PROGRESS">In Progress</option>
                                <option value="DECLINED">Declined</option>
                                <option value="UPLOADED">Uploaded</option>
                            </select>
                            <button
                                type="button"
                                onClick={handlePrint}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#deded9] bg-white px-4 text-sm font-semibold text-[#444] transition hover:bg-[#f6f6f3]"
                            >
                                <Printer size={17} aria-hidden="true" />
                                Print
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 border-b border-[#e8e8e4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <h3 className="font-semibold text-[#171717]">Documents</h3>
                        <p className="text-sm text-[#73736e]">
                            {filteredDocuments.length === 0 ? 'No results' : `Showing ${((page - 1) * perPage) + 1}–${Math.min(page * perPage, filteredDocuments.length)} of ${filteredDocuments.length} documents`}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-[#f7f8fa] text-[#555752]">
                                <tr>
                                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">DOTS ID</th>
                                    <th scope="col" className="min-w-[190px] px-4 py-3.5 font-semibold">File Name</th>
                                    <th scope="col" className="min-w-[180px] px-4 py-3.5 font-semibold">Originator</th>
                                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Uploaded At</th>
                                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Shared At</th>
                                    <th scope="col" className="min-w-[200px] px-4 py-3.5 font-semibold">Signers</th>
                                    <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
                                    <th scope="col" className="px-4 py-3.5 font-semibold no-print">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDocuments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-[#73736e]">
                                            {search || status !== 'ALL' ? 'No iPLuma documents match these filters.' : 'No iPLuma data available.'}
                                        </td>
                                    </tr>
                                ) : paginatedDocuments.map((doc) => (
                                    <tr key={doc.dotsId} className="border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]">
                                        <td className="whitespace-nowrap px-4 py-4 font-mono text-xs font-semibold text-slate-800">{doc.dotsId}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-start gap-2.5">
                                                {/* <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><FileText size={16} aria-hidden="true" /></span> */}
                                                <div className="min-w-0">
                                                    <p className="break-words font-medium text-[#242424]">{doc.fileName}</p>
                                                    {/* <p className="mt-0.5 text-xs text-[#73736e]">{doc.fileType || 'Document'}</p> */}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <p className="font-medium text-slate-800">{doc.originatorName}</p>
                                            <p className="mt-0.5 break-all text-xs text-[#73736e]">{doc.originatorEmail}</p>
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-4 text-[#666660]">{doc.uploadedAt || '—'}</td>
                                        <td className="whitespace-nowrap px-4 py-4 text-[#666660]">{doc.sharedAt || '—'}</td>
                                        <td className="px-4 py-3 align-top">{renderSignerSummary(doc)}</td>
                                        <td className="whitespace-nowrap px-4 py-4">{statusBadge(doc.status)}</td>
                                        <td className="px-4 py-4 no-print">
                                            <button
                                                type="button"
                                                onClick={() => setSelected(doc)}
                                                aria-label={`View signing details for ${doc.dotsId}`}
                                                title="View signing details"
                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                                            >
                                                <Eye size={17} aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-[#e8e8e4] bg-[#fafaf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
                        <label className="flex items-center gap-2 text-sm text-[#666660]">
                            <span>Rows per page</span>
                            <select value={perPage} onChange={(event) => setPerPage(Number(event.target.value))} className="rounded-lg border border-[#deded9] bg-white py-1.5 pl-2 pr-8 text-sm">
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </label>
                        <div className="flex items-center gap-2">
                            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="inline-flex items-center gap-1 rounded-lg border border-[#deded9] bg-white px-3 py-1.5 text-sm text-[#444] transition hover:bg-[#f3f4f5] disabled:cursor-not-allowed disabled:opacity-50">
                                <ChevronLeft size={16} aria-hidden="true" /> Previous
                            </button>
                            <span className="px-1 text-sm text-[#666660]">Page {page} of {totalPages}</span>
                            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))} className="inline-flex items-center gap-1 rounded-lg border border-[#deded9] bg-white px-3 py-1.5 text-sm text-[#444] transition hover:bg-[#f3f4f5] disabled:cursor-not-allowed disabled:opacity-50">
                                Next <ChevronRight size={16} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4 no-print" onClick={() => setSelected(null)}>
                    <section role="dialog" aria-modal="true" aria-labelledby="ipluma-details-title" className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e8e4] bg-white px-5 py-4 sm:px-6">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileText size={20} aria-hidden="true" /></span>
                                <div className="min-w-0">
                                    <h2 id="ipluma-details-title" className="text-lg font-semibold text-[#171717]">Signing details</h2>
                                    <p className="mt-0.5 break-words text-sm text-[#73736e]">{selected.dotsId} · {selected.fileName}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setSelected(null)} aria-label="Close signing details" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                <X size={19} />
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            <section aria-label="Document details" className="grid gap-4 rounded-xl border border-[#e8e8e4] bg-[#fafaf8] p-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Originator</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{selected.originatorName}</p><p className="mt-0.5 break-all text-xs text-[#73736e]">{selected.originatorEmail}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">File type</p><p className="mt-1 text-sm font-medium text-slate-800">{selected.fileType || 'Document'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Status</p><div className="mt-1">{statusBadge(selected.status)}</div></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Uploaded</p><p className="mt-1 text-sm text-slate-700">{selected.uploadedAt || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Shared</p><p className="mt-1 text-sm text-slate-700">{selected.sharedAt || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Signers</p><p className="mt-1 text-sm text-slate-700">{selected.signingTrails.length}</p></div>
                            </section>

                            <section aria-labelledby="signing-trails-title">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div><h3 id="signing-trails-title" className="font-semibold text-[#171717]">Signing trail</h3><p className="mt-0.5 text-sm text-[#73736e]">Signer actions in workflow order.</p></div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{selected.signingTrails.length} steps</span>
                                </div>
                                {selected.signingTrails.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-[#deded9] px-4 py-8 text-center text-sm text-[#73736e]">No signing trail is available for this document.</p>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-[#e2e2df]">
                                        <table className="min-w-full text-left text-sm">
                                            <thead className="bg-[#f7f8fa] text-[#555752]"><tr><th scope="col" className="px-3 py-3 font-semibold">Step</th><th scope="col" className="px-3 py-3 font-semibold">Signer</th><th scope="col" className="px-3 py-3 font-semibold">Email</th><th scope="col" className="whitespace-nowrap px-3 py-3 font-semibold">Signed At</th><th scope="col" className="px-3 py-3 font-semibold">Status</th><th scope="col" className="px-3 py-3 font-semibold">Remarks</th></tr></thead>
                                            <tbody>
                                                {selected.signingTrails.map((trail) => {
                                                    const isPending = !trail.declined && (!trail.signedAt || trail.signedAt === 'Pending' || trail.signedAt === 'N/A');
                                                    const TrailIcon = trail.declined ? XCircle : isPending ? Clock3 : CheckCircle2;
                                                    const trailTone = trail.declined ? 'bg-rose-100 text-rose-800' : isPending ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800';
                                                    const trailLabel = trail.declined ? 'Declined' : isPending ? 'Pending' : 'Signed';

                                                    return (
                                                        <tr key={`${selected.dotsId}-${trail.step}`} className="border-t border-[#eeeeeb] align-top">
                                                            <td className="px-3 py-3 font-medium text-slate-700">{trail.step}</td>
                                                            <td className="px-3 py-3 font-medium text-slate-800">{trail.name}</td>
                                                            <td className="max-w-[220px] break-all px-3 py-3 text-slate-600">{trail.email}</td>
                                                            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{trail.signedAt || '—'}</td>
                                                            <td className="px-3 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${trailTone}`}><TrailIcon size={13} aria-hidden="true" />{trailLabel}</span></td>
                                                            <td className="min-w-[160px] whitespace-pre-wrap px-3 py-3 text-slate-600">{trail.remarks || '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </div>
                    </section>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
