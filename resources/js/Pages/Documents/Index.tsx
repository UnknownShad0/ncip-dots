import WorkspaceDialog from '@/Components/WorkspaceDialog';
import DocumentDispositionPrint from '@/Components/DocumentDispositionPrint';
import InfoTip from '@/Components/InfoTip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/WorkspaceAlert';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { Archive, ArrowDownUp, ChevronLeft, ChevronRight, Eye, FilePlus2, Inbox, LoaderCircle, Pencil, Printer, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type DocumentItem = {
    id?: number | string | null;
    tracking_number?: string;
    needs_review?: boolean;
    tracking_url?: string;
    title?: string;
    status?: string;
    office_name?: string;
    office_short_name?: string | null;
    document_type?: string | { name?: string } | null;
    purpose_type?: string;
    documentType?: { name?: string } | null;
    created_by_name?: string;
    created_by_short_name?: string | null;
    file_name?: string;
    file_url?: string | null;
    files?: Array<{ id: number; name: string; type: 'original' | 'version' | string; url: string | null; uploaded_at?: string | null }>;
    origin_type?: string;
    last_transaction?: string;
    last_transaction_summary?: {
        action?: string | null;
        status?: string | null;
        from_office?: string | null;
        from_office_short_name?: string | null;
        to_office?: string | null;
        to_office_short_name?: string | null;
        holder?: string | null;
        holder_short_name?: string | null;
        created_by?: string | null;
        created_by_short_name?: string | null;
        created_at?: string | null;
    } | null;
    details_loading?: boolean;
    details_error?: string;
    created_at?: string;
    transactions?: Array<{
        action?: string | null;
        status?: string | null;
        remarks?: string | null;
        from_office?: string | null;
        from_office_short_name?: string | null;
        to_office?: string | null;
        to_office_short_name?: string | null;
        holder?: string | null;
        holder_short_name?: string | null;
        created_by?: string | null;
        created_by_short_name?: string | null;
        created_at?: string | null;
    }>;
    office?: {
        name?: string;
        short_name?: string | null;
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

type LibraryOption = { id: number | string; name: string; source?: string; disabled?: boolean };
type ApprovedDocument = { id: number; title: string; document_type_id: number; document_type?: string; status?: string; disabled?: boolean };
type CrudAlert = { title: string; message: string; onConfirm?: () => void; confirmLabel?: string; isDestructive?: boolean };

type SortKey = 'tracking_number' | 'title' | 'document_type' | 'origin_type' | 'status' | 'office_name' | 'last_transaction';

const getDocumentTypeName = (document: DocumentItem): string => {
    const type = document.document_type ?? document.documentType;
    const name = typeof type === 'string' ? type : type?.name ?? '';
    return name.trim().toLowerCase() === 'others' && document.other_document_type
        ? `${name} (${document.other_document_type})`
        : name;
};

const validateDocumentFile = (file: File | null, maxSizeKb: number): string | null => {
    if (!file) return null;
    if (maxSizeKb > 0 && file.size > maxSizeKb * 1024) return `The selected file must be ${maxSizeKb / 1024} MB or smaller.`;
    if (!/\.(pdf|jpe?g|png|docx?)$/i.test(file.name)) return 'Choose a PDF, JPG, PNG, DOC, or DOCX file.';
    return null;
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
            return 'bg-success-soft text-success';
        case 'pending':
        case 'ongoing':
            return 'bg-warning-soft text-warning';
        case 'rejected':
        case 'cancelled':
            return 'bg-danger-soft text-danger';
        case 'archived':
        case 'terminal':
            return 'bg-violet-100 text-violet-700';
        default:
            return 'bg-slate-100 text-foreground';
    }
};

const getTransactionClasses = (action?: string | null, status?: string | null) => {
    const label = (action || status || '').toLowerCase();

    if (label.includes('terminal')) return 'bg-violet-100 text-violet-800';
    if (label.includes('receiv')) return 'bg-emerald-100 text-emerald-800';
    if (label.includes('finaliz')) return 'bg-blue-100 text-primary';
    return 'bg-secondary text-sky-800';
};

export default function DocumentsIndex({
    documents = [],
    title = 'All Documents',
    pagination,
    filters,
    documentTypes = [],
    actionTypes = [],
    purposeTypes = [],
    offices = [],
    officeRangeLabel = null,
    approvedDocuments = [],
    maxUploadSizeKb,
    editDraftId = null,
}: {
    documents?: DocumentItem[];
    title?: string;
    pagination?: { current_page: number; last_page: number; total: number; from: number | null; to: number | null; per_page: number };
    filters?: { search?: string; status?: string; sort?: SortKey | null; direction?: 'asc' | 'desc' };
    documentTypes?: LibraryOption[];
    actionTypes?: LibraryOption[];
    purposeTypes?: LibraryOption[];
    offices?: LibraryOption[];
    officeRangeLabel?: string | null;
    approvedDocuments?: ApprovedDocument[];
    maxUploadSizeKb: number;
    editDraftId?: number | string | null;
}) {
    const uploadLimitKb = Number(maxUploadSizeKb ?? 0);
    const [processing, setProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const formBaseline = useRef('');
    const autoOpenedDraftId = useRef<string | null>(null);
    const [editingRow, setEditingRow] = useState<DocumentItem | null>(null);
    const [crudAlert, setCrudAlert] = useState<CrudAlert | null>(null);
    const [viewingRow, setViewingRow] = useState<DocumentItem | null>(null);
    const [printDocument, setPrintDocument] = useState<DocumentItem | null>(null);
    const [releasingRow, setReleasingRow] = useState<DocumentItem | null>(null);
    const [releaseForm, setReleaseForm] = useState({ actionTypeId: '', otherAction: '', officeId: '', remarks: '', source: 'current', approvedDraftId: '', file: null as File | null });
    const [releaseError, setReleaseError] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState(filters?.search ?? '');
    const [statusFilter, setStatusFilter] = useState(filters?.status ?? 'all');
    const [sortKey, setSortKey] = useState<SortKey | null>(filters?.sort ?? null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(filters?.direction ?? 'asc');
    const [page, setPage] = useState(pagination?.current_page ?? 1);
    const [perPage, setPerPage] = useState(pagination?.per_page ?? 10);
    const [showListUpdating, setShowListUpdating] = useState(false);
    const listLoadingTimer = useRef<number | null>(null);
    const firstQueryRender = useRef(true);
    const [form, setForm] = useState({
        title: '',
        document_source: 'upload',
        approved_draft_id: '',
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

    const beginListUpdate = () => {
        if (listLoadingTimer.current !== null) window.clearTimeout(listLoadingTimer.current);
        listLoadingTimer.current = window.setTimeout(() => setShowListUpdating(true), 180);
    };
    const finishListUpdate = () => {
        if (listLoadingTimer.current !== null) window.clearTimeout(listLoadingTimer.current);
        listLoadingTimer.current = null;
        setShowListUpdating(false);
    };

    useEffect(() => { formBaseline.current = JSON.stringify(form); }, [isCreateOpen, editingRow]);

    const closeRelease = () => {
        if (processing) return;
        const dirty = releaseForm.source !== 'current' || Object.entries(releaseForm).some(([key, value]) => key !== 'source' && Boolean(value));
        if (!dirty) { setReleasingRow(null); return; }
        setCrudAlert({ title: 'Discard forwarding details?', message: 'Your unsaved changes will be lost.', confirmLabel: 'Discard changes', isDestructive: true, onConfirm: () => { setCrudAlert(null); setReleasingRow(null); } });
    };
    const requestCloseForm = () => {
        if (processing) return;
        if (JSON.stringify(form) === formBaseline.current && !form.file) { closeModal(); return; }
        setCrudAlert({ title: 'Discard unsaved changes?', message: 'Close this form without saving your changes?', confirmLabel: 'Discard changes', isDestructive: true, onConfirm: () => { setCrudAlert(null); closeModal(); } });
    };
    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm({
            title: '',
            document_source: 'upload',
            approved_draft_id: '',
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
        setFormError('');
        setUploadError('');
        if (row.source === 'Old DB') {
            return;
        }

        setEditingRow(row);
        setForm({
            title: row.title ?? '',
            document_source: 'upload',
            approved_draft_id: '',
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

    useEffect(() => {
        const requestedId = editDraftId == null ? '' : String(editDraftId);
        if (!requestedId || autoOpenedDraftId.current === requestedId) return;
        const draft = documents.find((item) => String(item.id) === requestedId);
        if (draft?.can_update) {
            autoOpenedDraftId.current = requestedId;
            openEdit(draft);
        }
    }, [documents, editDraftId]);

    const openCreate = () => {
        setFormError('');
        setUploadError('');
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            title: '',
            document_source: 'upload',
            approved_draft_id: '',
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
        if (processing) return;
        const fileError = validateDocumentFile(form.file, uploadLimitKb);
        if (fileError) { setUploadError(fileError); return; }

        const data = new FormData();
        Object.entries({ ...form, is_finalized: finalize ? '1' : '0' }).forEach(([key, value]) => {
            if (value !== null && value !== undefined) data.append(key, value instanceof File ? value : typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        });
        setProcessing(true);
        setFormError('');
        router.post('/documents', data, {
            onFinish: () => setProcessing(false),
            onError: (errors) => setFormError(Object.values(errors).join(' ')),
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Document saved', message: finalize ? 'Document finalized successfully.' : 'Document draft created successfully.' });
            },
        });
    };

    const handleRelease = (event: FormEvent) => {
        event.preventDefault();
        if (processing) return;
        if (!releasingRow?.id) return;

        const selectedAction = actionTypes.find((action) => String(action.id) === releaseForm.actionTypeId);
        const needsOtherAction = selectedAction?.name.trim().toLowerCase() === 'others';
        if (!releaseForm.actionTypeId || !releaseForm.officeId || (needsOtherAction && !releaseForm.otherAction.trim())) {
            setReleaseError('Complete the required fields before submitting.');
            return;
        }
        if (releaseForm.file && releaseForm.file.size > uploadLimitKb * 1024) {
            setReleaseError(`The selected file must be ${uploadLimitKb / 1024} MB or smaller.`);
            return;
        }
        if (releaseForm.file && !/\.(pdf|jpe?g|png|docx?)$/i.test(releaseForm.file.name)) {
            setReleaseError('Choose a PDF, JPG, PNG, DOC, or DOCX file.');
            return;
        }

        if (releaseForm.source === 'approved' && !releaseForm.approvedDraftId) {
            setReleaseError('Choose an approved document.');
            return;
        }
        if (releaseForm.source === 'upload' && !releaseForm.file) {
            setReleaseError('Choose a file to upload.');
            return;
        }

        const data = new FormData();
        data.append('action_type_id', releaseForm.actionTypeId);
        data.append('other_action', needsOtherAction ? releaseForm.otherAction.trim() : '');
        data.append('to_office_id', releaseForm.officeId);
        data.append('remarks', releaseForm.remarks);
        data.append('document_source', releaseForm.source);
        if (releaseForm.source === 'upload' && releaseForm.file) data.append('file', releaseForm.file);
        if (releaseForm.source === 'approved') data.append('approved_draft_id', releaseForm.approvedDraftId);

        const selectedOffice = offices.find((office) => String(office.id) === releaseForm.officeId);
        const isRelease = selectedAction?.name.trim().toLowerCase() === 'for release';
        const documentReference = releasingRow.tracking_number || releasingRow.title || 'The document';

        setProcessing(true);
        setFormError('');
        router.post(`/documents/${releasingRow.id}/release`, data, {
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setReleasingRow(null);
                setReleaseForm({ actionTypeId: '', otherAction: '', officeId: '', remarks: '', source: 'current', approvedDraftId: '', file: null });
                setReleaseError('');
                setCrudAlert({
                    title: isRelease ? 'Document released' : 'Document forwarded',
                    message: `${documentReference} was ${isRelease ? 'released to' : 'forwarded to'} ${selectedOffice?.name || 'the receiving office'}. You can follow its progress in the document history.`,
                });
            },
            onError: (errors) => setReleaseError(errors.approved_draft_id ?? errors.document_source ?? errors.file ?? errors.other_action ?? errors.action_type_id ?? errors.to_office_id ?? errors.remarks ?? 'Could not release this document.'),
        });
    };

    const fetchDocumentDetails = async (document: DocumentItem) => {
        if (document.id == null) throw new Error('Document details are unavailable.');
        const { data } = await axios.get<Partial<DocumentItem>>(route('documents.details', document.id));
        return { ...document, ...data, details_loading: false };
    };

    const openDocumentDetails = async (document: DocumentItem) => {
        setViewingRow({ ...document, details_loading: true, details_error: undefined });
        try {
            const details = await fetchDocumentDetails(document);
            setViewingRow((current) => current?.id === document.id ? details : current);
        } catch {
            setViewingRow((current) => current?.id === document.id
                ? { ...current, details_loading: false, details_error: 'Could not load this document’s history. Please try again.' }
                : current);
        }
    };

    const printDisposition = async (document: DocumentItem) => {
        try {
            setPrintDocument(await fetchDocumentDetails(document));
        } catch {
            setCrudAlert({ title: 'Could not load document', message: 'The disposition history could not be loaded. Please try again.' });
        }
    };

    const openRelease = async (document: DocumentItem) => {
        setReleasingRow({ ...document, details_loading: true });
        setReleaseForm({ actionTypeId: '', otherAction: '', officeId: '', remarks: '', source: 'current', approvedDraftId: '', file: null });
        setReleaseError('');
        try {
            const details = await fetchDocumentDetails(document);
            setReleasingRow((current) => current?.id === document.id ? details : current);
        } catch {
            setReleasingRow(null);
            setCrudAlert({ title: 'Could not load document', message: 'Document versions could not be loaded. Please try again.' });
        }
    };
    const handleUpdate = (e: React.FormEvent, finalize: boolean) => {
        e.preventDefault();
        if (processing) return;

        if (!editingRow || editingRow.id == null) {
            return;
        }
        const fileError = validateDocumentFile(form.file, uploadLimitKb);
        if (fileError) { setUploadError(fileError); return; }

        const data = new FormData();
        Object.entries({ ...form, is_finalized: finalize ? '1' : '0', _method: 'put' }).forEach(([key, value]) => {
            if (value !== null && value !== undefined) data.append(key, value instanceof File ? value : typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        });
        setProcessing(true);
        setFormError('');
        router.post(`/documents/${editingRow.id}`, data, {
            onFinish: () => setProcessing(false),
            onError: (errors) => setFormError(Object.values(errors).join(' ')),
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
            setPage(1);
            return;
        }

        setSortKey(key);
        setSortDirection('asc');
        setPage(1);
    };

    useEffect(() => {
        if (firstQueryRender.current) {
            firstQueryRender.current = false;
            return;
        }

        const timeout = window.setTimeout(() => {
            const query = {
                search: search || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                sort: sortKey ?? undefined,
                direction: sortKey ? sortDirection : undefined,
                per_page: perPage,
                page,
            };
            router.get(title === 'Latest Documents' ? route('documents.latest') : route('documents.index'), query, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['documents', 'pagination', 'filters'],
                onStart: beginListUpdate,
                onFinish: finishListUpdate,
            });
        }, 250);

        return () => window.clearTimeout(timeout);
    }, [search, statusFilter, sortKey, sortDirection, perPage, page, title]);

    useEffect(() => () => {
        if (listLoadingTimer.current !== null) window.clearTimeout(listLoadingTimer.current);
    }, []);

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
        let animationFrame = 0;
        const printWhenReady = async () => {
            if (cancelled) return;
            const printRoot = window.document.querySelector('.disposition-print-root');
            if (printRoot?.getAttribute('data-ready') !== 'true') {
                animationFrame = window.requestAnimationFrame(printWhenReady);
                return;
            }
            const images = Array.from(printRoot?.querySelectorAll('img') ?? []);
            await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
            if (!cancelled) window.print();
        };
        animationFrame = window.requestAnimationFrame(printWhenReady);

        return () => {
            cancelled = true;
            window.cancelAnimationFrame(animationFrame);
            window.removeEventListener('afterprint', onAfterPrint);
            clearDispositionPrintMode();
        };
    }, [printDocument]);

    const paginatedDocuments = documents;
    const totalPages = Math.max(1, pagination?.last_page ?? 1);
    const totalDocuments = pagination?.total ?? documents.length;
    const isOtherAction = (actionTypeId: string) => actionTypes.find((action) => String(action.id) === actionTypeId)?.name.trim().toLowerCase() === 'others';

    return (
        <AuthenticatedLayout
            header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>}
        >
            <Head title={title} />


            <style>{`
                .urgent-document-row > td,
                .urgent-document-row:hover > td {
                    background-color: rgb(var(--color-danger-soft)) !important;
                }
                .urgent-document-row > td:first-child {
                    border-left: 3px solid rgb(var(--color-danger));
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
                    body.disposition-printing > *:not(.disposition-print-portal) { display: none !important; }
                    body.disposition-printing > .disposition-print-portal { display: block !important; position: static !important; width: 8.5in; margin: 0 auto; overflow: visible !important; }
                    body.disposition-printing .disposition-print-root[data-printing="true"] { display: block !important; position: static !important; width: 8.5in; margin: 0; background: #fff; }
                    .no-print { display: none !important; }
                    .print-table-only table { width: 100% !important; }
                    .print-table-only th, .print-table-only td { font-size: 14px !important; }
                }
            `}</style>

            <div className="mx-auto max-w-[1440px] print-table-only">
                <div className="mb-5 flex flex-col gap-4 no-print">
                    <div className="flex items-center gap-2 text-muted">
                        <p>Receive, forward, and track your office documents.</p>
                        <InfoTip label="Document workflow help">Open a document title to review its details and history. Receive acknowledges delivery; Forward sends it to the selected office. Available actions depend on your permissions and the document status.</InfoTip>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                        <label className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:col-span-1">
                            <Search size={18} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                                placeholder="Search title, tracking number, or office"
                                aria-label="Search documents"
                                className="w-full border-0 bg-transparent px-0 py-2.5 text-sm text-foreground placeholder:text-muted focus:ring-0"
                            />
                        </label>

                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            aria-label="Filter documents by status"
                            className="col-span-2 h-11 min-w-0 rounded-xl border border-border bg-background pl-3 pr-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:col-span-1"
                        >
                            <option value="all">All statuses</option>
                            <option value="pending">Pending</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="approved">Approved</option>
                            <option value="released">Released</option>
                            <option value="archived">Archived</option>
                            <option value="rejected">Rejected</option>
                        </select>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground transition hover:bg-secondary sm:px-4"
                        >
                            <Printer size={17} />
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3 text-sm font-semibold text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:px-4"
                        >
                            <FilePlus2 size={17} />
                            New document
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <h3 className="font-semibold text-foreground">Documents</h3>
                        <div className="flex items-center gap-3">
                            {showListUpdating && <p role="status" className="inline-flex items-center gap-1.5 text-xs text-muted"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Updating results…</p>}
                            <p className="text-sm text-muted">{totalDocuments === 0 ? 'No results' : `Showing ${pagination?.from ?? 0}–${pagination?.to ?? 0} of ${totalDocuments} documents`}</p>
                        </div>
                    </div>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Documents table; scroll horizontally for more columns">
                    <table aria-busy={showListUpdating} className="dots-document-table min-w-full text-left text-sm">
                        <thead className="bg-background text-muted">
                            <tr>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('tracking_number')} className="flex items-center gap-1.5 hover:text-primary">
                                        Tracking No. <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('title')} className="flex items-center gap-1.5 hover:text-primary">
                                        Title <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('document_type')} className="flex items-center gap-1.5 hover:text-primary">
                                        Document Type <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('origin_type')} className="flex items-center gap-1.5 hover:text-primary">
                                        Origin Type <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('status')} className="flex items-center gap-1.5 hover:text-primary">
                                        Status <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="whitespace-nowrap px-4 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('last_transaction')} className="flex items-center gap-1.5 hover:text-primary">
                                        Last Transaction <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold no-print">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted">
                                        {search || statusFilter !== 'all' ? 'No matching documents. Try another search or status.' : 'No documents yet. Select New document to register one.'}
                                    </td>
                                </tr>
                            ) : (
                                paginatedDocuments.map((document, index) => {
                                    const isLegacy = document.source === 'Old DB';
                                    const isUrgent = document.urgent === true || (typeof document.urgent === 'string' && document.urgent.trim().toLowerCase() === 'yes');

                                    return (
                                        <tr
                                            key={document.id ?? `${document.tracking_number ?? 'doc'}-${index}`}
                                            className={`${isUrgent ? 'urgent-document-row' : ''} border-t border-border transition-colors hover:bg-background`}
                                        >
                                            <td className="whitespace-nowrap px-4 py-4 text-xs font-semibold text-primary">
                                                <span className="font-mono">{document.tracking_number || 'N/A'}</span>
                                                {document.needs_review && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[13px] font-medium text-amber-800">Needs review</span>}
                                                {isUrgent && <span className="ml-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 font-sans text-[13px] font-bold uppercase text-rose-800">Urgent</span>}
                                                {isLegacy && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-sans text-[13px] font-medium text-muted">Legacy</span>}
                                            </td>
                                            <td className="min-w-[190px] px-4 py-4 font-medium text-foreground">
                                                <button type="button" onClick={() => openDocumentDetails(document)} className="text-left font-semibold hover:text-primary hover:underline">{document.title || 'Untitled'}</button>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 text-muted">
                                                {getDocumentTypeName(document) || '—'}
                                            </td>
                                            <td className="px-4 py-4 text-muted">
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
                                                {document.last_transaction_summary ? <div className="flex flex-col gap-1.5">
                                                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getTransactionClasses(document.last_transaction_summary.action, document.last_transaction_summary.status)}`}>{document.last_transaction_summary.action || document.last_transaction_summary.status || 'Transaction'}</span>
                                                    <span className="text-xs text-muted">{[document.last_transaction_summary.from_office_short_name || document.last_transaction_summary.from_office, document.last_transaction_summary.to_office_short_name || document.last_transaction_summary.to_office].filter(Boolean).join(' → ') || document.last_transaction_summary.holder_short_name || document.last_transaction_summary.holder || 'Office not recorded'}</span>
                                                    <span className="text-[14px] text-slate-400">{document.last_transaction_summary.created_at || document.last_transaction_summary.created_by || '—'}</span>
                                                </div> : <span className="text-sm text-slate-400">No transactions</span>}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-4 no-print">
                                                <fieldset disabled={processing} className="flex min-w-[180px] flex-wrap items-center gap-1.5">
                                                    <button type="button" aria-label="View document" title="View document" onClick={() => openDocumentDetails(document)} className="rounded-md bg-slate-100 p-2 text-foreground hover:bg-slate-200"><Eye size={15} /></button>
                                                    {document.is_finalized && <button type="button" aria-label="Print disposition form" title="Print disposition form" onClick={() => printDisposition(document)} className="rounded-md bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100"><Printer size={15} /></button>}
                                                    {document.can_update && <button type="button" aria-label="Update draft" title="Update draft" onClick={() => openEdit(document)} className="rounded-md bg-secondary p-2 text-primary hover:bg-blue-100"><Pencil size={15} /></button>}
                                                    {document.can_release && <button type="button" aria-label="Forward document" title="Forward document" onClick={() => openRelease(document)} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-2  hover:bg-slate-200"><Send size={15} /></button>}
                                                    {document.can_terminal && <button type="button" aria-label="Tag as terminal" title="Tag as terminal" onClick={() => requestDocumentAction('Tag document as terminal?', `Mark ${document.tracking_number || 'this document'} as terminal?`, 'Tag as terminal', () => { setCrudAlert(null); setProcessing(true); router.post(`/documents/${document.id}/terminal`, {}, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Document updated', message: 'Document tagged as terminal.' }) }); })} className="rounded-md bg-violet-50 p-2 text-violet-700 hover:bg-violet-100"><Archive size={15} /></button>}
                                                    {document.can_receive && <button type="button" aria-label="Receive document" title="Receive document" onClick={() => requestDocumentAction('Receive document?', `Confirm receipt of ${document.tracking_number || 'this document'}?`, 'Receive', () => { setCrudAlert(null); setProcessing(true); router.post(`/documents/${document.id}/receive`, {}, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Document received', message: 'Document received successfully.' }) }); })} className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-3 py-2 text-success hover:bg-success/20"><Inbox size={15} /></button>}
                                                    {document.can_delete && <button type="button" aria-label="Delete draft" title="Delete draft" onClick={() => requestDocumentAction('Delete draft?', `Remove ${document.tracking_number || 'this draft'} from the active list?`, 'Delete draft', () => { setCrudAlert(null); setProcessing(true); router.delete(`/documents/${document.id}`, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Draft deleted', message: 'Document draft deleted successfully.' }) }); }, true)} className="rounded-md bg-danger-soft p-2 text-danger hover:bg-rose-100"><Trash2 size={15} /></button>}
                                                </fieldset>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <span>Rows per page:</span>
                        <select
                            aria-label="Rows per page"
                            value={perPage}
                            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                            className="min-w-[4.5rem] rounded-lg border border-border bg-surface py-1.5 pl-2 pr-10 text-sm"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ChevronLeft size={16} /> Previous
                        </button>

                        <span className="px-1 text-sm text-muted">
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
            </div>

            <WorkspaceDialog open={Boolean(viewingRow)} onClose={() => setViewingRow(null)} labelledBy="document-details-title" width="max-w-3xl">
                {viewingRow && (
                    <section>
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                            <div>
                                <h2 id="document-details-title" className="text-lg font-semibold text-foreground">Document details</h2>
                                <p className="mt-1 break-words text-sm text-muted">Review document information and transaction history.</p>
                            </div>
                            <button type="button" onClick={() => setViewingRow(null)} aria-label="Close document details" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                <X size={19} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6" aria-busy={viewingRow.details_loading}>
                            {viewingRow.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading transaction history and attachments…</p>}
                            {viewingRow.details_error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{viewingRow.details_error}</p>}
                            <DocumentReferenceDetails document={viewingRow} loading={viewingRow.details_loading} />

                            <section aria-labelledby="transaction-history-title">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div><h3 id="transaction-history-title" className="font-semibold text-foreground">Transaction history</h3><p className="mt-1 text-sm text-muted">Document activity in workflow order.</p></div>
                                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted">{viewingRow.transactions?.length ?? 0} transactions</span>
                                </div>
                                {viewingRow.transactions?.length ? <ol className="space-y-3 border-l-2 border-border pl-4">{viewingRow.transactions.map((transaction, index) => <li key={`${transaction.created_at ?? 'transaction'}-${index}`} className="relative rounded-xl border border-border bg-background p-3 before:absolute before:-left-[22px] before:top-4 before:h-2.5 before:w-2.5 before:rounded-full before:bg-primary"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-foreground">{transaction.action || transaction.status || 'Transaction'}</span><span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium uppercase text-muted">{transaction.status || '—'}</span></div><p className="mt-1 text-sm text-muted">{[transaction.from_office_short_name || transaction.from_office, transaction.to_office_short_name || transaction.to_office].filter(Boolean).join(' → ') || (transaction.holder_short_name || transaction.holder ? `Held by ${transaction.holder_short_name || transaction.holder}` : 'Office details unavailable')}</p><p className="mt-1 text-xs text-muted">{[transaction.created_by_short_name || transaction.created_by, transaction.created_at].filter(Boolean).join(' · ') || 'Date and user unavailable'}</p></li>)}</ol> : viewingRow.details_loading ? null : <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No transactions recorded.</p>}
                        </section>
                        </div>
                        <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-5 py-4 sm:px-6">
                            <button type="button" onClick={() => setViewingRow(null)} className="dots-button-secondary">Close</button>
                        </div>
                    </section>
                )}
            </WorkspaceDialog>

            <WorkspaceDialog open={Boolean(releasingRow)} onClose={closeRelease} labelledBy="release-document-title" width="max-w-3xl" busy={processing || Boolean(releasingRow?.details_loading)}>
                {releasingRow && (
                    <form onSubmit={handleRelease} aria-busy={processing}>
                    <fieldset disabled={processing || Boolean(releasingRow.details_loading)} className="min-w-0">
                        <input type="hidden" name="document_id" value={releasingRow.id ?? ''} />
                        <input type="hidden" name="tracking_number" value={releasingRow.tracking_number ?? ''} />
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                            <div>
                                <h2 id="release-document-title" className="text-lg font-semibold text-foreground">Forward document</h2>
                                <p className="mt-1 text-sm text-muted">Choose where this document should go next.</p>
                            </div>
                            <button type="button" onClick={closeRelease} aria-label="Close forwarding dialog" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                <X size={19} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            {releasingRow.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading attachments…</p>}
                            <DocumentReferenceDetails document={releasingRow} loading={releasingRow.details_loading} />

                            <section className="grid gap-4 sm:grid-cols-2" aria-label="Release details">
                                <div>
                                    <label htmlFor="release-action-type" className="mb-1 block text-sm font-medium text-foreground">Action required <span className="text-danger">*</span></label>
                                    <select id="release-action-type" required value={releaseForm.actionTypeId} onChange={(event) => { setReleaseForm({ ...releaseForm, actionTypeId: event.target.value, otherAction: '' }); setReleaseError(''); }} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10 text-sm">
                                        <option value="">Select action</option>
                                        {actionTypes.map((action) => <option key={`${action.source ?? 'new'}-${action.id}`} value={action.id}>{action.name}</option>)}
                                    </select>
                                </div>
                                {actionTypes.find((action) => String(action.id) === releaseForm.actionTypeId)?.name.trim().toLowerCase() === 'others' && (
                                    <div>
                                        <label htmlFor="release-other-action" className="mb-1 block text-sm font-medium text-foreground">Please specify <span className="text-danger">*</span></label>
                                        <input id="release-other-action" required maxLength={255} value={releaseForm.otherAction} onChange={(event) => { setReleaseForm({ ...releaseForm, otherAction: event.target.value }); setReleaseError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="release-office" className="mb-1 block text-sm font-medium text-foreground">Receiving office <span className="text-danger">*</span></label>
                                    <select id="release-office" required value={releaseForm.officeId} onChange={(event) => { setReleaseForm({ ...releaseForm, officeId: event.target.value }); setReleaseError(''); }} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10 text-sm">
                                        <option value="">{offices.length ? 'Select receiving office' : `No receiving offices available${officeRangeLabel ? ` in ${officeRangeLabel}` : ' in your range'}`}</option>
                                        {offices.map((office) => <option key={office.id} value={office.id} disabled={office.disabled}>{office.name}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="release-remarks" className="mb-1 block text-sm font-medium text-foreground">Remarks</label>
                                    <textarea id="release-remarks" maxLength={250} rows={3} value={releaseForm.remarks} onChange={(event) => setReleaseForm({ ...releaseForm, remarks: event.target.value })} className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm" />
                                    <p className="mt-1 text-right text-xs text-muted">{releaseForm.remarks.length}/250</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="mb-2 text-sm font-medium text-foreground">Document version</p>
                                    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Document version source">
                                        {[['current', 'Keep current document'], ['upload', 'Upload new version'], ['approved', 'Use approved document']].map(([source, label]) => (
                                            <button key={source} type="button" aria-pressed={releaseForm.source === source} onClick={() => { setReleaseForm({ ...releaseForm, source, approvedDraftId: '', file: null }); setReleaseError(''); }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${releaseForm.source === source ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>{label}</button>
                                        ))}
                                    </div>
                                    {releaseForm.source === 'current' && <p className="text-xs text-muted">Forward with the current document version.</p>}
                                    {releaseForm.source === 'upload' && <>
                                        <label htmlFor="release-file" className="mb-1 block text-sm font-medium text-foreground">New version</label>
                                        <input id="release-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setReleaseForm({ ...releaseForm, file: event.target.files?.[0] ?? null }); setReleaseError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                                        <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC, or DOCX. Maximum file size: {uploadLimitKb / 1024} MB.</p>
                                    </>}
                                    {releaseForm.source === 'approved' && <>
                                        <label htmlFor="release-approved-document" className="mb-1 block text-sm font-medium text-foreground">Approved document <span className="text-danger">*</span></label>
                                        <select id="release-approved-document" required value={releaseForm.approvedDraftId} onChange={(event) => { setReleaseForm({ ...releaseForm, approvedDraftId: event.target.value }); setReleaseError(''); }} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10 text-sm">
                                            <option value="">Select an approved document</option>
                                            {approvedDocuments.map((document) => <option key={document.id} value={document.id} disabled={document.disabled}>{document.title} · {document.document_type ?? 'Document'}{document.status === 'registered' ? ' (Previously registered; reusable)' : ''}</option>)}
                                        </select>
                                        <p className="mt-1 text-xs text-muted">{approvedDocuments.length ? 'The selected approved document will be saved as a new version for this transaction. The tracking number, title, and previous versions stay the same.' : 'No approved documents are available for your account.'}</p>
                                    </>}
                                </div>
                            </section>

                            {releaseError && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{releaseError}</p>}
                        </div>

                        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
                            <button type="button" onClick={closeRelease} className="dots-button-secondary">Cancel</button>
                            <button type="submit" className="dots-button-primary">{processing ? 'Forwarding…' : 'Forward document'}</button>
                        </div>
                    </fieldset></form>
                )}
            </WorkspaceDialog>

            <WorkspaceDialog open={Boolean(isCreateOpen || editingRow)} onClose={requestCloseForm} labelledBy="document-modal-title" busy={processing}>
                {(isCreateOpen || editingRow) && (
                    <div>
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                            <div>
                                <h3 id="document-modal-title" className="text-lg font-semibold text-foreground">
                                    {editingRow ? 'Update Document' : 'Add Document'}
                                </h3>
                                <p className="mt-1 text-sm text-muted">{editingRow ? 'Update the document information below.' : 'Enter the details to add a document to the system.'}</p>
                            </div>

                            <button type="button" onClick={requestCloseForm} aria-label="Close document form" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                <X size={19} aria-hidden="true" />
                            </button>
                        </div>

                        <form onSubmit={(event) => { const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; (editingRow ? handleUpdate : handleCreate)(event, submitter?.value === '1'); }} className="space-y-4 px-5 py-5 sm:px-6" aria-busy={processing}>
                            <fieldset disabled={processing} className="min-w-0 space-y-4">
                            {formError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{formError}</p>}
                            {editingRow ? (
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">Tracking Number</label>
                                    <p className="rounded-lg bg-background px-3 py-2 text-sm text-foreground">{editingRow.tracking_number || 'Not assigned'}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-muted">A tracking number will be assigned automatically.</p>
                            )}

                            <div>
                                {!editingRow && <div className="mb-4">
                                    <label htmlFor="document-source-select" className="mb-1 block text-sm font-medium text-foreground">Document source</label>
                                    <div className="flex flex-wrap gap-2" role="group" aria-label="Document source">
                                        <button type="button" onClick={() => setForm({ ...form, document_source: 'upload', approved_draft_id: '', file: null })} className={`rounded-lg border px-3 py-2 text-sm font-medium ${form.document_source === 'upload' ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>Upload a document</button>
                                        <button type="button" onClick={() => setForm({ ...form, document_source: 'approved', approved_draft_id: '', file: null })} className={`rounded-lg border px-3 py-2 text-sm font-medium ${form.document_source === 'approved' ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>Use approved document</button>
                                    </div>
                                </div>}
                                {!editingRow && form.document_source === 'approved' && <div className="mb-4">
                                    <label htmlFor="approved-document-select" className="mb-1 block text-sm font-medium text-foreground">Approved document</label>
                                    <select id="approved-document-select" required value={form.approved_draft_id} onChange={(event) => {
                                        const selected = approvedDocuments.find((document) => String(document.id) === event.target.value);
                                        setForm({ ...form, approved_draft_id: event.target.value, title: selected?.title ?? form.title, document_type_id: selected ? String(selected.document_type_id) : form.document_type_id });
                                    }} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10">
                                        <option value="">Select an approved document</option>
                                        {approvedDocuments.map((document) => <option key={document.id} value={document.id} disabled={document.disabled}>{document.title} · {document.document_type ?? 'Document'}{document.status === 'registered' ? ' (Previously registered; reusable)' : ''}</option>)}
                                    </select>
                                    <p className="mt-1 text-xs text-muted">Each submission creates a new tracking record from this approved document. Release the new record to the intended office.</p>
                                </div>}
                                <label className="mb-1 block text-sm font-medium text-foreground">Title</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    required
                                    className="w-full rounded-lg border border-border px-3 py-2"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">Action Type</label>
                                    <select value={form.action_type_id} onChange={(event) => setForm({ ...form, action_type_id: event.target.value, other_action: '' })} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10">
                                        <option value="">Select action type</option>
                                        {actionTypes.map((action) => <option key={`${action.source ?? 'new'}-${action.id}`} value={action.id}>{action.name}</option>)}
                                    </select>
                                </div>
                                {isOtherAction(form.action_type_id) && (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium text-foreground">Please specify <span className="text-danger">*</span></label>
                                        <input value={form.other_action} onChange={(event) => setForm({ ...form, other_action: event.target.value })} required maxLength={255} className="w-full rounded-lg border border-border px-3 py-2" />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="document-type-select" className="mb-1 block text-sm font-medium text-foreground">Document Type</label>
                                    <select id="document-type-select" value={form.document_type_id} onChange={(event) => setForm({ ...form, document_type_id: event.target.value, other_document_type: '' })} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10">
                                        <option value="">Select document type</option>
                                        {documentTypes.map((option) => <option key={`${option.source ?? 'new'}-${option.id}`} value={option.id}>{option.name}</option>)}
                                    </select>
                                </div>
                                {isOtherOption(form.document_type_id, documentTypes) && (
                                    <div>
                                        <label htmlFor="document-type-other" className="mb-1 block text-sm font-medium text-foreground">Please specify <span className="text-danger">*</span></label>
                                        <input id="document-type-other" value={form.other_document_type} onChange={(event) => setForm({ ...form, other_document_type: event.target.value })} required maxLength={255} className="w-full rounded-lg border border-border px-3 py-2" />
                                    </div>
                                )}
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">Origin Type</label>
                                    <select value={form.origin_type} onChange={(e) => setForm({ ...form, origin_type: e.target.value })} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10">
                                        <option value="">Select origin type</option>
                                        <option value="Internal">Internal</option>
                                        <option value="External">External</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="purpose-type-select" className="mb-1 block text-sm font-medium text-foreground">Purpose</label>
                                    <select id="purpose-type-select" value={form.purpose_type_id} onChange={(event) => setForm({ ...form, purpose_type_id: event.target.value, other_purpose: '' })} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10">
                                        <option value="">Select purpose</option>
                                        {purposeTypes.map((option) => <option key={`${option.source ?? 'new'}-${option.id}`} value={option.id}>{option.name}</option>)}
                                    </select>
                                </div>
                                {isOtherOption(form.purpose_type_id, purposeTypes) && (
                                    <div>
                                        <label htmlFor="purpose-type-other" className="mb-1 block text-sm font-medium text-foreground">Please specify <span className="text-danger">*</span></label>
                                        <input id="purpose-type-other" value={form.other_purpose} onChange={(event) => setForm({ ...form, other_purpose: event.target.value })} required maxLength={255} className="w-full rounded-lg border border-border px-3 py-2" />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Remarks</label>
                                <textarea
                                    value={form.remarks}
                                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                                    rows={4}
                                    className="w-full rounded-lg border border-border px-3 py-2"
                                />
                            </div>

                            {form.document_source === 'upload' && <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">File (optional)</label>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { setForm({ ...form, file: e.target.files?.[0] ?? null }); setUploadError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                                <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC, or DOCX. Maximum file size: {uploadLimitKb / 1024} MB.</p>
                                {uploadError && <p role="alert" className="mt-1 text-sm text-danger">{uploadError}</p>}
                            </div>}
                            <div className="flex flex-wrap gap-5">
                                <label className="inline-flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.checked })} /> Mark as urgent</label>
                                <label className="inline-flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={form.notify_by_email} onChange={(e) => setForm({ ...form, notify_by_email: e.target.checked })} /> Email me</label>
                            </div>

                            <div className="sticky bottom-0 -mx-5 flex flex-wrap justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:-mx-6 sm:px-6">
                                <button
                                    type="button"
                                    onClick={requestCloseForm}
                                    className="dots-button-secondary"
                                >
                                    Cancel
                                </button>

                                <button type="submit" name="is_finalized" value="0" className="dots-button-secondary">Save Draft</button>
                                <button type="submit" name="is_finalized" value="1" className="dots-button-primary">Finalize</button>
                            </div>
                            </fieldset>
                        </form>
                    </div>
                )}
            </WorkspaceDialog>

            {crudAlert && <CrudAlertModal {...crudAlert} onClose={() => setCrudAlert(null)} />}
            {printDocument && <DocumentDispositionPrint document={printDocument} />}
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
            <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10">
                <option value="">Select {label.toLowerCase()}</option>
                {options.map((option) => <option key={`${option.source ?? 'new'}-${option.id}`} value={option.id}>{option.name}</option>)}
            </select>
        </div>
    );
}

function ReadOnlyDetail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-muted">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-foreground">{value || '—'}</p>
        </div>
    );
}

function DocumentReferenceDetails({ document, loading = false }: { document: DocumentItem; loading?: boolean }) {
    return (
        <details className="rounded-lg border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium text-muted">Document details and attachments</summary>
            <section aria-label="Selected document details" className="mt-3 grid gap-x-5 gap-y-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
                <ReadOnlyDetail label="Tracking number" value={document.tracking_number} />
                <ReadOnlyDetail label="Title" value={document.title} />
                <ReadOnlyDetail label="Type" value={getDocumentTypeName(document)} />
                <ReadOnlyDetail label="Purpose" value={getPurposeTypeName(document)} />
                <ReadOnlyDetail label="Origin" value={document.origin_type} />
                <ReadOnlyDetail label="Office" value={document.office_short_name || document.office?.short_name || document.office_name || document.office?.name} />
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-muted">Status</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(document.status)}`}>{(document.status || 'draft').toUpperCase()}</span>
                </div>
                <ReadOnlyDetail label="Created by" value={document.created_by_short_name || document.created_by_name} />
                <ReadOnlyDetail label="Date created" value={document.created_at} />
                <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase text-muted">Remarks</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{document.remarks || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase text-muted">File</p>
                    {document.files?.length ? <ul className="mt-1 space-y-1.5">{document.files.map((file) => <li key={file.id} className="flex flex-wrap items-baseline gap-x-2 text-sm"><span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium uppercase text-muted">{file.type}</span>{file.url ? <a href={file.url} className="break-all font-medium text-primary underline">{file.name}</a> : <span className="break-all text-muted">{file.name} — File not available</span>}{file.uploaded_at && <span className="text-xs text-muted">{file.uploaded_at}</span>}</li>)}</ul> : loading ? null : document.file_url ? <a href={document.file_url} className="mt-1 inline-block break-all text-sm font-medium text-primary underline">{document.file_name || 'Attached file'}</a> : <p className="mt-1 text-sm text-foreground">No file attached.</p>}
                </div>
            </section>
        </details>
    );
}
