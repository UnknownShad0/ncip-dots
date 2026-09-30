import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/CrudAlertModal';
import { Head, router } from '@inertiajs/react';
import { Archive, ArrowDownUp, ChevronLeft, ChevronRight, Eye, FilePlus2, FileText, Inbox, Pencil, Printer, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

type DocumentItem = {
    id?: number | string | null;
    tracking_number?: string;
    title?: string;
    status?: string;
    office_name?: string;
    document_type?: string | { name?: string } | null;
    purpose_type?: string;
    documentType?: { name?: string } | null;
    created_by_name?: string;
    file_name?: string;
    file_url?: string;
    origin_type?: string;
    last_transaction?: string;
    created_at?: string;
    transactions?: Array<{
        action?: string | null;
        status?: string | null;
        remarks?: string | null;
        from_office?: string | null;
        to_office?: string | null;
        holder?: string | null;
        created_by?: string | null;
        created_at?: string | null;
    }>;
    office?: {
        name?: string;
    } | null;
    remarks?: string;
    source?: string;
    document_type_id?: number | null;
    action_type_id?: number | null;
    other_action?: string | null;
    other_document_type?: string | null;
    other_purpose?: string | null;
    purpose_type_id?: number | null;
    urgent?: boolean | string | null;
    notify_by_email?: boolean;
    is_finalized?: boolean;
    can_update?: boolean;
    can_release?: boolean;
    can_terminal?: boolean;
    can_receive?: boolean;
    can_delete?: boolean;
};

type LibraryOption = { id: number | string; name: string; source?: string };
type ReceivingOfficeOption = LibraryOption & { office_id: number | string | null; is_selectable?: boolean };
type CrudAlert = { title: string; message: string; onConfirm?: () => void; confirmLabel?: string; isDestructive?: boolean };

type SortKey = 'tracking_number' | 'title' | 'document_type' | 'origin_type' | 'status' | 'office_name' | 'last_transaction';

const getDocumentTypeName = (document: DocumentItem): string => {
    const type = document.document_type ?? document.documentType;
    const name = typeof type === 'string' ? type : type?.name ?? '';
    return name.trim().toLowerCase() === 'others' && document.other_document_type
        ? `${name} (${document.other_document_type})`
        : name;
};

const getPurposeTypeName = (document: DocumentItem): string =>
    (document.purpose_type ?? '').trim().toLowerCase() === 'others' && document.other_purpose
        ? `Others (${document.other_purpose})`
        : document.purpose_type ?? '';

const isOtherOption = (value: string, options: LibraryOption[]) =>
    options.find((option) => String(option.id) === value)?.name.trim().toLowerCase() === 'others';

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
        case 'ongoing':
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

const getTransactionClasses = (action?: string | null, status?: string | null) => {
    const label = (action || status || '').toLowerCase();

    if (label.includes('terminal')) return 'bg-violet-100 text-violet-800';
    if (label.includes('receiv')) return 'bg-emerald-100 text-emerald-800';
    if (label.includes('finaliz')) return 'bg-blue-100 text-blue-800';
    return 'bg-sky-50 text-sky-800';
};

export default function DocumentsIndex({
    documents = [],
    title = 'All Documents',
    documentTypes = [],
    actionTypes = [],
    purposeTypes = [],
    offices = [],
    receivingOffices = [],
    maxUploadSizeKb,
}: {
    documents?: DocumentItem[];
    title?: string;
    documentTypes?: LibraryOption[];
    actionTypes?: LibraryOption[];
    purposeTypes?: LibraryOption[];
    offices?: LibraryOption[];
    receivingOffices?: ReceivingOfficeOption[];
    maxUploadSizeKb: number;
}) {
    const uploadLimitKb = Number(maxUploadSizeKb ?? 0);
    const [editingRow, setEditingRow] = useState<DocumentItem | null>(null);
    const [crudAlert, setCrudAlert] = useState<CrudAlert | null>(null);
    const [viewingRow, setViewingRow] = useState<DocumentItem | null>(null);
    const [printDocument, setPrintDocument] = useState<DocumentItem | null>(null);
    const [releasingRow, setReleasingRow] = useState<DocumentItem | null>(null);
    const [releaseForm, setReleaseForm] = useState({ actionTypeId: '', otherAction: '', officeId: '', remarks: '', file: null as File | null });
    const [releaseError, setReleaseError] = useState('');
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
        origin_type: '',
        remarks: '',
        document_type_id: '',
        other_document_type: '',
        action_type_id: '',
        other_action: '',
        purpose_type_id: '',
        other_purpose: '',
        urgent: false,
        notify_by_email: false,
        file: null as File | null,
    });

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm({
            title: '',
            tracking_number: '',
            origin_type: '',
            remarks: '',
            document_type_id: '',
            other_document_type: '',
            action_type_id: '',
            other_action: '',
            purpose_type_id: '',
            other_purpose: '',
            urgent: false,
            notify_by_email: false,
            file: null,
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
            origin_type: row.origin_type ?? '',
            remarks: row.remarks ?? '',
            document_type_id: row.document_type_id ? String(row.document_type_id) : '',
            other_document_type: row.other_document_type ?? '',
            action_type_id: row.action_type_id ? String(row.action_type_id) : '',
            other_action: row.other_action ?? '',
            purpose_type_id: row.purpose_type_id ? String(row.purpose_type_id) : '',
            other_purpose: row.other_purpose ?? '',
            urgent: Boolean(row.urgent),
            notify_by_email: Boolean(row.notify_by_email),
            file: null,
        });
    };

    const openCreate = () => {
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            title: '',
            tracking_number: '',
            origin_type: '',
            remarks: '',
            document_type_id: '',
            other_document_type: '',
            action_type_id: '',
            other_action: '',
            purpose_type_id: '',
            other_purpose: '',
            urgent: false,
            notify_by_email: false,
            file: null,
        });
    };

    const handleCreate = (e: React.FormEvent, finalize: boolean) => {
        e.preventDefault();

        const data = new FormData();
        Object.entries({ ...form, is_finalized: finalize ? '1' : '0' }).forEach(([key, value]) => {
            if (value !== null && value !== undefined) data.append(key, value instanceof File ? value : typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        });
        router.post('/documents', data, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Document saved', message: finalize ? 'Document finalized successfully.' : 'Document draft created successfully.' });
            },
        });
    };

    const handleRelease = (event: FormEvent) => {
        event.preventDefault();
        if (!releasingRow?.id) return;

        const selectedAction = actionTypes.find((action) => String(action.id) === releaseForm.actionTypeId);
        const selectedReceivingOffice = receivingOffices.find((office) => String(office.id) === releaseForm.officeId);
        const needsOtherAction = selectedAction?.name.trim().toLowerCase() === 'others';
        if (!releaseForm.actionTypeId || !selectedReceivingOffice?.office_id || (needsOtherAction && !releaseForm.otherAction.trim())) {
            setReleaseError('Complete the required fields before submitting.');
            return;
        }
        if (releaseForm.file && releaseForm.file.size > uploadLimitKb * 1024) {
            setReleaseError(`The selected file must be ${uploadLimitKb / 1024} MB or smaller.`);
            return;
        }
        if (releaseForm.file && !/\.(pdf|jpe?g|png)$/i.test(releaseForm.file.name)) {
            setReleaseError('Choose a PDF, JPG, or PNG file.');
            return;
        }

        router.post(`/documents/${releasingRow.id}/release`, {
            action_type_id: releaseForm.actionTypeId,
            other_action: needsOtherAction ? releaseForm.otherAction.trim() : '',
            to_office_id: selectedReceivingOffice.office_id,
            remarks: releaseForm.remarks,
        }, {
            onSuccess: () => {
                setReleasingRow(null);
                setReleaseForm({ actionTypeId: '', otherAction: '', officeId: '', remarks: '', file: null });
                setReleaseError('');
                setCrudAlert({ title: 'Document released', message: 'Document released successfully.' });
            },
            onError: (errors) => setReleaseError(errors.other_action ?? errors.action_type_id ?? errors.to_office_id ?? errors.remarks ?? 'Could not release this document.'),
        });
    };

    const printDisposition = (document: DocumentItem) => setPrintDocument(document);
    const handleUpdate = (e: React.FormEvent, finalize: boolean) => {
        e.preventDefault();

        if (!editingRow || editingRow.id == null) {
            return;
        }

        const data = new FormData();
        Object.entries({ ...form, is_finalized: finalize ? '1' : '0', _method: 'put' }).forEach(([key, value]) => {
            if (value !== null && value !== undefined) data.append(key, value instanceof File ? value : typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        });
        router.post(`/documents/${editingRow.id}`, data, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Document updated', message: finalize ? 'Document updated and finalized successfully.' : 'Document updated successfully.' });
            },
        });
    };

    const requestDocumentAction = (title: string, message: string, confirmLabel: string, action: () => void, isDestructive = false) => {
        setCrudAlert({ title, message, confirmLabel, isDestructive, onConfirm: action });
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
                (statusFilter === 'ongoing' && normalizedStatus === 'pending') ||
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

    useEffect(() => {
        if (!printDocument) return;

        let cancelled = false;
        const clearDispositionPrintMode = () => {
            window.document.body.classList.remove('disposition-printing');
        };
        const onAfterPrint = () => {
            clearDispositionPrintMode();
            setPrintDocument(null);
        };
        window.document.body.classList.add('disposition-printing');
        window.addEventListener('afterprint', onAfterPrint);
        const timeout = window.setTimeout(async () => {
            const printRoot = window.document.querySelector('.disposition-print-root');
            const images = Array.from(printRoot?.querySelectorAll('img') ?? []);
            await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
            if (!cancelled) window.print();
        }, 100);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
            window.removeEventListener('afterprint', onAfterPrint);
            clearDispositionPrintMode();
        };
    }, [printDocument]);

    const paginatedDocuments = sortedDocuments.slice((page - 1) * perPage, page * perPage);
    const isOtherAction = (actionTypeId: string) => actionTypes.find((action) => String(action.id) === actionTypeId)?.name.trim().toLowerCase() === 'others';

    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Document management</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">{title}</h1></div>}
        >
            <Head title={title} />
            {crudAlert && <CrudAlertModal {...crudAlert} onClose={() => setCrudAlert(null)} />}

            <style>{`
                .urgent-document-row > td,
                .urgent-document-row:hover > td {
                    background-color: rgb(255 241 242 / 90%) !important;
                }
                .urgent-document-row > td:first-child {
                    border-left: 3px solid #e11d48;
                }
                @media print {
                    body * { visibility: hidden !important; }
                    .print-table-only, .print-table-only * { visibility: visible !important; }
                    .print-table-only { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
                    .disposition-print-root { display: none; }
                    body.disposition-printing * { visibility: hidden !important; }
                    body.disposition-printing .print-table-only { display: none !important; }
                    body.disposition-printing .disposition-print-root,
                    body.disposition-printing .disposition-print-root * { visibility: visible !important; }
                    body.disposition-printing .disposition-print-root[data-printing="true"] { display: block !important; position: absolute; left: 0; top: 0; z-index: 99999; width: 100%; background: #fff; }
                    .no-print { display: none !important; }
                    .print-table-only table { width: 100% !important; }
                    .print-table-only th, .print-table-only td { font-size: 11px !important; }
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
                            <option value="ongoing">Ongoing</option>
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
                                    const isUrgent = document.urgent === true || (typeof document.urgent === 'string' && document.urgent.trim().toLowerCase() === 'yes');

                                    return (
                                        <tr
                                            key={document.id ?? `${document.tracking_number ?? 'doc'}-${index}`}
                                            className={`${isUrgent ? 'urgent-document-row' : ''} border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]`}
                                        >
                                            <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-blue-800">
                                                <span className="font-mono">{document.tracking_number || 'N/A'}</span>
                                                {isUrgent && <span className="ml-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 font-sans text-[10px] font-bold uppercase text-rose-800">Urgent</span>}
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
                                                    {(document.status || 'draft').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="min-w-[240px] px-4 py-3">
                                                {document.transactions?.[0] ? <div className="flex flex-col gap-1.5">
                                                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getTransactionClasses(document.transactions[0].action, document.transactions[0].status)}`}>{document.transactions[0].action || document.transactions[0].status || 'Transaction'}</span>
                                                    <span className="text-xs text-slate-600">{[document.transactions[0].from_office, document.transactions[0].to_office].filter(Boolean).join(' → ') || document.transactions[0].holder || 'Office not recorded'}</span>
                                                    <span className="text-[11px] text-slate-400">{document.transactions[0].created_at || document.transactions[0].created_by || '—'}</span>
                                                </div> : <span className="text-sm text-slate-400">No transactions</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 no-print">
                                                <div className="flex min-w-[260px] flex-wrap gap-1.5">
                                                    <button type="button" aria-label="View document" title="View document" onClick={() => setViewingRow(document)} className="rounded-md bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"><Eye size={15} /></button>
                                                    {document.is_finalized && <button type="button" aria-label="Print disposition form" title="Print disposition form" onClick={() => printDisposition(document)} className="rounded-md bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100"><Printer size={15} /></button>}
                                                    {document.can_update && <button type="button" aria-label="Update draft" title="Update draft" onClick={() => openEdit(document)} className="rounded-md bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"><Pencil size={15} /></button>}
                                                    {document.can_release && <button type="button" aria-label="Release document" title="Release document" onClick={() => { setReleasingRow(document); setReleaseForm({ actionTypeId: '', otherAction: '', officeId: '', remarks: '', file: null }); setReleaseError(''); }} className="rounded-md bg-sky-50 p-2 text-sky-700 hover:bg-sky-100"><Send size={15} /></button>}
                                                    {document.can_terminal && <button type="button" aria-label="Tag as terminal" title="Tag as terminal" onClick={() => requestDocumentAction('Tag document as terminal?', `Mark ${document.tracking_number || 'this document'} as terminal?`, 'Tag as terminal', () => { setCrudAlert(null); router.post(`/documents/${document.id}/terminal`, {}, { onSuccess: () => setCrudAlert({ title: 'Document updated', message: 'Document tagged as terminal.' }) }); })} className="rounded-md bg-violet-50 p-2 text-violet-700 hover:bg-violet-100"><Archive size={15} /></button>}
                                                    {document.can_receive && <button type="button" aria-label="Receive document" title="Receive document" onClick={() => requestDocumentAction('Receive document?', `Confirm receipt of ${document.tracking_number || 'this document'}?`, 'Receive', () => { setCrudAlert(null); router.post('/documents/receive', { tracking_number: document.tracking_number }, { onSuccess: () => setCrudAlert({ title: 'Document received', message: 'Document received successfully.' }), onError: (errors) => setCrudAlert({ title: 'Could not receive document', message: errors.tracking_number ?? 'This document could not be received.' }) }); })} className="rounded-md bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100"><Inbox size={15} /></button>}
                                                    {document.can_delete && <button type="button" aria-label="Delete draft" title="Delete draft" onClick={() => requestDocumentAction('Delete draft?', `Remove ${document.tracking_number || 'this draft'} from the active list?`, 'Delete draft', () => { setCrudAlert(null); router.delete(`/documents/${document.id}`, { onSuccess: () => setCrudAlert({ title: 'Draft deleted', message: 'Document draft deleted successfully.' }) }); }, true)} className="rounded-md bg-rose-50 p-2 text-rose-700 hover:bg-rose-100"><Trash2 size={15} /></button>}
                                                </div>
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

            {viewingRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4" onClick={() => setViewingRow(null)}>
                    <section role="dialog" aria-modal="true" aria-labelledby="document-details-title" className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#e8e8e4] bg-white px-5 py-4 sm:px-6">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileText size={20} aria-hidden="true" /></span>
                                <div className="min-w-0">
                                    <h2 id="document-details-title" className="text-lg font-semibold text-[#171717]">Document details</h2>
                                    <p className="mt-0.5 break-words text-sm text-[#73736e]">{viewingRow.tracking_number || 'No tracking number'} · {viewingRow.title || 'Untitled'}</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setViewingRow(null)} aria-label="Close document details" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                <X size={19} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            <section aria-label="Document information" className="grid gap-4 rounded-xl border border-[#e8e8e4] bg-[#fafaf8] p-4 sm:grid-cols-2 lg:grid-cols-3">
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Tracking number</p><p className="mt-1 break-words font-mono text-sm font-medium text-slate-800">{viewingRow.tracking_number || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Title</p><p className="mt-1 break-words text-sm font-medium text-slate-800">{viewingRow.title || 'Untitled'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Document type</p><p className="mt-1 text-sm font-medium text-slate-800">{getDocumentTypeName(viewingRow) || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Origin</p><p className="mt-1 text-sm text-slate-700">{viewingRow.origin_type || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Office</p><p className="mt-1 text-sm text-slate-700">{viewingRow.office_name || viewingRow.office?.name || '—'}</p></div>
                                <div><p className="text-xs font-semibold uppercase text-[#898984]">Status</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(viewingRow.status)}`}>{(viewingRow.status || 'draft').toUpperCase()}</span></div>
                                <div className="sm:col-span-2 lg:col-span-3"><p className="text-xs font-semibold uppercase text-[#898984]">Remarks</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{viewingRow.remarks || '—'}</p></div>
                            </section>

                            <section aria-labelledby="transaction-history-title">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div><h3 id="transaction-history-title" className="font-semibold text-[#171717]">Transaction history</h3><p className="mt-0.5 text-sm text-[#73736e]">Document activity in workflow order.</p></div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{viewingRow.transactions?.length ?? 0} transactions</span>
                                </div>
                                {viewingRow.transactions?.length ? <ol className="space-y-3 border-l-2 border-slate-200 pl-4">{viewingRow.transactions.map((transaction, index) => <li key={`${transaction.created_at ?? 'transaction'}-${index}`} className="relative rounded-xl border border-[#e2e2df] bg-[#fafaf8] p-3 before:absolute before:-left-[22px] before:top-4 before:h-2.5 before:w-2.5 before:rounded-full before:bg-sky-500"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-slate-800">{transaction.action || transaction.status || 'Transaction'}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium uppercase text-slate-600">{transaction.status || '—'}</span></div><p className="mt-1 text-sm text-slate-600">{[transaction.from_office, transaction.to_office].filter(Boolean).join(' → ') || (transaction.holder ? `Held by ${transaction.holder}` : 'Office details unavailable')}</p><p className="mt-1 text-xs text-slate-500">{[transaction.created_by, transaction.created_at].filter(Boolean).join(' · ') || 'Date and user unavailable'}</p></li>)}</ol> : <p className="rounded-xl border border-dashed border-[#deded9] px-4 py-8 text-center text-sm text-[#73736e]">No transactions recorded.</p>}
                        </section>
                        </div>
                    </section>
                </div>
            )}

            {releasingRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/45 p-4" onClick={() => setReleasingRow(null)}>
                    <form role="dialog" aria-modal="true" onSubmit={handleRelease} aria-labelledby="release-document-title" className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <input type="hidden" name="document_id" value={releasingRow.id ?? ''} />
                        <input type="hidden" name="tracking_number" value={releasingRow.tracking_number ?? ''} />
                        <div className="sticky top-0 z-10 border-b border-[#e8e8e4] bg-white px-5 py-4 sm:px-6">
                            <h2 id="release-document-title" className="text-lg font-semibold text-[#171717]">Release document</h2>
                            <p className="mt-0.5 break-words text-sm text-[#73736e]">{releasingRow.tracking_number || 'No tracking number'} · {releasingRow.title || 'Untitled'}</p>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            <section aria-label="Selected document details" className="grid gap-x-5 gap-y-4 rounded-xl border border-[#e8e8e4] bg-[#fafaf8] p-4 sm:grid-cols-2">
                                <ReadOnlyDetail label="Tracking number" value={releasingRow.tracking_number} />
                                <ReadOnlyDetail label="Title" value={releasingRow.title} />
                                <ReadOnlyDetail label="Type" value={getDocumentTypeName(releasingRow)} />
                                <ReadOnlyDetail label="Purpose" value={getPurposeTypeName(releasingRow)} />
                                <ReadOnlyDetail label="Created by" value={releasingRow.created_by_name} />
                                <ReadOnlyDetail label="Date created" value={releasingRow.created_at} />
                                <div className="sm:col-span-2">
                                    <p className="text-xs font-semibold uppercase text-[#898984]">Remarks</p>
                                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{releasingRow.remarks || '—'}</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="text-xs font-semibold uppercase text-[#898984]">File</p>
                                    {releasingRow.file_url ? <a href={releasingRow.file_url} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm font-medium text-blue-700 underline">{releasingRow.file_name || 'View attached file'}</a> : <p className="mt-1 text-sm text-slate-700">{releasingRow.file_name || 'No file attached'}</p>}
                                </div>
                            </section>

                            <section className="grid gap-4 sm:grid-cols-2" aria-label="Release details">
                                <div>
                                    <label htmlFor="release-action-type" className="mb-1 block text-sm font-medium text-slate-700">Required Action <span className="text-rose-600">*</span></label>
                                    <select id="release-action-type" required value={releaseForm.actionTypeId} onChange={(event) => { setReleaseForm({ ...releaseForm, actionTypeId: event.target.value, otherAction: '' }); setReleaseError(''); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                        <option value="">Select action</option>
                                        {actionTypes.map((action) => <option key={`${action.source ?? 'new'}-${action.id}`} value={action.id}>{action.name}</option>)}
                                    </select>
                                </div>
                                {actionTypes.find((action) => String(action.id) === releaseForm.actionTypeId)?.name.trim().toLowerCase() === 'others' && (
                                    <div>
                                        <label htmlFor="release-other-action" className="mb-1 block text-sm font-medium text-slate-700">Please specify <span className="text-rose-600">*</span></label>
                                        <input id="release-other-action" required maxLength={255} value={releaseForm.otherAction} onChange={(event) => { setReleaseForm({ ...releaseForm, otherAction: event.target.value }); setReleaseError(''); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="release-office" className="mb-1 block text-sm font-medium text-slate-700">Required Receiving Office <span className="text-rose-600">*</span></label>
                                    <select id="release-office" required disabled={receivingOffices.length === 0} value={releaseForm.officeId} onChange={(event) => { setReleaseForm({ ...releaseForm, officeId: event.target.value }); setReleaseError(''); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
                                        <option value="">{receivingOffices.length ? 'Select receiving office' : 'No receiving offices configured for your range'}</option>
                                        {receivingOffices.map((office) => <option key={`${office.source ?? 'new'}-${office.id}`} value={office.id} disabled={office.is_selectable === false || !office.office_id}>{office.name}{!office.office_id ? ' (not configured for release)' : ''}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="release-remarks" className="mb-1 block text-sm font-medium text-slate-700">Remarks</label>
                                    <textarea id="release-remarks" maxLength={250} rows={3} value={releaseForm.remarks} onChange={(event) => setReleaseForm({ ...releaseForm, remarks: event.target.value })} className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                    <p className="mt-1 text-right text-xs text-slate-500">{releaseForm.remarks.length}/250</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="release-file" className="mb-1 block text-sm font-medium text-slate-700">Replacement or new version (optional)</label>
                                    <input id="release-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { setReleaseForm({ ...releaseForm, file: event.target.files?.[0] ?? null }); setReleaseError(''); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                                    <p className="mt-1 text-xs text-slate-500">PDF, JPG, or PNG. Maximum file size: {uploadLimitKb / 1024} MB.</p>
                                </div>
                            </section>

                            {releaseError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{releaseError}</p>}
                        </div>

                        <div className="flex justify-end gap-2 border-t border-[#e8e8e4] bg-[#fafaf8] px-5 py-4 sm:px-6">
                            <button type="button" onClick={() => setReleasingRow(null)} className="rounded-lg border border-[#deded9] bg-white px-4 py-2 text-sm font-medium text-[#444] hover:bg-[#f6f6f3]">Close</button>
                            <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">Submit</button>
                        </div>
                    </form>
                </div>
            )}

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

                        <form onSubmit={(event) => { const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; (editingRow ? handleUpdate : handleCreate)(event, submitter?.value === '1'); }} className="space-y-4">
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
                                    required
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Action Type</label>
                                    <select value={form.action_type_id} onChange={(event) => setForm({ ...form, action_type_id: event.target.value, other_action: '' })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="">Select action type</option>
                                        {actionTypes.map((action) => <option key={`${action.source ?? 'new'}-${action.id}`} value={action.id}>{action.name}</option>)}
                                    </select>
                                </div>
                                {isOtherAction(form.action_type_id) && (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-slate-700">Please specify <span className="text-rose-600">*</span></label>
                                        <input value={form.other_action} onChange={(event) => setForm({ ...form, other_action: event.target.value })} required maxLength={255} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="document-type-select" className="mb-1 block text-sm font-medium text-slate-700">Document Type</label>
                                    <select id="document-type-select" value={form.document_type_id} onChange={(event) => setForm({ ...form, document_type_id: event.target.value, other_document_type: '' })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="">Select document type</option>
                                        {documentTypes.map((option) => <option key={`${option.source ?? 'new'}-${option.id}`} value={option.id}>{option.name}</option>)}
                                    </select>
                                </div>
                                {isOtherOption(form.document_type_id, documentTypes) && (
                                    <div>
                                        <label htmlFor="document-type-other" className="mb-1 block text-sm font-medium text-slate-700">Please specify <span className="text-rose-600">*</span></label>
                                        <input id="document-type-other" value={form.other_document_type} onChange={(event) => setForm({ ...form, other_document_type: event.target.value })} required maxLength={255} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                                    </div>
                                )}
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Origin Type</label>
                                    <select value={form.origin_type} onChange={(e) => setForm({ ...form, origin_type: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="">Select origin type</option>
                                        <option value="Internal">Internal</option>
                                        <option value="External">External</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="purpose-type-select" className="mb-1 block text-sm font-medium text-slate-700">Purpose</label>
                                    <select id="purpose-type-select" value={form.purpose_type_id} onChange={(event) => setForm({ ...form, purpose_type_id: event.target.value, other_purpose: '' })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="">Select purpose</option>
                                        {purposeTypes.map((option) => <option key={`${option.source ?? 'new'}-${option.id}`} value={option.id}>{option.name}</option>)}
                                    </select>
                                </div>
                                {isOtherOption(form.purpose_type_id, purposeTypes) && (
                                    <div>
                                        <label htmlFor="purpose-type-other" className="mb-1 block text-sm font-medium text-slate-700">Please specify <span className="text-rose-600">*</span></label>
                                        <input id="purpose-type-other" value={form.other_purpose} onChange={(event) => setForm({ ...form, other_purpose: event.target.value })} required maxLength={255} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                                    </div>
                                )}
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

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">File (optional)</label>
                                <input type="file" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                            </div>
                            <div className="flex flex-wrap gap-5">
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} /> Mark as urgent</label>
                                <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.notify_by_email} onChange={(e) => setForm({ ...form, notify_by_email: e.target.checked })} /> Email me</label>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                                >
                                    Cancel
                                </button>

                                <button type="submit" name="is_finalized" value="0" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Save Draft</button>
                                <button type="submit" name="is_finalized" value="1" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">Finalize</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {printDocument && <DispositionPrintView document={printDocument} />}
        </AuthenticatedLayout>
    );
}

function DispositionPrintView({ document }: { document: DocumentItem }) {
    const transactions = document.transactions ?? [];
    const latest = transactions[0];
    const image = (name: string) => `/images/${name}`;

    return (
        <article className="disposition-print-root" data-printing="true">
            <style>{`
                @page { size: letter portrait; margin: 0.4in 0.45in; }
                .disposition-sheet { width: 100%; min-height: 10.2in; display: flex; flex-direction: column; color: #111; font: 9pt Arial, Helvetica, sans-serif; }
                .disposition-header { display: block; width: 100%; max-height: 1.2in; object-fit: contain; margin: 0 auto 8px; }
                .disposition-title { margin: 0 0 12px; text-align: center; font: bold 12pt Georgia, 'Times New Roman', serif; }
                .disposition-fields { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8.3pt; }
                .disposition-fields td { border: 1px solid #b9b9b9; padding: 4px 5px; vertical-align: middle; overflow-wrap: anywhere; }
                .disposition-fields .field-label { width: 19%; font-size: 7.4pt; font-weight: bold; text-transform: uppercase; }
                .disposition-fields .field-value { width: 58%; }
                .disposition-fields .qr-cell { width: 23%; text-align: center; }
                .disposition-qr { width: .85in; height: .85in; margin: 0 auto 5px; border: 1px dashed #777; display: flex; align-items: center; justify-content: center; color: #555; font-size: 8pt; font-weight: bold; }
                .disposition-qr-note { font-size: 7pt; line-height: 1.4; overflow-wrap: anywhere; }
                .disposition-remarks { margin-top: 5px; font-size: 8.5pt; overflow-wrap: anywhere; }
                .disposition-remarks-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; line-height: 1.4; }
                .disposition-remarks-label { flex: 0 0 .8in; font-size: 7.4pt; font-weight: bold; text-transform: uppercase; }
                .disposition-remarks-value { flex: 1; min-width: 0; white-space: pre-wrap; }
                .disposition-trails { padding-left: .35in; line-height: 1.45; overflow-wrap: anywhere; }
                .disposition-trail-remarks { margin: 4px 0 12px .3in; }
                .disposition-trail-action { margin: 0 0 8px; }
                .disposition-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #aaa; width: 100%; break-inside: avoid; page-break-inside: avoid; }
                .disposition-footer-main { display: flex; align-items: center; gap: 10px; width: 100%; }
                .disposition-logo { flex: 0 0 .55in; width: .60in; height: .60in; object-fit: contain; }
                .disposition-footer-details { flex: 1; min-width: 0; }
                .disposition-footer-copy { font-size: 6.8pt; line-height: 1.4; }
                .disposition-footer-copy strong { font-size: 8.5pt; }
                .disposition-contact-row { display: flex; justify-content: left; flex-wrap: wrap; gap: 3px 9px; font-size: 6.5pt; line-height: 1.3; }
                .disposition-contact-item { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
                .disposition-contact-icon { width: 8px; height: 8px; object-fit: contain; }
.disposition-tagline {
    display: block;
    width: calc(100% - .60in - 10px);
    max-height: .20in;
    object-fit: contain;
    object-position: left center;
    margin: 0;
}                @media print { .disposition-sheet { min-height: 10.2in; } .disposition-print-root img { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                @media screen { .disposition-print-root { display: none; } }
            `}</style>
            <main className="disposition-sheet">
                <img className="disposition-header" src={image('header.png')} alt="National Commission on Indigenous Peoples" />
                <h1 className="disposition-title">DISPOSITION FORM</h1>
                <table className="disposition-fields">
                    <tbody>
                        <tr>
                            <td className="field-label">TO/FOR:</td>
                            <td className="field-value">{latest?.to_office || 'Not specified'}</td>
                            <td className="qr-cell" rowSpan={6}>
                                <div className="disposition-qr">QR<br />WIP</div>
                                <div className="disposition-qr-note"><strong>DOTS No.:</strong><br />{document.tracking_number || 'Not assigned'}</div>
                            </td>
                        </tr>
                        <tr><td className="field-label">FROM:</td><td className="field-value">{latest?.from_office || document.office_name || 'Not specified'}</td></tr>
                        <tr><td className="field-label">SUBJECT:</td><td className="field-value">{document.title || '—'}</td></tr>
                        <tr><td className="field-label">PURPOSE:</td><td className="field-value">{document.purpose_type || 'For Appropriate Action'}</td></tr>
                        <tr><td className="field-label">DOCUMENT:</td><td className="field-value">{getDocumentTypeName(document) || 'No document attached'}</td></tr>
                        <tr><td className="field-label">DATE CREATED:</td><td className="field-value">{document.created_at || '—'}</td></tr>
                    </tbody>
                </table>
                <section className="disposition-remarks">
                    <div className="disposition-remarks-heading">
                        <strong className="disposition-remarks-label">REMARKS:</strong>
                        <div className="disposition-remarks-value">{document.remarks || ''}</div>
                    </div>
                    {transactions.length > 0 && <div className="disposition-trails">
                        {transactions.map((entry, index) => {
                            const actionType = (entry.action || entry.status || '').toLowerCase();
                            const office = actionType.includes('releas')
                                ? entry.from_office || entry.holder || entry.to_office
                                : actionType.includes('receiv')
                                    ? entry.to_office || entry.holder || entry.from_office
                                    : entry.holder || entry.from_office || entry.to_office;
                            return <div key={`${entry.created_at ?? 'trail'}-${index}`}>
                                {entry.remarks && <div className="disposition-trail-remarks">Remarks: '{entry.remarks}'</div>}
                                <div className="disposition-trail-action">✔ {entry.action || entry.status || 'Processed'} by {entry.created_by || 'Unknown user'} of {office || 'Unknown office'}{entry.created_at ? ` at ${entry.created_at}` : ''}</div>
                            </div>;
                        })}
                    </div>}
                </section>
                <footer className="disposition-footer">
                    <div className="disposition-footer-main">
                        <img className="disposition-logo" src={image('bagong-pilipinas.png')} alt="Bagong Pilipinas" />
                        <div className="disposition-footer-details">
                                <div className="disposition-footer-copy"><strong>{(document.office_name || latest?.from_office || 'Office not assigned').toUpperCase()}</strong><br />6th and 7th Floors, Sunnymede IT Center, 1614 Quezon Avenue, South Triangle, Quezon City 1103</div>
                            <div className="disposition-contact-row">
                                <span className="disposition-contact-item"><img className="disposition-contact-icon" src={image('telephone-icon.png')} alt="" />(02) 875 1200</span>
                                <span className="disposition-contact-item"><img className="disposition-contact-icon" src={image('website-icon.png')} alt="" />ncip.gov.ph</span>
                                <span className="disposition-contact-item"><img className="disposition-contact-icon" src={image('email-icon.png')} alt="" />csc@ncip.gov.ph</span>
                            </div>
                            <img className="disposition-tagline" src={image('ncip-footer.png')} alt="Masaganang Katutubong Pamayanan: Sandigan ng Pambansang Kaunlaran" />
                        </div>
                    </div>
                </footer>
            </main>
        </article>
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

function ReadOnlyDetail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-[#898984]">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-slate-800">{value || '—'}</p>
        </div>
    );
}
