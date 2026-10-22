import WorkspaceDialog from '@/Components/WorkspaceDialog';
import DocumentDispositionPrint from '@/Components/DocumentDispositionPrint';
import InfoTip from '@/Components/InfoTip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { Archive, ArrowDown, ArrowDownUp, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, FilePlus2, FileSignature, FileText, GripVertical, Inbox, LoaderCircle, Pencil, Printer, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

type RouteTreeStep = {
    id: number;
    office_id: number;
    office: string;
    position: number;
    status: string;
    decision?: string | null;
    remarks?: string | null;
    received_by?: string | null;
    received_at?: string | null;
    decided_by?: string | null;
    decided_at?: string | null;
    child_routes?: RouteTree[];
};

type RouteTree = {
    id: number;
    mode: 'sequential' | 'parallel';
    status: string;
    from_office?: string | null;
    parent_step_id?: number | null;
    steps: RouteTreeStep[];
};

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
    files?: Array<{ id: number; name: string; type: 'original' | 'version' | string; url: string | null; view_url?: string | null; is_pdf?: boolean; uploaded_at?: string | null }>;
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
        id?: number;
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
        created_at_timestamp?: number | null;
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
    forwarding_under?: string | null;
    forwarding_blocked_office_ids?: number[];
    can_terminal?: boolean;
    can_receive?: boolean;
    can_delete?: boolean;
    approval_status?: string;
    signature_status?: string;
    can_approve?: boolean;
    revision_draft_id?: number | null;
    route_mode?: 'sequential' | 'parallel' | null;
    route_status?: string | null;
    route_from_office?: string | null;
    route_steps?: Array<{
        id: number;
        office_id: number;
        office: string;
        position: number;
        status: string;
        decision?: string | null;
        remarks?: string | null;
        received_by?: string | null;
        received_at?: string | null;
        decided_by?: string | null;
        decided_at?: string | null;
    }>;
    route_tree?: RouteTree[];
};

type LibraryOption = { id: number | string; name: string; source?: string; disabled?: boolean };
type ApprovedDocument = { id: number; title: string; document_type_id: number; document_type?: string; status?: string; disabled?: boolean };
type CrudAlert = { variant?: WorkspaceAlertVariant; title: string; message: string; onConfirm?: () => void; confirmLabel?: string; isDestructive?: boolean };
type RoutingForm = {
    title: string;
    document_source: string;
    approved_draft_id: string;
    tracking_number: string;
    origin_type: string;
    remarks: string;
    document_type_id: string;
    other_document_type: string;
    action_type_id: string;
    other_action: string;
    purpose_type_id: string;
    other_purpose: string;
    urgent: boolean;
    notify_by_email: boolean;
    signature_required: boolean;
    file: File | null;
    supporting_files: File[];
};

const formFingerprint = (form: RoutingForm) => {
    const fingerprintFile = (file: File | null) => file ? [file.name, file.size, file.lastModified] : null;
    return JSON.stringify({
        ...form,
        file: fingerprintFile(form.file),
        supporting_files: form.supporting_files.map((file) => fingerprintFile(file)),
    });
};

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

const validateSupportingFiles = (files: File[], maxSizeKb: number, maxCount: number): string | null => {
    if (files.length > maxCount) return `Choose no more than ${maxCount} supporting files.`;
    for (const file of files) {
        const error = validateDocumentFile(file, maxSizeKb);
        if (error) return `${file.name}: ${error}`;
    }
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
        case 'done':
            return 'bg-success-soft text-success';
        case 'pending':
        case 'ongoing':
        case 'available':
        case 'waiting':
        case 'in_progress':
        case 'waiting_on_branch':
        case 'paused':
        case 'changes_requested':
            return 'bg-warning-soft text-warning';
        case 'rejected':
        case 'cancelled':
            return 'bg-danger-soft text-danger';
        case 'archived':
        case 'terminal':
            return 'bg-sidebar/10 text-sidebar';
        default:
            return 'bg-slate-100 text-foreground';
    }
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
    maxSupportingFiles = 5,
    editDraftId = null,
    openDocumentId = null,
    createRoutingDraftId = null,
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
    maxSupportingFiles?: number;
    editDraftId?: number | string | null;
    openDocumentId?: number | string | null;
    createRoutingDraftId?: number | string | null;
}) {
    const uploadLimitKb = Number(maxUploadSizeKb ?? 0);
    const [processing, setProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const formBaseline = useRef('');
    const autoOpenedDraftId = useRef<string | null>(null);
    const autoOpenedDocumentId = useRef<string | null>(null);
    const autoOpenedRoutingDraftId = useRef<string | null>(null);
    const [editingRow, setEditingRow] = useState<DocumentItem | null>(null);
    const [crudAlert, setCrudAlert] = useState<CrudAlert | null>(null);
    const [viewingRow, setViewingRow] = useState<DocumentItem | null>(null);
    const [approvalRemarks, setApprovalRemarks] = useState('');
    const [approvalError, setApprovalError] = useState('');
    const [printDocument, setPrintDocument] = useState<DocumentItem | null>(null);
    const [releasingRow, setReleasingRow] = useState<DocumentItem | null>(null);
    const [releaseForm, setReleaseForm] = useState({ actionTypeId: '', otherAction: '', routingMode: 'sequential' as 'sequential' | 'parallel', officeIds: [] as string[], remarks: '', source: 'current', approvedDraftId: '', file: null as File | null });
    const [releaseError, setReleaseError] = useState('');
    const [draggedOfficeId, setDraggedOfficeId] = useState<string | null>(null);
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
    const [form, setForm] = useState<RoutingForm>({
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
        signature_required: false,
        file: null as File | null,
        supporting_files: [],
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

    useEffect(() => { formBaseline.current = formFingerprint(form); }, [isCreateOpen, editingRow]);

    const closeRelease = () => {
        if (processing) return;
        const dirty = releaseForm.source !== 'current' || releaseForm.officeIds.length > 0 || releaseForm.remarks.length > 0
            || Boolean(releaseForm.actionTypeId || releaseForm.otherAction || releaseForm.file);
        if (!dirty) { setReleasingRow(null); return; }
        setCrudAlert({ title: 'Discard forwarding details?', message: 'Your unsaved changes will be lost.', confirmLabel: 'Discard changes', isDestructive: true, onConfirm: () => { setCrudAlert(null); setReleasingRow(null); } });
    };
    const requestCloseForm = () => {
        if (processing) return;
        if (formFingerprint(form) === formBaseline.current) { closeModal(); return; }
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
            signature_required: false,
            file: null,
            supporting_files: [],
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
            signature_required: false,
            file: null,
            supporting_files: [],
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
            signature_required: false,
            file: null,
            supporting_files: [],
        });
    };

    useEffect(() => {
        const requestedId = createRoutingDraftId == null ? '' : String(createRoutingDraftId);
        if (!requestedId || autoOpenedRoutingDraftId.current === requestedId) return;
        const draft = approvedDocuments.find((item) => String(item.id) === requestedId && !item.disabled);
        if (!draft) return;
        autoOpenedRoutingDraftId.current = requestedId;
        openCreate();
        setForm((current) => ({
            ...current,
            document_source: 'approved',
            approved_draft_id: requestedId,
            title: draft.title,
            document_type_id: String(draft.document_type_id),
        }));
    }, [approvedDocuments, createRoutingDraftId]);

    const handleCreate = (e: React.FormEvent, finalize: boolean) => {
        e.preventDefault();
        if (processing) return;
        const fileError = validateDocumentFile(form.file, uploadLimitKb);
        if (fileError) { setUploadError(fileError); return; }
        const supportingFilesError = validateSupportingFiles(form.supporting_files, uploadLimitKb, maxSupportingFiles);
        if (supportingFilesError) { setUploadError(supportingFilesError); return; }
        if (finalize && form.document_source === 'upload' && !form.file) { setUploadError('Attach the source file before creating the routing record.'); return; }
        if (finalize && form.signature_required && !form.file && form.document_source !== 'approved') { setUploadError('Choose a PDF file before marking it as needing a signature.'); return; }
        if (form.signature_required && form.file && !/\.pdf$/i.test(form.file.name)) { setUploadError('Only PDF attachments can be marked as needing a signature.'); return; }

        const data = new FormData();
        const { file, supporting_files, ...fields } = form;
        Object.entries({ ...fields, is_finalized: finalize ? '1' : '0' }).forEach(([key, value]) => {
            if (value !== null && value !== undefined) data.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        });
        if (file) data.append('file', file);
        supporting_files.forEach((supportingFile) => data.append('supporting_files[]', supportingFile));
        setProcessing(true);
        setFormError('');
        router.post('/documents', data, {
            onFinish: () => setProcessing(false),
            onError: (errors) => setFormError(Object.values(errors).join(' ')),
            onSuccess: () => {
                closeModal();
            },
        });
    };

    const handleRelease = (event: FormEvent) => {
        event.preventDefault();
        if (processing) return;
        if (!releasingRow?.id) return;

        const selectedAction = actionTypes.find((action) => String(action.id) === releaseForm.actionTypeId);
        const needsOtherAction = selectedAction?.name.trim().toLowerCase() === 'others';
        if (!releaseForm.actionTypeId || releaseForm.officeIds.length === 0 || (needsOtherAction && !releaseForm.otherAction.trim())) {
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

        if (releaseForm.source === 'upload' && !releaseForm.file) {
            setReleaseError('Choose a file to upload.');
            return;
        }

        const data = new FormData();
        data.append('action_type_id', releaseForm.actionTypeId);
        data.append('other_action', needsOtherAction ? releaseForm.otherAction.trim() : '');
        data.append('routing_mode', releaseForm.routingMode);
        releaseForm.officeIds.forEach((officeId) => data.append('to_office_ids[]', officeId));
        data.append('remarks', releaseForm.remarks);
        data.append('document_source', releaseForm.source);
        if (releaseForm.source === 'upload' && releaseForm.file) data.append('file', releaseForm.file);

        const selectedOffices = releaseForm.officeIds
            .map((officeId) => offices.find((office) => String(office.id) === officeId)?.name)
            .filter((officeName): officeName is string => Boolean(officeName));
        const documentReference = releasingRow.tracking_number || releasingRow.title || 'The document';

        setProcessing(true);
        setReleaseError('');
        router.post(`/documents/${releasingRow.id}/release`, data, {
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setReleasingRow(null);
                setReleaseForm({ actionTypeId: '', otherAction: '', routingMode: 'sequential', officeIds: [], remarks: '', source: 'current', approvedDraftId: '', file: null });
                setReleaseError('');
                setCrudAlert({
                    title: 'Document routed',
                    message: `${documentReference} was sent for ${releaseForm.routingMode} approval to ${selectedOffices.join(', ')}. Every listed office must approve.`,
                });
            },
            onError: (errors) => setReleaseError(Object.values(errors).join(' ') || 'Could not route this document.'),
        });
    };

    const toggleReleaseOffice = (officeId: string) => {
        if (!releaseForm.officeIds.includes(officeId) && releaseForm.officeIds.length >= 30) {
            setReleaseError('Choose no more than 30 offices.');
            return;
        }
        setReleaseForm((current) => ({
            ...current,
            officeIds: current.officeIds.includes(officeId)
                ? current.officeIds.filter((selected) => selected !== officeId)
                : [...current.officeIds, officeId],
        }));
        setReleaseError('');
    };

    const moveReleaseOffice = (officeId: string, direction: -1 | 1) => {
        setReleaseForm((current) => {
            const currentIndex = current.officeIds.indexOf(officeId);
            const nextIndex = currentIndex + direction;
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.officeIds.length) return current;
            const officeIds = [...current.officeIds];
            [officeIds[currentIndex], officeIds[nextIndex]] = [officeIds[nextIndex], officeIds[currentIndex]];
            return { ...current, officeIds };
        });
    };

    const reorderReleaseOffice = (targetOfficeId: string) => {
        if (!draggedOfficeId || draggedOfficeId === targetOfficeId) return;
        setReleaseForm((current) => {
            const officeIds = [...current.officeIds];
            const fromIndex = officeIds.indexOf(draggedOfficeId);
            const toIndex = officeIds.indexOf(targetOfficeId);
            if (fromIndex < 0 || toIndex < 0) return current;
            officeIds.splice(fromIndex, 1);
            officeIds.splice(toIndex, 0, draggedOfficeId);
            return { ...current, officeIds };
        });
        setDraggedOfficeId(null);
    };

    const fetchDocumentDetails = async (document: DocumentItem) => {
        if (document.id == null) throw new Error('Document details are unavailable.');
        const { data } = await axios.get<Partial<DocumentItem>>(route('documents.details', document.id));
        return { ...document, ...data, details_loading: false };
    };

    const openDocumentDetails = async (document: DocumentItem) => {
        setApprovalRemarks('');
        setApprovalError('');
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

    const closeDocumentDetails = () => {
        setViewingRow(null);
        const url = new URL(window.location.href);
        if (url.searchParams.has('open_document_id')) {
            url.searchParams.delete('open_document_id');
            window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
        }
    };

    useEffect(() => {
        const requestedId = openDocumentId == null ? '' : String(openDocumentId);
        if (!requestedId || autoOpenedDocumentId.current === requestedId) return;
        const document = documents.find((item) => String(item.id) === requestedId);
        if (!document) return;
        autoOpenedDocumentId.current = requestedId;
        openDocumentDetails(document);
    }, [documents, openDocumentId]);

    const decideDocument = (decision: 'approved' | 'changes_requested' | 'rejected') => {
        if (!viewingRow?.id || processing) return;
        setProcessing(true);
        setApprovalError('');
        router.post(`/documents/${viewingRow.id}/approval`, { decision, remarks: approvalRemarks }, {
            preserveScroll: true,
            onFinish: () => setProcessing(false),
            onError: (errors) => setApprovalError(Object.values(errors).join(' ')),
            onSuccess: () => {
                closeDocumentDetails();
                setApprovalRemarks('');
                router.visit(route('documents.index'), { replace: true });
            },
        });
    };

    const printDisposition = async (document: DocumentItem) => {
        try {
            setPrintDocument(await fetchDocumentDetails(document));
        } catch {
            setCrudAlert({ variant: 'error', title: 'Could not load document', message: 'The disposition history could not be loaded. Please try again.' });
        }
    };

    const openRelease = async (document: DocumentItem) => {
        setReleasingRow({ ...document, details_loading: true });
        setReleaseForm({ actionTypeId: '', otherAction: '', routingMode: 'sequential', officeIds: [], remarks: '', source: 'current', approvedDraftId: '', file: null });
        setReleaseError('');
        try {
            const details = await fetchDocumentDetails(document);
            setReleasingRow((current) => current?.id === document.id ? details : current);
        } catch {
            setReleasingRow(null);
            setCrudAlert({ variant: 'error', title: 'Could not load document', message: 'Document versions could not be loaded. Please try again.' });
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
                            <option value="changes_requested">Changes requested</option>
                            <option value="rejected">Rejected</option>
                        </select>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="dots-button-accent inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm sm:px-4"
                        >
                            <FilePlus2 size={17} />
                            Route a document
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                    <div className="flex flex-col gap-1 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-semibold text-foreground">Documents</h3>
                        <div className="flex items-center gap-3">
                            {showListUpdating && <p role="status" className="inline-flex items-center gap-1.5 text-xs text-muted"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Updating results…</p>}
                            <p className="text-sm text-muted">{totalDocuments === 0 ? 'No results' : `Showing ${pagination?.from ?? 0}–${pagination?.to ?? 0} of ${totalDocuments} documents`}</p>
                        </div>
                    </div>
                <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Documents table; scroll horizontally for more columns">
                    <table aria-busy={showListUpdating} className="dots-document-table w-full min-w-[880px] table-fixed text-left text-sm">
                    <colgroup><col className="w-[17%]" /><col /><col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[12%]" /><col className="w-[19%]" /><col className="w-36" /></colgroup>
                    <thead className="bg-background text-muted">
                            <tr>
                                <th className="px-3 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('tracking_number')} className="flex items-center gap-1.5 hover:text-primary">
                                        Tracking No. <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-3 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('title')} className="flex items-center gap-1.5 hover:text-primary">
                                        Title <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-3 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('document_type')} className="flex items-center gap-1.5 hover:text-primary">
                                        Document type <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-3 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('origin_type')} className="flex items-center gap-1.5 hover:text-primary">
                                        Origin <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-3 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('status')} className="flex items-center gap-1.5 hover:text-primary">
                                        Status <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="px-3 py-3.5 font-semibold">
                                    <button type="button" onClick={() => handleSort('last_transaction')} className="flex items-center gap-1.5 hover:text-primary">
                                        Last activity <ArrowDownUp size={14} />
                                    </button>
                                </th>
                                <th className="sticky right-0 z-10 border-l border-border bg-background px-3 py-3 font-semibold no-print">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-12 text-center text-muted">
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
                                            <td className="break-words px-3 py-4 text-xs font-semibold text-primary">
                                                <span className="break-all font-mono">{document.tracking_number || 'N/A'}</span>
                                                {document.needs_review && <span className="mt-2 block text-xs font-semibold text-warning">Needs review</span>}
                                                {isUrgent && <span className="mt-2 inline-flex rounded bg-danger-soft px-2 py-0.5 font-sans text-xs font-semibold text-danger">Urgent</span>}
                                                {isLegacy && <span className="mt-1 block font-sans text-xs font-normal text-muted">Legacy</span>}
                                            </td>
                                            <td className="break-words px-3 py-4 font-medium text-foreground">
                                                <button type="button" onClick={() => openDocumentDetails(document)} className="max-w-full break-words text-left font-semibold hover:text-primary hover:underline">{document.title || 'Untitled'}</button>
                                            </td>
                                            <td className="break-words px-3 py-4 text-muted">
                                                {getDocumentTypeName(document) || '—'}
                                            </td>
                                            <td className="break-words px-3 py-4 text-muted">
                                                {document.origin_type || '—'}
                                            </td>
                                            <td className="px-3 py-4">
                                                <span
                                                    className={`inline-block max-w-full break-words rounded-md px-2 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                                                        document.status
                                                    )}`}
                                                >
                                                    {document.status || 'draft'}
                                                </span>
                                            </td>
                                            <td className="break-words px-3 py-3">
                                                {document.last_transaction_summary ? <div className="flex flex-col gap-1.5">
                                                    <span className="text-xs font-medium text-foreground">{document.last_transaction_summary.action || document.last_transaction_summary.status || 'Transaction'}</span>
                                                    <span className="text-xs text-muted">{[document.last_transaction_summary.from_office_short_name || document.last_transaction_summary.from_office, document.last_transaction_summary.to_office_short_name || document.last_transaction_summary.to_office].filter(Boolean).join(' → ') || document.last_transaction_summary.holder_short_name || document.last_transaction_summary.holder || 'Office not recorded'}</span>
                                                    <span className="text-xs text-muted">{document.last_transaction_summary.created_at || document.last_transaction_summary.created_by || '—'}</span>
                                                </div> : <span className="text-sm text-muted">No transactions</span>}
                                            </td>
                                            <td className="sticky right-0 z-10 border-l border-border bg-surface px-3 py-3 no-print">
                                                <div className="flex flex-col gap-2">
                                                    {document.can_receive && <button type="button" disabled={processing} aria-label="Receive document" title="Receive document" onClick={() => requestDocumentAction('Receive document?', `Confirm receipt of ${document.tracking_number || 'this document'}?`, 'Receive', () => { setCrudAlert(null); setProcessing(true); router.post(`/documents/${document.id}/receive`, {}, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ variant: 'error', title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Document received', message: 'Document received successfully.' }) }); })} className="dots-button-secondary w-full px-2 text-primary"><Inbox size={15} /> Receive</button>}
                                                    {document.can_release && <button type="button" disabled={processing} aria-label="Forward document" title="Forward document" onClick={() => openRelease(document)} className="dots-button-secondary w-full px-2 text-primary"><Send size={15} /> Forward</button>}
                                                    <Menu as="div" className="relative">
                                                        <MenuButton disabled={processing} className="dots-button-secondary w-full gap-1 px-2" aria-label={`More actions for ${document.tracking_number || document.title || 'document'}`}>More <ChevronDown size={14} aria-hidden="true" /></MenuButton>
                                                        <MenuItems anchor="bottom end" className="dots-workspace z-50 w-60 rounded-lg border border-border bg-surface p-1 text-foreground shadow-lg">
                                                            <MenuItem><button type="button" disabled={processing} aria-label="View document" title="View document" onClick={() => openDocumentDetails(document)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm data-[focus]:bg-secondary"><Eye size={15} /> View details</button></MenuItem>
                                                            {document.is_finalized && <MenuItem><button type="button" disabled={processing} aria-label="Print disposition form" title="Print disposition form" onClick={() => printDisposition(document)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm data-[focus]:bg-secondary"><Printer size={15} /> Print disposition</button></MenuItem>}
                                                            {document.can_update && <MenuItem><button type="button" disabled={processing} aria-label="Update draft" title="Update draft" onClick={() => openEdit(document)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm data-[focus]:bg-secondary"><Pencil size={15} /> Update draft</button></MenuItem>}
                                                            {document.can_terminal && <MenuItem><button type="button" disabled={processing} aria-label="Tag as terminal" title="Tag as terminal" onClick={() => requestDocumentAction('Tag document as terminal?', `Mark ${document.tracking_number || 'this document'} as terminal?`, 'Tag as terminal', () => { setCrudAlert(null); setProcessing(true); router.post(`/documents/${document.id}/terminal`, {}, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ variant: 'error', title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Document updated', message: 'Document tagged as terminal.' }) }); })} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm data-[focus]:bg-secondary"><Archive size={15} /> Tag as terminal</button></MenuItem>}
                                                            {document.can_delete && <MenuItem><button type="button" disabled={processing} aria-label="Delete draft" title="Delete draft" onClick={() => requestDocumentAction('Delete draft?', `Remove ${document.tracking_number || 'this draft'} from the active list?`, 'Delete draft', () => { setCrudAlert(null); setProcessing(true); router.delete(`/documents/${document.id}`, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ variant: 'error', title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Draft deleted', message: 'Document draft deleted successfully.' }) }); }, true)} className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm data-[focus]:bg-secondary text-danger"><Trash2 size={15} /> Delete draft</button></MenuItem>}
                                                        </MenuItems>
                                                    </Menu>
                                                </div>
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

            <WorkspaceDialog open={Boolean(viewingRow)} onClose={closeDocumentDetails} labelledBy="document-details-title" width="max-w-3xl">
                {viewingRow && (
                    <section>
                        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                            <div>
                                <h2 id="document-details-title" className="break-words text-lg font-semibold text-foreground">{viewingRow.title || 'Document details'}</h2>
                                <p className="mt-1 break-words text-sm text-muted">{viewingRow.tracking_number || 'Tracking number unavailable'}</p>
                            </div>
                            <button type="button" onClick={closeDocumentDetails} aria-label="Close document details" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                <X size={19} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6" aria-busy={viewingRow.details_loading}>
                            {viewingRow.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading transaction history and attachments…</p>}
                            {viewingRow.details_error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{viewingRow.details_error}</p>}
                            <DocumentReferenceDetails document={viewingRow} loading={viewingRow.details_loading} />
                            <DocumentRouteProgress document={viewingRow} />

                            {viewingRow.approval_status && viewingRow.approval_status !== 'not_required' && <section className="rounded-xl border border-border bg-background p-4" aria-label="Approval and signing status">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div><h3 className="font-semibold text-foreground">Approval and signing</h3><p className="mt-1 text-sm text-muted">Approval follows the routing record. Signing applies only to the primary PDF; iPluma submission is not connected yet.</p></div>
                                    <div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(viewingRow.approval_status)}`}>{viewingRow.approval_status.replaceAll('_', ' ')}</span><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold capitalize text-foreground">{(viewingRow.signature_status || 'not_required').replaceAll('_', ' ')}</span></div>
                                </div>
                                {viewingRow.can_approve && <form className="mt-4 space-y-3" onSubmit={(event) => event.preventDefault()}>
                                    <label htmlFor="approval-remarks" className="block text-sm font-medium text-foreground">Remarks</label>
                                    <textarea id="approval-remarks" maxLength={4000} rows={3} value={approvalRemarks} onChange={(event) => setApprovalRemarks(event.target.value)} className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Add a note for this decision" />
                                    {approvalError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{approvalError}</p>}
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <button type="button" disabled={processing} onClick={() => decideDocument('rejected')} className="dots-button-secondary text-danger disabled:opacity-50">Reject</button>
                                        <button type="button" disabled={processing} onClick={() => decideDocument('changes_requested')} className="dots-button-secondary disabled:opacity-50">Request changes</button>
                                        <button type="button" disabled={processing} onClick={() => decideDocument('approved')} className="dots-button-primary disabled:opacity-50">Approve</button>
                                    </div>
                                </form>}
                                {viewingRow.signature_status === 'needs_signature' && viewingRow.approval_status !== 'approved' && <p className="mt-3 text-xs text-muted">Only the primary PDF is eligible; iPluma submission is not connected yet.</p>}
                            </section>}
                            <DocumentTransactionHistory transactions={viewingRow.transactions} loading={viewingRow.details_loading} />
                        </div>
                        <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-5 py-4 sm:px-6">
                            <button type="button" onClick={closeDocumentDetails} className="dots-button-secondary">Close</button>
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
                            <DocumentRouteProgress document={releasingRow} />
                            {releasingRow.forwarding_under && <p className="rounded-xl border border-primary/20 bg-secondary/50 px-4 py-3 text-sm text-foreground"><strong>{releasingRow.forwarding_under}</strong> will remain responsible for its own approval after this branch finishes. Offices already above this branch are disabled; use Request changes to return the document for adjustments.</p>}
                            <DocumentTransactionHistory transactions={releasingRow.transactions} loading={releasingRow.details_loading} />

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
                                <div className="sm:col-span-2">
                                    <p className="mb-2 text-sm font-medium text-foreground">Routing type</p>
                                    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Routing type">
                                        {([
                                            ['sequential', 'Step by step', 'Each office acts after the previous office approves.'],
                                            ['parallel', 'At the same time', 'All offices can review and approve independently.'],
                                        ] as const).map(([mode, label, description]) => (
                                            <button key={mode} type="button" aria-pressed={releaseForm.routingMode === mode} onClick={() => setReleaseForm({ ...releaseForm, routingMode: mode })} className={`rounded-xl border p-3 text-left ${releaseForm.routingMode === mode ? 'border-primary bg-secondary' : 'border-border bg-surface'}`}>
                                                <span className="block text-sm font-semibold text-foreground">{label}</span>
                                                <span className="mt-1 block text-xs text-muted">{description}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs text-muted">Every selected office must approve.</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="mb-2 text-sm font-medium text-foreground">Required offices <span className="text-danger">*</span><span className="ml-2 text-xs font-normal text-muted">Choose up to 30; every selected office must approve.</span></p>
                                    <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-2 sm:grid-cols-2">
                                        {offices.map((office) => {
                                            const blockedByParentRoute = releasingRow.forwarding_blocked_office_ids?.includes(Number(office.id)) ?? false;
                                            const unavailable = office.disabled || blockedByParentRoute;

                                            return <label key={office.id} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${unavailable || (releaseForm.officeIds.length >= 30 && !releaseForm.officeIds.includes(String(office.id))) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${releaseForm.officeIds.includes(String(office.id)) ? 'border-primary bg-secondary' : 'border-border bg-surface'}`}>
                                                <input type="checkbox" checked={releaseForm.officeIds.includes(String(office.id))} disabled={unavailable || (releaseForm.officeIds.length >= 30 && !releaseForm.officeIds.includes(String(office.id)))} onChange={() => toggleReleaseOffice(String(office.id))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                                                <span className="text-foreground">{office.name}{blockedByParentRoute && <span className="ml-2 text-xs text-muted">Already above</span>}</span>
                                            </label>;
                                        })}
                                        {offices.length === 0 && <p className="p-2 text-sm text-muted">No receiving offices are available{officeRangeLabel ? ` in ${officeRangeLabel}` : ' in your range'}.</p>}
                                    </div>
                                </div>
                                {releaseForm.officeIds.length > 0 && (
                                    <div className="sm:col-span-2">
                                        <p className="mb-2 text-sm font-medium text-foreground">Route preview</p>
                                        {releaseForm.routingMode === 'sequential' ? (
                                            <ol className="space-y-2" aria-label="Sequential office order">
                                                {releaseForm.officeIds.map((officeId, index) => {
                                                    const office = offices.find((option) => String(option.id) === officeId);
                                                    return <li key={officeId} draggable onDragStart={() => setDraggedOfficeId(officeId)} onDragOver={(event) => event.preventDefault()} onDrop={() => reorderReleaseOffice(officeId)} onDragEnd={() => setDraggedOfficeId(null)} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                                                        <GripVertical size={17} className="shrink-0 cursor-grab text-muted" aria-label="Drag to reorder" />
                                                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{index + 1}</span>
                                                        <span className="min-w-0 flex-1 break-words text-sm font-medium text-foreground">{office?.name}</span>
                                                        <div className="flex shrink-0 gap-1">
                                                            <button type="button" disabled={index === 0} onClick={() => moveReleaseOffice(officeId, -1)} aria-label={`Move ${office?.name} up`} className="rounded-md p-2 text-muted hover:bg-secondary disabled:opacity-30"><ArrowUp size={15} /></button>
                                                            <button type="button" disabled={index === releaseForm.officeIds.length - 1} onClick={() => moveReleaseOffice(officeId, 1)} aria-label={`Move ${office?.name} down`} className="rounded-md p-2 text-muted hover:bg-secondary disabled:opacity-30"><ArrowDown size={15} /></button>
                                                            <button type="button" onClick={() => toggleReleaseOffice(officeId)} aria-label={`Remove ${office?.name}`} className="rounded-md p-2 text-muted hover:bg-danger-soft hover:text-danger"><X size={15} /></button>
                                                        </div>
                                                    </li>;
                                                })}
                                            </ol>
                                        ) : (
                                            <div className="rounded-xl border border-border bg-background p-4">
                                                <div className="mx-auto w-fit rounded-xl border border-primary bg-surface px-4 py-2 text-sm font-semibold text-foreground">This document</div>
                                                <div className="mx-auto h-6 w-px bg-border" aria-hidden="true" />
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                                    {releaseForm.officeIds.map((officeId) => {
                                                        const office = offices.find((option) => String(option.id) === officeId);
                                                        return <div key={officeId} className="relative rounded-xl border border-primary/40 bg-surface p-3 text-center">
                                                            <span className="absolute -top-3 left-1/2 h-3 w-px -translate-x-1/2 bg-border" aria-hidden="true" />
                                                            <span className="mx-auto mb-2 block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                                                            <p className="break-words text-sm font-semibold text-foreground">{office?.name}</p>
                                                            <p className="mt-1 text-xs text-muted">Required approval</p>
                                                            <button type="button" onClick={() => toggleReleaseOffice(officeId)} className="mt-2 text-xs font-medium text-danger hover:underline">Remove</button>
                                                        </div>;
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="sm:col-span-2">
                                    <label htmlFor="release-remarks" className="mb-1 block text-sm font-medium text-foreground">Remarks</label>
                                    <textarea id="release-remarks" maxLength={250} rows={3} value={releaseForm.remarks} onChange={(event) => setReleaseForm({ ...releaseForm, remarks: event.target.value })} className="w-full resize-y rounded-lg border border-border px-3 py-2 text-sm" />
                                    <p className="mt-1 text-right text-xs text-muted">{releaseForm.remarks.length}/250</p>
                                </div>
                                <div className="sm:col-span-2">
                                    <p className="mb-2 text-sm font-medium text-foreground">Document version</p>
                                    <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Document version source">
                                        {[['current', 'Keep current document'], ['upload', 'Upload new version']].map(([source, label]) => (
                                            <button key={source} type="button" aria-pressed={releaseForm.source === source} onClick={() => { setReleaseForm({ ...releaseForm, source, approvedDraftId: '', file: null }); setReleaseError(''); }} className={`rounded-lg border px-3 py-2 text-sm font-medium ${releaseForm.source === source ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>{label}</button>
                                        ))}
                                    </div>
                                    {releaseForm.source === 'current' && <p className="text-xs text-muted">Forward with the current document version.</p>}
                                    {releaseForm.source === 'upload' && <>
                                        <label htmlFor="release-file" className="mb-1 block text-sm font-medium text-foreground">New version</label>
                                        <input id="release-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { setReleaseForm({ ...releaseForm, file: event.target.files?.[0] ?? null }); setReleaseError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                                        <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC, or DOCX. Maximum file size: {uploadLimitKb / 1024} MB.</p>
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
                                    {editingRow ? 'Update Document' : 'Create Routing Record'}
                                </h3>
                                <p className="mt-1 text-sm text-muted">{editingRow ? 'Update the document information below.' : 'Attach a source document to create its routing record and DOTS tracking number.'}</p>
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
                                <p className="text-sm text-muted">DOTS assigns the tracking number when this routing record is created.</p>
                            )}

                            <div>
                                {!editingRow && <div className="mb-4">
                                    <label htmlFor="document-source-select" className="mb-1 block text-sm font-medium text-foreground">Document source</label>
                                    <div className="flex flex-wrap gap-2" role="group" aria-label="Document source">
                                        <button type="button" onClick={() => setForm({ ...form, document_source: 'upload', approved_draft_id: '', file: null, signature_required: false })} className={`rounded-lg border px-3 py-2 text-sm font-medium ${form.document_source === 'upload' ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>Upload a document</button>
                                        <button type="button" onClick={() => setForm({ ...form, document_source: 'approved', approved_draft_id: '', file: null, signature_required: false })} className={`rounded-lg border px-3 py-2 text-sm font-medium ${form.document_source === 'approved' ? 'border-primary bg-secondary text-primary' : 'border-border bg-surface text-foreground'}`}>Use generated document</button>
                                    </div>
                                </div>}
                                {!editingRow && form.document_source === 'approved' && <div className="mb-4">
                                    <label htmlFor="approved-document-select" className="mb-1 block text-sm font-medium text-foreground">Generated document</label>
                                    <select id="approved-document-select" required value={form.approved_draft_id} onChange={(event) => {
                                        const selected = approvedDocuments.find((document) => String(document.id) === event.target.value);
                                        setForm({ ...form, approved_draft_id: event.target.value, title: selected?.title ?? form.title, document_type_id: selected ? String(selected.document_type_id) : form.document_type_id });
                                    }} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10">
                                        <option value="">Select a generated document</option>
                                        {approvedDocuments.map((document) => <option key={document.id} value={document.id} disabled={document.disabled}>{document.title} · {document.document_type ?? 'Document'}</option>)}
                                    </select>
                                    <p className="mt-1 text-xs text-muted">This file will be attached to the new routing record, and its assigned tracking number will be printed on the PDF before review.</p>
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
                                <label className="mb-1 block text-sm font-medium text-foreground">Source file</label>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(e) => { const file = e.target.files?.[0] ?? null; setForm({ ...form, file, signature_required: file && !/\.pdf$/i.test(file.name) ? false : form.signature_required }); setUploadError(''); }} className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
                                <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC, or DOCX. Uploaded PDFs receive a DOTS tracking-number stamp when attached to the routing record; other file types remain unchanged. A source file is required to create a routing record. Maximum file size: {uploadLimitKb / 1024} MB.</p>
                            </div>}
                            {!editingRow && <div>
                                <label htmlFor="supporting-files" className="mb-1 block text-sm font-medium text-foreground">Supporting files <span className="font-normal text-muted">(optional)</span></label>
                                <input
                                    id="supporting-files"
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={(event) => {
                                        const files = Array.from(event.currentTarget.files ?? []);
                                        const error = validateSupportingFiles(files, uploadLimitKb, maxSupportingFiles);
                                        if (error) {
                                            setUploadError(error);
                                            event.currentTarget.value = '';
                                            return;
                                        }
                                        setForm((current) => ({ ...current, supporting_files: files }));
                                        setUploadError('');
                                    }}
                                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                                />
                                <p className="mt-1 text-xs text-muted">Add up to {maxSupportingFiles} PDF, JPG, PNG, DOC, or DOCX files. Each can be up to {uploadLimitKb / 1024} MB. They are stored separately and are not sent through iPluma signing.</p>
                                {form.supporting_files.length > 0 && <ul className="mt-3 space-y-2" aria-label="Selected supporting files">
                                    {form.supporting_files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                                        <span className="min-w-0 break-all text-foreground">{file.name}<span className="ml-2 text-xs text-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span></span>
                                        <button type="button" onClick={() => setForm((current) => ({ ...current, supporting_files: current.supporting_files.filter((_, fileIndex) => fileIndex !== index) }))} className="shrink-0 rounded-md p-1 text-muted hover:bg-secondary hover:text-foreground" aria-label={`Remove ${file.name}`} title="Remove file"><X size={16} aria-hidden="true" /></button>
                                    </li>)}
                                </ul>}
                            </div>}
                            {uploadError && <p role="alert" className="text-sm text-danger">{uploadError}</p>}
                            {!editingRow && <div className="rounded-lg border border-border bg-background p-3">
                                <label className={`flex items-start gap-3 text-sm ${form.document_source === 'approved' || form.file?.name.toLowerCase().endsWith('.pdf') ? 'text-foreground' : 'text-muted'}`}>
                                    <input type="checkbox" checked={form.signature_required} disabled={form.document_source !== 'approved' && !form.file?.name.toLowerCase().endsWith('.pdf')} onChange={(event) => setForm({ ...form, signature_required: event.target.checked })} className="mt-0.5 rounded border-border" />
                                    <span><span className="font-medium">Needs iPluma signing after approval</span><span className="mt-0.5 block text-xs text-muted">Applies to the primary PDF only. iPluma submission is not connected yet.</span></span>
                                </label>
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

                                <button type="submit" name="is_finalized" value="1" className="dots-button-primary">Create Routing Record</button>
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

function DocumentRouteProgress({ document }: { document: DocumentItem }) {
    const routes: RouteTree[] = document.route_tree?.length
        ? document.route_tree
        : document.route_steps?.length
            ? [{
                id: 0,
                mode: document.route_mode || 'sequential',
                status: document.route_status || 'pending',
                from_office: document.route_from_office,
                steps: document.route_steps.map((step) => ({ ...step, child_routes: [] })),
            }]
            : [];
    if (routes.length === 0) return null;

    const statusLabel = (status: string) => ({
        waiting: 'Waiting',
        available: 'Waiting to receive',
        in_progress: 'In progress',
        waiting_on_branch: 'Waiting on branch',
        approved: 'Approved',
        changes_requested: 'Changes requested',
        rejected: 'Rejected',
        paused: 'Paused',
    }[status] ?? status.replaceAll('_', ' '));
    const collectSteps = (items: RouteTree[]): RouteTreeStep[] => items.flatMap((route) => route.steps.flatMap((step) => [step, ...collectSteps(step.child_routes ?? [])]));
    const allSteps = collectSteps(routes);
    const approvedCount = allSteps.filter((step) => step.status === 'approved').length;
    const rootRoute = routes[routes.length - 1];
    const originOffice = document.route_from_office || rootRoute?.from_office || document.office_short_name || document.office_name || 'Originating office';

    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-background" aria-label="Office approval route">
            <div className="border-b border-border bg-gradient-to-br from-primary/10 via-surface to-background p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Route map</p>
                        <h3 className="mt-1 text-base font-semibold text-foreground">Office approval route</h3>
                        <p className="mt-1 text-sm text-muted">Every listed office must approve. Forwarded offices appear as smaller branches, and the parent office still makes its own decision.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getStatusClasses(document.status || 'pending')}`}>{statusLabel(document.status || 'pending')}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                    <span><strong className="text-foreground">{allSteps.length}</strong> {allSteps.length === 1 ? 'office' : 'offices'}</span>
                    <span><strong className="text-success">{approvedCount}</strong> approved</span>
                    <span><strong className="text-foreground">{allSteps.length - approvedCount}</strong> remaining</span>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                <div className="relative rounded-xl border border-primary/20 bg-surface p-3 sm:p-4">
                    <span className="absolute -bottom-5 left-[7px] h-5 w-px bg-primary/40" aria-hidden="true" />
                    <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white"><FileText size={19} aria-hidden="true" /></span>
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Route started from</p>
                            <p className="break-words text-sm font-semibold text-foreground">{originOffice}</p>
                            <p className="mt-0.5 break-all font-mono text-xs text-muted">{document.tracking_number || document.title}</p>
                        </div>
                        <span className="ml-auto hidden rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold capitalize text-primary sm:inline-flex">{routes.length} {routes.length === 1 ? 'route' : 'routes'}</span>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    {routes.map((route, index) => <RouteTreeGroup key={route.id} route={route} statusLabel={statusLabel} depth={0} round={index + 1} />)}
                </div>
            </div>
        </section>
    );
}

function RouteTreeGroup({ route, statusLabel, depth, round }: { route: RouteTree; statusLabel: (status: string) => string; depth: number; round?: number }) {
    const isParallel = route.mode === 'parallel';

    return <section className={depth > 0 ? 'rounded-xl border border-border bg-background p-3 sm:p-4' : ''} aria-label={depth > 0 ? `Forwarded route from ${route.from_office || 'office'}` : `Route round ${round}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="text-xs font-semibold text-foreground">{depth > 0 ? `${isParallel ? 'Parallel branch' : 'Step by step branch'}` : `Route ${round}`}</p>
                <p className="text-[11px] text-muted">{isParallel ? 'Parallel · offices can act independently' : 'Step by step · next office waits for approval'}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusClasses(route.status)}`}>{statusLabel(route.status)}</span>
        </div>
        <ol className={`relative space-y-3 pl-7 ${depth > 0 ? '-ml-[38px] sm:-ml-[46px]' : ''}`} aria-label={isParallel ? 'Parallel office branches' : 'Sequential office steps'}>
            {depth === 0 && route.steps.length > 1 && <span className="absolute bottom-5 left-[7px] top-5 w-px bg-gradient-to-b from-primary/40 via-border to-border" aria-hidden="true" />}
            {route.steps.map((step) => {
                const isActive = ['in_progress', 'available', 'waiting_on_branch'].includes(step.status);
                const markerClass = step.status === 'approved'
                    ? 'border-success bg-success'
                    : ['rejected', 'changes_requested'].includes(step.status)
                        ? 'border-danger bg-danger'
                        : isActive
                            ? 'border-primary bg-primary ring-4 ring-primary/10'
                            : 'border-border bg-surface';

                return <li key={step.id} className="relative">
                    <span className={`absolute -left-[28px] top-5 z-[1] h-3.5 w-3.5 rounded-full border-2 ${markerClass}`} aria-hidden="true" />
                    <span className={`absolute -left-[21px] top-[26px] border-t border-border ${depth > 0 ? 'w-[59px] sm:w-[67px]' : 'w-[21px]'}`} aria-hidden="true" />
                    <div className={depth > 0 ? 'ml-[38px] sm:ml-[46px]' : ''}><RouteOfficeCard step={step} statusLabel={statusLabel} branch={isParallel} compact={depth > 0} /></div>
                    {step.child_routes?.length ? <div className="relative ml-5 mt-3 border-l-2 border-primary/55 pl-4 sm:ml-6 sm:pl-5">
                        <span className="absolute -left-[2px] -top-3 h-3 border-l-2 border-primary/55" aria-hidden="true" />
                        <span className="absolute -left-[41px] top-0 w-[41px] border-t-2 border-primary/55 sm:-left-[45px] sm:w-[45px]" aria-hidden="true" />
                        <p className="mb-2 inline-flex rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">Forwarded by {step.office}</p>
                        <div className="space-y-3">{step.child_routes.map((child) => <RouteTreeGroup key={child.id} route={child} statusLabel={statusLabel} depth={depth + 1} />)}</div>
                    </div> : null}
                </li>;
            })}
        </ol>
    </section>;
}

function RouteOfficeCard({
    step,
    statusLabel,
    branch = false,
    compact = false,
}: {
    step: RouteTreeStep;
    statusLabel: (status: string) => string;
    branch?: boolean;
    compact?: boolean;
}) {
    const isActive = ['available', 'in_progress', 'waiting_on_branch'].includes(step.status);
    const isDecision = ['approved', 'changes_requested', 'rejected'].includes(step.status);
    const childBranchApproved = step.child_routes?.some((route) => route.status === 'approved');

    return (
        <div className={`rounded-xl border transition-colors ${compact ? 'p-3' : 'p-3.5 sm:p-4'} ${isActive ? 'border-primary/40 bg-primary/5 shadow-sm' : step.status === 'approved' ? 'border-success/25 bg-success-soft/30' : 'border-border bg-surface'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid shrink-0 place-items-center rounded-lg font-bold ${compact ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs'} ${isDecision && step.status === 'approved' ? 'bg-success-soft text-success' : isActive ? 'bg-primary text-white' : 'bg-background text-muted'}`}>{step.position}</span>
                    <div className="min-w-0">
                        <p className={`break-words font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{step.office || 'Office unavailable'}</p>
                        <p className="mt-0.5 text-xs text-muted">{branch ? `Branch ${step.position}` : `Step ${step.position}`}</p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full font-semibold capitalize ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${getStatusClasses(step.status)}`}>{statusLabel(step.status)}</span>
            </div>
            {step.status === 'waiting_on_branch' && <p className="mt-3 text-xs text-muted">This office is waiting for its forwarded offices to finish.</p>}
            {childBranchApproved && step.status === 'in_progress' && <p className="mt-3 rounded-lg bg-success-soft/50 px-3 py-2 text-xs font-medium text-success">Forwarded branch complete. This office still needs to approve.</p>}
            {(step.decided_by || step.received_by || step.decided_at || step.received_at) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-muted">
                {(step.decided_by || step.received_by) && <span>{isDecision ? 'Decision by' : 'Received by'} <strong className="font-medium text-foreground">{step.decided_by || step.received_by}</strong></span>}
                {(step.decided_at || step.received_at) && <span>{isDecision ? 'Decided' : 'Received'} {step.decided_at || step.received_at}</span>}
            </div>}
            {step.remarks && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground">{step.remarks}</p>}
        </div>
    );
}

function DocumentTransactionHistory({ transactions, loading = false }: { transactions?: DocumentItem['transactions']; loading?: boolean }) {
    return (
        <section aria-label="Transaction history">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                    <h3 className="font-semibold text-foreground">Activity timeline</h3>
                    <p className="mt-0.5 text-xs text-muted">Newest activity appears first.</p>
                </div>
                <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted">{transactions?.length ?? 0} events</span>
            </div>
            {transactions?.length ? (
                <ol className="relative space-y-3" aria-label="Document activity, newest first">
                    {transactions.map((transaction, index) => {
                        const fromOffice = transaction.from_office_short_name || transaction.from_office;
                        const toOffice = transaction.to_office_short_name || transaction.to_office;
                        const holder = transaction.holder_short_name || transaction.holder;
                        const actor = transaction.created_by_short_name || transaction.created_by;
                        const movedBetweenOffices = Boolean(fromOffice && toOffice && fromOffice !== toOffice);
                        const eventOffice = toOffice || fromOffice;

                        return <li key={`${transaction.created_at ?? 'transaction'}-${index}`} className="relative pl-7">
                            {index < transactions.length - 1 && <span className="absolute bottom-[-14px] left-[9px] top-3 w-0.5 bg-gradient-to-b from-primary/40 to-border" aria-hidden="true" />}
                            <span className={`absolute left-0 top-3 h-[19px] w-[19px] rounded-full border-[5px] border-surface ring-1 ring-border ${transaction.status === 'approved' ? 'bg-success' : ['rejected', 'changes_requested'].includes(transaction.status ?? '') ? 'bg-danger' : 'bg-primary'}`} aria-hidden="true" />
                            <article className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h4 className="break-words text-sm font-semibold text-foreground">{transaction.action || transaction.status || 'Document activity'}</h4>
                                        {transaction.status && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusClasses(transaction.status)}`}>{transaction.status.replaceAll('_', ' ')}</span>}
                                    </div>
                                    <time className="shrink-0 text-xs text-muted">{transaction.created_at || 'Date unavailable'}</time>
                                </div>
                                {(fromOffice || toOffice || holder) && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs">
                                    {movedBetweenOffices ? <span className="font-medium text-foreground"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted">From</span>{fromOffice}</span> : eventOffice ? <span className="font-medium text-foreground"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted">At</span>{eventOffice}</span> : holder && <span className="text-muted">Current holder: <strong className="font-medium text-foreground">{holder}</strong></span>}
                                    {movedBetweenOffices && <span className="text-primary" aria-label="to">→</span>}
                                    {movedBetweenOffices && toOffice && <span className="font-medium text-foreground"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-muted">To</span>{toOffice}</span>}
                                </div>}
                                {(actor || transaction.remarks) && <div className="mt-3 space-y-2 text-xs text-muted">
                                    {actor && <p>Action recorded by <strong className="font-medium text-foreground">{actor}</strong></p>}
                                    {transaction.remarks && <div className="rounded-lg border border-border bg-background px-3 py-2"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Remark</p><p className="whitespace-pre-wrap break-words leading-relaxed text-foreground">{transaction.remarks}</p></div>}
                                </div>}
                            </article>
                        </li>;
                    })}
                </ol>
            ) : loading ? null : <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No transactions recorded.</p>}
        </section>
    );
}

function ReadOnlyDetail({ label, value }: { label: string; value?: string | null }) {
    return (
        <div role="row" className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
            <p role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p role="cell" className="break-words text-sm font-medium text-foreground">{value || '—'}</p>
        </div>
    );
}

function DocumentReferenceDetails({ document, loading = false }: { document: DocumentItem; loading?: boolean }) {
    return (
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-foreground">Document details and attachments</h3>
            <section role="table" aria-label="Selected document details" className="mt-3 divide-y divide-border rounded-xl border border-border bg-background px-3 py-1 sm:px-4">
                <ReadOnlyDetail label="Tracking number" value={document.tracking_number} />
                <ReadOnlyDetail label="Title" value={document.title} />
                <ReadOnlyDetail label="Type" value={getDocumentTypeName(document)} />
                <ReadOnlyDetail label="Purpose" value={getPurposeTypeName(document)} />
                <ReadOnlyDetail label="Origin" value={document.origin_type} />
                <ReadOnlyDetail label="Office" value={document.office_short_name || document.office?.short_name || document.office_name || document.office?.name} />
                <div role="row" className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                    <p role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted">Status</p>
                    <span role="cell" className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClasses(document.status)}`}>{(document.status || 'draft').toUpperCase()}</span>
                </div>
                <ReadOnlyDetail label="Approval" value={(document.approval_status || 'not_required').replaceAll('_', ' ')} />
                <ReadOnlyDetail label="Signing" value={(document.signature_status || 'not_required').replaceAll('_', ' ')} />
                <ReadOnlyDetail label="Created by" value={document.created_by_short_name || document.created_by_name} />
                <ReadOnlyDetail label="Date created" value={document.created_at} />
                <div role="row" className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-3 py-2 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
                    <p role="rowheader" className="text-xs font-semibold uppercase tracking-wide text-muted">Remarks</p>
                    <p role="cell" className="whitespace-pre-wrap break-words text-sm text-foreground">{document.remarks || '—'}</p>
                </div>
                </section>
                <div className="mt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-semibold text-foreground">Attached files</p>
                        {document.signature_status && document.signature_status !== 'not_required' && <p className="text-xs text-muted">Signing applies to the primary document only. iPluma PDF submission is not connected yet.</p>}
                    </div>
                    {document.files?.length ? (
                        <ul className="mt-3 space-y-2">
                            {document.files.map((file) => (
                                <li key={file.id} className="rounded-xl border border-border bg-surface p-3 sm:p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className="mt-0.5 rounded-lg bg-secondary p-2 text-primary"><FileText size={17} aria-hidden="true" /></span>
                                            <div className="min-w-0">
                                                <p className="break-words text-sm font-semibold text-foreground">{file.name}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                                                    <span>{file.type === 'original' ? 'Primary document' : file.type === 'supporting' ? 'Supporting file' : file.type}</span>
                                                    {file.is_pdf && <><span aria-hidden="true">·</span><span>PDF</span></>}
                                                    {file.uploaded_at && <><span aria-hidden="true">·</span><span>{file.uploaded_at}</span></>}
                                                    {!file.url && !file.view_url && <span className="text-warning">File not available</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                                            {file.view_url && <a href={file.view_url} target="_blank" rel="noopener noreferrer" className="dots-button-secondary min-h-9 px-3 py-1.5 text-xs"><Eye size={14} aria-hidden="true" />View</a>}
                                            {file.url && <a href={file.url} className="dots-button-secondary min-h-9 px-3 py-1.5 text-xs"><Download size={14} aria-hidden="true" />Download</a>}
                                            {file.type === 'original' && file.is_pdf && document.signature_status === 'needs_signature' && <button type="button" disabled title={document.approval_status === 'approved' ? 'iPluma file submission is not connected yet.' : 'Available after approval.'} className="dots-button-secondary min-h-9 px-3 py-1.5 text-xs"><FileSignature size={14} aria-hidden="true" />Sign with iPluma</button>}
                                            {file.type === 'original' && file.is_pdf && document.signature_status === 'sent_to_ipluma' && <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning"><FileSignature size={14} aria-hidden="true" />Sent to iPluma</span>}
                                            {file.type === 'original' && file.is_pdf && document.signature_status === 'signed' && <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-medium text-success"><FileSignature size={14} aria-hidden="true" />Signed</span>}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : loading ? null : document.file_url ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="break-all text-sm font-medium text-foreground">{document.file_name || 'Attached file'}</span>
                            <a href={document.file_url} className="dots-button-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs"><Download size={14} aria-hidden="true" />Download</a>
                        </div>
                    ) : <p className="mt-1 text-sm text-foreground">No file attached.</p>}
                </div>
        </section>
    );
}
