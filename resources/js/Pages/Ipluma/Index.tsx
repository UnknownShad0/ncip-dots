import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
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
        SIGNED: 'bg-emerald-100 text-emerald-700',
        'IN PROGRESS': 'bg-sky-100 text-sky-700',
        DECLINED: 'bg-rose-100 text-rose-700',
        UPLOADED: 'bg-amber-100 text-amber-700',
    };

    return (
        <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                map[status] ?? 'bg-slate-100 text-slate-600'
            }`}
        >
            {status}
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
                          icon: '✕',
                          color: 'bg-rose-100 text-rose-700',
                          label: 'Declined',
                      }
                    : hasSigned
                        ? {
                              icon: '✓',
                              color: 'bg-emerald-100 text-emerald-700',
                              label: 'Signed',
                          }
                        : {
                              icon: '•',
                              color: 'bg-amber-100 text-amber-700',
                              label: 'Pending',
                          };

                return (
                    <div
                        key={`${doc.dotsId}-${trail.step}`}
                        className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                    >
                        <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${statusConfig.color}`}
                        >
                            {statusConfig.icon}
                        </span>

                        <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-medium text-slate-800">
                                {trail.name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                                Step {trail.step} • {trail.signedAt || 'Pending'}
                            </div>
                        </div>
                    </div>
                );
            })}

            {doc.signingTrails.length > 3 && (
                <div className="text-[10px] font-medium text-slate-500">
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

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">iPLuma – DOTS Summary</h2>}
        >
            <Head title="iPLuma" />

            <style>{`
                @media print {
                    body * {
                        visibility: hidden !important;
                    }

                    .print-table-only,
                    .print-table-only * {
                        visibility: visible !important;
                    }

                    .print-table-only {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 0;
                        margin: 0;
                    }

                    .no-print {
                        display: none !important;
                    }

                    table {
                        width: 100% !important;
                    }

                    th, td {
                        font-size: 11px !important;
                    }
                }
            `}</style>

            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 no-print">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Total Documents
                        </div>
                        <div className="mt-3 text-3xl font-bold text-slate-800">{summary.total}</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Signed
                        </div>
                        <div className="mt-3 text-3xl font-bold text-emerald-600">{summary.signed}</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            In Progress
                        </div>
                        <div className="mt-3 text-3xl font-bold text-sky-600">{summary.inProgress}</div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Declined
                        </div>
                        <div className="mt-3 text-3xl font-bold text-rose-600">{summary.declined}</div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white shadow-sm print-table-only">
                    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between no-print">
                        <h3 className="text-lg font-semibold text-slate-800">iPLuma Documents</h3>

                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by DOTS ID / file / originator"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                            />

                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
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
                                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                            >
                                Print
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                    <th className="px-4 py-3">DOTS ID</th>
                                    <th className="px-4 py-3">File Name</th>
                                    <th className="px-4 py-3">Originator</th>
                                    <th className="px-4 py-3">Uploaded At</th>
                                    <th className="px-4 py-3">Shared At</th>
                                    <th className="px-4 py-3">Signers</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 no-print">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {paginatedDocuments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                                            No iPLuma data available.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedDocuments.map((doc) => (
                                        <tr key={doc.dotsId} className="border-t border-slate-200">
                                            <td className="px-4 py-3 font-semibold text-slate-800">{doc.dotsId}</td>
                                            <td className="px-4 py-3 text-slate-700">{doc.fileName}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-800">{doc.originatorName}</div>
                                                <div className="text-xs text-slate-500">{doc.originatorEmail}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{doc.uploadedAt}</td>
                                            <td className="px-4 py-3 text-slate-600">{doc.sharedAt}</td>
                                            <td className="px-4 py-3 align-top text-slate-600">
                                                {renderSignerSummary(doc)}
                                            </td>
                                            <td className="px-4 py-3">{statusBadge(doc.status)}</td>
                                            <td className="px-4 py-3 no-print">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelected(doc)}
                                                    className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between no-print">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span>Rows per page:</span>
                            <select
                                value={perPage}
                                onChange={(e) => {
                                    setPerPage(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page === 1}
                                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>

                            <span className="text-sm text-slate-600">
                                Page {page} of {totalPages}
                            </span>

                            <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 no-print">
                    <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Signing Trails</h3>
                                <p className="text-sm text-slate-500">
                                    {selected.dotsId} • {selected.fileName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-auto p-6">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="px-3 py-2">Step</th>
                                        <th className="px-3 py-2">Signer</th>
                                        <th className="px-3 py-2">Email</th>
                                        <th className="px-3 py-2">Signed At</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selected.signingTrails.map((trail) => (
                                        <tr
                                            key={`${selected.dotsId}-${trail.step}`}
                                            className="border-t border-slate-200"
                                        >
                                            <td className="px-3 py-2">{trail.step}</td>
                                            <td className="px-3 py-2">{trail.name}</td>
                                            <td className="px-3 py-2 text-slate-600">{trail.email}</td>
                                            <td className="px-3 py-2 text-slate-600">{trail.signedAt}</td>
                                            <td className="px-3 py-2">
                                                {trail.declined ? (
                                                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                                                        Declined
                                                    </span>
                                                ) : trail.signedAt === 'Pending' ? (
                                                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                                        Pending
                                                    </span>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                                        Signed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">{trail.remarks ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
