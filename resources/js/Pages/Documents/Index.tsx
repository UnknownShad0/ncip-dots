import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { ArrowDownUp, ChevronLeft, ChevronRight, FilePlus2, Printer, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type DocumentItem = {
    id?: number | string | null;
    tracking_number?: string;
    title?: string;
    status?: string;
    office_name?: string;
    document_type?: string | { name?: string } | null;
    documentType?: { name?: string } | null;
    origin_type?: string;
    last_transaction?: string;
    office?: {
        name?: string;
    } | null;
    remarks?: string;
    source?: string;
    document_type_id?: number | null;
    action_type_id?: number | null;
    purpose_type_id?: number | null;
    office_id?: number | null;
    received_from?: string | null;
};

type LibraryOption = { id: number | string; name: string; source?: string };

type SortKey = 'tracking_number' | 'title' | 'document_type' | 'origin_type' | 'status' | 'office_name' | 'last_transaction';

const getDocumentTypeName = (document: DocumentItem): string => {
    const type = document.document_type ?? document.documentType;
    return typeof type === 'string' ? type : type?.name ?? '';
};

const getStatusClasses = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();

    switch (normalized) {
        case 'approved':
        case 'completed':
        case 'released':
        case 'processed':
        case 'available':
        case 'done':
            return 'bg-emerald-100 text-emerald-700';
        case 'pending':
            return 'bg-amber-100 text-amber-700';
        case 'rejected':
        case 'cancelled':
            return 'bg-rose-100 text-rose-700';
        case 'archived':
        case 'terminal':
            return 'bg-violet-100 text-violet-700';
        default:
            return 'bg-slate-100 text-slate-700';
    }
};

export default function DocumentsIndex({
    documents = [],
    title = 'All Documents',
    documentTypes = [],
    actionTypes = [],
    purposeTypes = [],
    offices = [],
}: {
    documents?: DocumentItem[];
    title?: string;
    documentTypes?: LibraryOption[];
    actionTypes?: LibraryOption[];
    purposeTypes?: LibraryOption[];
    offices?: LibraryOption[];
}) {
    const [editingRow, setEditingRow] = useState<DocumentItem | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortKey, setSortKey] = useState<SortKey>('title');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [form, setForm] = useState({
        title: '',
        tracking_number: '',
        status: 'pending',
        origin_type: '',
        remarks: '',
        document_type_id: '',
        action_type_id: '',
        purpose_type_id: '',
        office_id: '',
        received_from: '',
    });

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm({
            title: '',
            tracking_number: '',
            status: 'pending',
            origin_type: '',
            remarks: '',
            document_type_id: '',
            action_type_id: '',
            purpose_type_id: '',
            office_id: '',
            received_from: '',
        });
    };

    const openEdit = (row: DocumentItem) => {
        if (row.source === 'Old DB') {
            return;
        }

        setEditingRow(row);
        setForm({
            title: row.title ?? '',
            tracking_number: row.tracking_number ?? '',
            status: row.status ?? 'pending',
            origin_type: row.origin_type ?? '',
            remarks: row.remarks ?? '',
            document_type_id: row.document_type_id ? String(row.document_type_id) : '',
            action_type_id: row.action_type_id ? String(row.action_type_id) : '',
            purpose_type_id: row.purpose_type_id ? String(row.purpose_type_id) : '',
            office_id: row.office_id ? String(row.office_id) : '',
            received_from: row.received_from ?? '',
        });
    };

    const openCreate = () => {
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            title: '',
            tracking_number: '',
            status: 'pending',
            origin_type: '',
            remarks: '',
            document_type_id: '',
            action_type_id: '',
            purpose_type_id: '',
            office_id: '',
            received_from: '',
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        router.post('/documents', {
            ...form,
        }, {
            onSuccess: closeModal,
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRow || editingRow.id == null) {
            return;
        }

        router.put(`/documents/${editingRow.id}`, {
            ...form,
        }, {
            onSuccess: closeModal,
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortKey(key);
        setSortDirection('asc');
    };

    const sortedDocuments = useMemo(() => {
        const filtered = documents.filter((row) => {
            const haystack = [
                row.title ?? '',
                row.tracking_number ?? '',
                row.status ?? '',
                getDocumentTypeName(row),
                row.origin_type ?? '',
                row.last_transaction ?? '',
                row.office_name ?? '',
                row.office?.name ?? '',
            ]
                .join(' ')
                .toLowerCase();

            const matchesSearch = haystack.includes(search.toLowerCase());
            const normalizedStatus = (row.status ?? '').toLowerCase();
            const matchesStatus = statusFilter === 'all' ||
                normalizedStatus === statusFilter.toLowerCase() ||
                (statusFilter === 'released' && ['processed', 'available'].includes(normalizedStatus)) ||
                (statusFilter === 'archived' && normalizedStatus === 'terminal');

            return matchesSearch && matchesStatus;
        });

        return [...filtered].sort((a, b) => {
            const valueA = String(sortKey === 'document_type' ? getDocumentTypeName(a) : a[sortKey] ?? '').toLowerCase();
            const valueB = String(sortKey === 'document_type' ? getDocumentTypeName(b) : b[sortKey] ?? '').toLowerCase();

            if (valueA < valueB) {
                return sortDirection === 'asc' ? -1 : 1;
            }

            if (valueA > valueB) {
                return sortDirection === 'asc' ? 1 : -1;
            }

            return 0;
        });
    }, [documents, search, statusFilter, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedDocuments.length / perPage));

    useEffect(() => {
        setPage(1);
    }, [search, statusFilter, perPage]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedDocuments = sortedDocuments.slice((page - 1) * perPage, page * perPage);

    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Document management</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">{title}</h1></div>}
        >
            <Head title={title} />

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

            <div className="mx-auto max-w-[1440px] print-table-only">
                <div className="mb-5 flex flex-col gap-5 rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm no-print sm:p-6">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-[#171717]">Document register</h2>
                        <p className="mt-1 text-sm text-[#73736e]">Search, review, and manage your documents in one place.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                        <label className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[#deded9] bg-[#fafaf8] px-3 text-[#898984] focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:col-span-1">
                            <Search size={18} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search documents"
                                aria-label="Search documents"
                                className="w-full border-0 bg-transparent px-0 py-2.5 text-sm text-[#171717] placeholder:text-[#898984] focus:ring-0"
                            />
                        </label>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filter documents by status"
                            className="col-span-2 h-11 min-w-0 rounded-xl border border-[#deded9] bg-[#fafaf8] pl-3 pr-8 text-sm text-[#333] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 sm:col-span-1"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="released">Released</option>
                            <option value="archived">Archived</option>
                            <option value="rejected">Rejected</option>
                        </select>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#deded9] bg-white px-3 text-sm font-semibold text-[#444] transition hover:bg-[#f6f6f3] sm:px-4"
                        >
                            <Printer size={17} />
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:px-4"
                        >
                            <FilePlus2 size={17} />
                            New Document
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#e2e2df] bg-white shadow-sm">
                    <div className="flex flex-col gap-1 border-b border-[#e8e8e4] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <h3 className="font-semibold text-[#171717]">Documents</h3>
                        <p className="text-sm text-[#73736e]">{sortedDocuments.length === 0 ? 'No results' : `Showing ${((page - 1) * perPage) + 1}–${Math.min(page * perPage, sortedDocuments.length)} of ${sortedDocuments.length} documents`}</p>
                    </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#f7f8fa] text-[#555752]">
                            <tr>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('tracking_number')} className="flex items-center gap-1.5 hover:text-blue-700">
                                        Tracking No. <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('title')} className="flex items-center gap-1.5 hover:text-blue-700">
                                        Title <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('document_type')} className="flex items-center gap-1.5 hover:text-blue-700">
                                        Document Type <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('origin_type')} className="flex items-center gap-1.5 hover:text-blue-700">
                                        Origin Type <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('status')} className="flex items-center gap-1.5 hover:text-blue-700">
                                        Status <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('last_transaction')} className="flex items-center gap-1.5 hover:text-blue-700">
                                        Last Transaction <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold no-print">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-[#73736e]">
                                        No documents found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedDocuments.map((document, index) => {
                                    const isLegacy = document.source === 'Old DB';

                                    return (
                                        <tr
                                            key={document.id ?? `${document.tracking_number ?? 'doc'}-${index}`}
                                            className="border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]"
                                        >
                                            <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-blue-800">
                                                <span className="font-mono">{document.tracking_number || 'N/A'}</span>
                                                {isLegacy && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[10px] font-medium text-slate-600">Legacy</span>}
                                            </td>
                                            <td className="min-w-[190px] px-4 py-4 font-medium text-[#242424]">
                                                {document.title || 'Untitled'}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-[#666660]">
                                                {getDocumentTypeName(document) || '—'}
                                            </td>
                                            <td className="px-4 py-4 text-[#666660]">
                                                {document.origin_type || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                                                        document.status
                                                    )}`}
                                                >
                                                    {document.status || 'pending'}
                                                </span>
                                            </td>
                                            <td className="min-w-[220px] px-4 py-4 text-[#666660]">
                                                {document.last_transaction || '—'}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 no-print">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(document)}
                                                    disabled={isLegacy}
                                                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                                                        isLegacy
                                                            ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                                                            : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                    }`}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-[#e8e8e4] bg-[#fafaf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
                    <div className="flex items-center gap-2 text-sm text-[#666660]">
                        <span>Rows per page:</span>
                        <select
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            className="rounded-lg border border-[#deded9] bg-white py-1.5 pl-2 pr-8 text-sm"
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
                            className="inline-flex items-center gap-1 rounded-lg border border-[#deded9] bg-white px-3 py-1.5 text-sm text-[#444] transition hover:bg-[#f3f4f5] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>

                        <span className="px-1 text-sm text-[#666660]">
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#deded9] bg-white px-3 py-1.5 text-sm text-[#444] transition hover:bg-[#f3f4f5] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
            </div>

            {(isCreateOpen || editingRow) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="document-modal-title" className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-2xl sm:p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 id="document-modal-title" className="text-lg font-semibold text-slate-800">
                                {editingRow ? 'Update Document' : 'Add Document'}
                            </h3>

                            <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700">
                                Close
                            </button>
                        </div>

                        <form onSubmit={editingRow ? handleUpdate : handleCreate} className="space-y-4">
                            {editingRow ? (
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Tracking Number</label>
                                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{editingRow.tracking_number || 'Not assigned'}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-500">A tracking number will be assigned automatically.</p>
                            )}

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <LibrarySelect label="Document Type" value={form.document_type_id} options={documentTypes} onChange={(value) => setForm({ ...form, document_type_id: value })} />
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Origin Type</label>
                                    <select value={form.origin_type} onChange={(e) => setForm({ ...form, origin_type: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="">Select origin type</option>
                                        <option value="Internal">Internal</option>
                                        <option value="External">External</option>
                                    </select>
                                </div>
                                <LibrarySelect label="Purpose" value={form.purpose_type_id} options={purposeTypes} onChange={(value) => setForm({ ...form, purpose_type_id: value })} />
                                <LibrarySelect label="Action Type" value={form.action_type_id} options={actionTypes} onChange={(value) => setForm({ ...form, action_type_id: value })} />
                                <LibrarySelect label="Office" value={form.office_id} options={offices} onChange={(value) => setForm({ ...form, office_id: value })} />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Received From</label>
                                <input
                                    value={form.received_from}
                                    onChange={(e) => setForm({ ...form, received_from: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="released">Released</option>
                                    <option value="archived">Archived</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                                <textarea
                                    value={form.remarks}
                                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                    rows={4}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                                >
                                    {editingRow ? 'Save Changes' : 'Add Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}

function LibrarySelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: LibraryOption[];
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
            <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">Select {label.toLowerCase()}</option>
                {options.map((option) => <option key={`${option.source ?? 'new'}-${option.id}`} value={option.id}>{option.name}</option>)}
            </select>
        </div>
    );
}
