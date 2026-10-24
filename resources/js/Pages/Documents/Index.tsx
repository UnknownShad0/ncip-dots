import WorkspaceDialog from '@/Components/WorkspaceDialog';
import DocumentDispositionPrint from '@/Components/DocumentDispositionPrint';
import InfoTip from '@/Components/InfoTip';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { Archive, ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight, Download, Eye, FilePlus2, FileSignature, FileText, GripVertical, Inbox, LoaderCircle, Pencil, Printer, Search, Send, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

export type RouteTreeStep = {
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

export type RouteTree = {
    id: number;
    mode: 'sequential' | 'parallel';
    status: string;
    from_office?: string | null;
    parent_step_id?: number | null;
    steps: RouteTreeStep[];
};

type EditableApprovalRoute = {
    id: number;
    mode: 'sequential' | 'parallel';
    revision: string;
    from_office?: string | null;
    steps: RouteTreeStep[];
};

export type DocumentRouteProgressData = {
    route_tree?: RouteTree[];
    route_steps?: RouteTreeStep[];
    route_mode?: 'sequential' | 'parallel' | null;
    route_status?: string | null;
    route_from_office?: string | null;
    office_short_name?: string | null;
    office_name?: string;
    tracking_number?: string;
    title?: string;
    status?: string;
    transactions?: Array<{
        action?: string | null;
        status?: string | null;
        remarks?: string | null;
        from_office?: string | null;
        from_office_short_name?: string | null;
        holder?: string | null;
        holder_short_name?: string | null;
        created_by?: string | null;
        created_by_short_name?: string | null;
        created_at?: string | null;
    }>;
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
    editable_route?: EditableApprovalRoute | null;
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
    const [releaseOfficeSearch, setReleaseOfficeSearch] = useState('');
    const [draggedOfficeId, setDraggedOfficeId] = useState<string | null>(null);
    const [routeEditingDocument, setRouteEditingDocument] = useState<DocumentItem | null>(null);
    const [routeEditForm, setRouteEditForm] = useState({ officeIds: [] as string[], reason: '' });
    const [routeEditOriginalOfficeIds, setRouteEditOriginalOfficeIds] = useState<string[]>([]);
    const [routeEditSearch, setRouteEditSearch] = useState('');
    const [routeEditError, setRouteEditError] = useState('');
    const [draggedRouteEditOfficeId, setDraggedRouteEditOfficeId] = useState<string | null>(null);
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
        if (!dirty) { setReleasingRow(null); setReleaseOfficeSearch(''); return; }
        setCrudAlert({ title: 'Discard forwarding details?', message: 'Your unsaved changes will be lost.', confirmLabel: 'Discard changes', isDestructive: true, onConfirm: () => { setCrudAlert(null); setReleasingRow(null); setReleaseOfficeSearch(''); } });
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
                setReleaseOfficeSearch('');
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

    const dismissRouteEditor = () => {
        setRouteEditingDocument(null);
        setRouteEditForm({ officeIds: [], reason: '' });
        setRouteEditOriginalOfficeIds([]);
        setRouteEditSearch('');
        setRouteEditError('');
        setDraggedRouteEditOfficeId(null);
    };

    const openRouteEditor = (document: DocumentItem) => {
        const editableRoute = document.editable_route;
        if (!editableRoute) return;
        const officeIds = editableRoute.steps
            .filter((step) => ['available', 'waiting'].includes(step.status))
            .sort((left, right) => left.position - right.position)
            .map((step) => String(step.office_id));
        setRouteEditingDocument(document);
        setRouteEditForm({ officeIds, reason: '' });
        setRouteEditOriginalOfficeIds(officeIds);
        setRouteEditSearch('');
        setRouteEditError('');
        closeDocumentDetails();
    };

    const closeRouteEditor = () => {
        if (processing) return;
        const dirty = routeEditForm.reason.trim() !== ''
            || JSON.stringify(routeEditForm.officeIds) !== JSON.stringify(routeEditOriginalOfficeIds);
        if (!dirty) {
            dismissRouteEditor();
            return;
        }
        setCrudAlert({
            title: 'Discard route changes?',
            message: 'Your unsaved approval route changes will be lost.',
            confirmLabel: 'Discard changes',
            isDestructive: true,
            onConfirm: () => { setCrudAlert(null); dismissRouteEditor(); },
        });
    };

    const toggleRouteEditOffice = (officeId: string) => {
        const lockedCount = routeEditingDocument?.editable_route?.steps.filter((step) => !['available', 'waiting'].includes(step.status)).length ?? 0;
        if (!routeEditForm.officeIds.includes(officeId) && lockedCount + routeEditForm.officeIds.length >= 30) {
            setRouteEditError('A route may contain no more than 30 active offices.');
            return;
        }
        setRouteEditForm((current) => ({
            ...current,
            officeIds: current.officeIds.includes(officeId)
                ? current.officeIds.filter((selected) => selected !== officeId)
                : [...current.officeIds, officeId],
        }));
        setRouteEditError('');
    };

    const moveRouteEditOffice = (officeId: string, direction: -1 | 1) => {
        setRouteEditForm((current) => {
            const currentIndex = current.officeIds.indexOf(officeId);
            const nextIndex = currentIndex + direction;
            if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.officeIds.length) return current;
            const officeIds = [...current.officeIds];
            [officeIds[currentIndex], officeIds[nextIndex]] = [officeIds[nextIndex], officeIds[currentIndex]];
            return { ...current, officeIds };
        });
    };

    const reorderRouteEditOffice = (targetOfficeId: string) => {
        if (!draggedRouteEditOfficeId || draggedRouteEditOfficeId === targetOfficeId) return;
        setRouteEditForm((current) => {
            const officeIds = [...current.officeIds];
            const fromIndex = officeIds.indexOf(draggedRouteEditOfficeId);
            const toIndex = officeIds.indexOf(targetOfficeId);
            if (fromIndex < 0 || toIndex < 0) return current;
            officeIds.splice(fromIndex, 1);
            officeIds.splice(toIndex, 0, draggedRouteEditOfficeId);
            return { ...current, officeIds };
        });
        setDraggedRouteEditOfficeId(null);
    };

    const saveRouteChanges = () => {
        const editableRoute = routeEditingDocument?.editable_route;
        if (!routeEditingDocument?.id || !editableRoute || processing) return;
        if (!routeEditForm.reason.trim()) {
            setRouteEditError('Explain why the approval route is being changed.');
            return;
        }
        setProcessing(true);
        setRouteEditError('');
        router.put(`/documents/${routeEditingDocument.id}/routes/${editableRoute.id}/remaining-steps`, {
            office_ids: routeEditForm.officeIds.map(Number),
            reason: routeEditForm.reason.trim(),
            revision: editableRoute.revision,
        }, {
            preserveScroll: true,
            onFinish: () => setProcessing(false),
            onError: (errors) => setRouteEditError(Object.values(errors).join(' ') || 'Could not update the approval route.'),
            onSuccess: () => {
                dismissRouteEditor();
                setCrudAlert({ title: 'Approval route updated', message: 'The active approval route was updated successfully.' });
            },
        });
    };

    const handleRouteEdit = (event: FormEvent) => {
        event.preventDefault();
        if (!routeEditForm.reason.trim()) {
            setRouteEditError('Explain why the approval route is being changed.');
            return;
        }
        const editableRoute = routeEditingDocument?.editable_route;
        const isParallel = editableRoute?.mode === 'parallel';
        const currentComparison = isParallel ? [...routeEditForm.officeIds].sort() : routeEditForm.officeIds;
        const originalComparison = isParallel ? [...routeEditOriginalOfficeIds].sort() : routeEditOriginalOfficeIds;
        if (JSON.stringify(currentComparison) === JSON.stringify(originalComparison)) {
            setRouteEditError(isParallel ? 'Add or remove at least one unreceived office before saving.' : 'Change at least one remaining office or its position before saving.');
            return;
        }
        const removedAvailableSteps = editableRoute?.steps.filter((step) => step.status === 'available' && !routeEditForm.officeIds.includes(String(step.office_id))) ?? [];
        const sequentialAvailableOfficeId = editableRoute?.steps.find((step) => step.status === 'available')?.office_id;
        const sequentialAvailableChanged = !isParallel && sequentialAvailableOfficeId != null && routeEditForm.officeIds[0] !== String(sequentialAvailableOfficeId);
        if (removedAvailableSteps.length > 0 || sequentialAvailableChanged) {
            setCrudAlert({
                title: removedAvailableSteps.length > 1 ? 'Remove unreceived offices?' : 'Remove the unreceived office?',
                message: isParallel
                    ? `${removedAvailableSteps.length} pending parallel ${removedAvailableSteps.length === 1 ? 'assignment' : 'assignments'} will be cancelled before receipt.`
                    : routeEditForm.officeIds.length > 0
                        ? 'Its pending assignment will be cancelled before receipt, and the first remaining office will become active.'
                        : 'Its pending assignment will be cancelled before receipt. If every locked step is already approved, the route will complete.',
                confirmLabel: 'Update route',
                onConfirm: () => { setCrudAlert(null); saveRouteChanges(); },
            });
            return;
        }
        saveRouteChanges();
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
        setReleaseOfficeSearch('');
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
    const normalizedReleaseOfficeSearch = releaseOfficeSearch.trim().toLocaleLowerCase();
    const filteredReleaseOffices = normalizedReleaseOfficeSearch
        ? offices.filter((office) => office.name.toLocaleLowerCase().includes(normalizedReleaseOfficeSearch))
        : offices;
    const normalizedRouteEditSearch = routeEditSearch.trim().toLocaleLowerCase();
    const filteredRouteEditOffices = normalizedRouteEditSearch
        ? offices.filter((office) => office.name.toLocaleLowerCase().includes(normalizedRouteEditSearch))
        : offices;
    const routeEditIsParallel = routeEditingDocument?.editable_route?.mode === 'parallel';
    const routeEditLockedSteps = routeEditingDocument?.editable_route?.steps
        .filter((step) => !['available', 'waiting'].includes(step.status))
        .sort((left, right) => left.position - right.position) ?? [];
    const routeEditLockedOfficeIds = new Set(routeEditLockedSteps.map((step) => String(step.office_id)));

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
                                <th className="sticky right-0 z-10 border-l border-border bg-background px-3 py-3 text-center font-semibold no-print">Actions</th>
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
                                                <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                                                    {document.can_receive && <button type="button" disabled={processing} aria-label="Receive document" title="Receive document" onClick={() => requestDocumentAction('Receive document?', `Confirm receipt of ${document.tracking_number || 'this document'}?`, 'Receive', () => { setCrudAlert(null); setProcessing(true); router.post(`/documents/${document.id}/receive`, {}, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ variant: 'error', title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Document received', message: 'Document received successfully.' }) }); })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition hover:border-primary/40 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"><Inbox size={17} aria-hidden="true" /></button>}
                                                    {document.can_approve && <button type="button" disabled={processing} aria-label="Review and decide document" title="Review and decide" onClick={() => openDocumentDetails(document)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><FileSignature size={17} aria-hidden="true" /></button>}
                                                    {document.can_release && <button type="button" disabled={processing} aria-label="Forward document" title="Forward document" onClick={() => openRelease(document)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary transition hover:border-primary/40 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"><Send size={17} aria-hidden="true" /></button>}
                                                    {!document.can_approve && !document.can_update && <button type="button" disabled={processing} aria-label="View document details" title="View details" onClick={() => openDocumentDetails(document)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"><Eye size={17} aria-hidden="true" /></button>}
                                                    {document.can_update && <button type="button" disabled={processing} aria-label="Update draft" title="Update draft" onClick={() => openEdit(document)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"><Pencil size={17} aria-hidden="true" /></button>}
                                                    {document.can_terminal && <button type="button" disabled={processing} aria-label="Tag as terminal" title="Tag as terminal" onClick={() => requestDocumentAction('Tag document as terminal?', `Mark ${document.tracking_number || 'this document'} as terminal?`, 'Tag as terminal', () => { setCrudAlert(null); setProcessing(true); router.post(`/documents/${document.id}/terminal`, {}, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ variant: 'error', title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Document updated', message: 'Document tagged as terminal.' }) }); })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"><Archive size={17} aria-hidden="true" /></button>}
                                                    {document.can_delete && <button type="button" disabled={processing} aria-label="Delete draft" title="Delete draft" onClick={() => requestDocumentAction('Delete draft?', `Remove ${document.tracking_number || 'this draft'} from the active list?`, 'Delete draft', () => { setCrudAlert(null); setProcessing(true); router.delete(`/documents/${document.id}`, { onFinish: () => setProcessing(false), onError: (errors) => setCrudAlert({ variant: 'error', title: 'Action could not be completed', message: Object.values(errors).join(' ') }), onSuccess: () => setCrudAlert({ title: 'Draft deleted', message: 'Document draft deleted successfully.' }) }); }, true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-danger/25 bg-danger-soft text-danger transition hover:border-danger/40 hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={17} aria-hidden="true" /></button>}
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
                        <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                            <div>
                                <h2 id="document-details-title" className="break-words text-lg font-semibold text-foreground">{viewingRow.title || 'Document details'}</h2>
                                <p className="mt-1 break-words text-sm text-muted">{viewingRow.tracking_number || 'Tracking number unavailable'}</p>
                            </div>
                            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
                                {viewingRow.editable_route && <button type="button" onClick={() => openRouteEditor(viewingRow)} className="dots-button-secondary px-3" aria-label="Edit remaining approval route"><Pencil size={16} aria-hidden="true" /> Edit route</button>}
                                {viewingRow.is_finalized && <button type="button" onClick={() => printDisposition(viewingRow)} className="dots-button-secondary px-3" aria-label="Print disposition form"><Printer size={16} aria-hidden="true" /> Print disposition</button>}
                                <button type="button" onClick={closeDocumentDetails} aria-label="Close document details" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                    <X size={19} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6" aria-busy={viewingRow.details_loading}>
                            {viewingRow.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading document details and attachments…</p>}
                            {viewingRow.details_error && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{viewingRow.details_error}</p>}
                            <DocumentReferenceDetails document={viewingRow} loading={viewingRow.details_loading} />
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
                            <DocumentRouteProgress document={viewingRow} />
                        </div>
                        <div className="sticky bottom-0 flex justify-end border-t border-border bg-surface px-5 py-4 sm:px-6">
                            <button type="button" onClick={closeDocumentDetails} className="dots-button-secondary">Close</button>
                        </div>
                    </section>
                )}
            </WorkspaceDialog>

            <WorkspaceDialog open={Boolean(routeEditingDocument)} onClose={closeRouteEditor} labelledBy="edit-route-title" width="max-w-3xl" busy={processing}>
                {routeEditingDocument?.editable_route && (
                    <form onSubmit={handleRouteEdit} aria-busy={processing}>
                        <fieldset disabled={processing} className="min-w-0">
                            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-6">
                                <div>
                                    <h2 id="edit-route-title" className="text-lg font-semibold text-foreground">Edit remaining route</h2>
                                    <p className="mt-1 text-sm text-muted">{routeEditIsParallel ? 'Add offices or remove unreceived offices from this parallel approval flow.' : 'Update only the unfinished part of this sequential approval flow.'}</p>
                                </div>
                                <button type="button" onClick={closeRouteEditor} aria-label="Close route editor" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                    <X size={19} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="space-y-6 p-5 sm:p-6">
                                <div className="rounded-xl border border-primary/20 bg-secondary/50 px-4 py-3 text-sm text-foreground">
                                    {routeEditIsParallel
                                        ? <><strong>Parallel approval:</strong> new offices receive the document immediately. Approved and received offices stay locked.</>
                                        : <><strong>Sequential approval:</strong> approved and received offices stay locked. Waiting offices can be added, removed, or reordered.</>}
                                </div>

                                <section aria-labelledby="locked-route-steps-title">
                                    <div className="mb-3">
                                        <h3 id="locked-route-steps-title" className="font-semibold text-foreground">Completed and active offices</h3>
                                        <p className="mt-0.5 text-xs text-muted">These steps are preserved and cannot be edited.</p>
                                    </div>
                                    {routeEditLockedSteps.length > 0 ? <ol className="space-y-2">
                                        {routeEditLockedSteps.map((step, index) => <li key={step.id} className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
                                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold text-muted">{index + 1}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="break-words text-sm font-semibold text-foreground">{step.office}</p>
                                                <p className="mt-0.5 text-xs text-muted">{step.status === 'approved' ? 'Approval completed' : step.status === 'in_progress' ? 'Received and under review' : step.status === 'waiting_on_branch' ? 'Waiting for its child route' : step.status.replaceAll('_', ' ')}</p>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusClasses(step.status)}`}>{step.status.replaceAll('_', ' ')}</span>
                                        </li>)}
                                    </ol> : <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">No locked steps yet.</p>}
                                </section>

                                <section aria-labelledby="remaining-route-steps-title">
                                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                                        <div>
                                            <h3 id="remaining-route-steps-title" className="font-semibold text-foreground">{routeEditIsParallel ? 'Unreceived offices' : 'Remaining offices'}</h3>
                                            <p className="mt-0.5 text-xs text-muted">{routeEditIsParallel ? 'Every selected office can receive and review independently.' : 'The first office is active when no received office is still reviewing.'}</p>
                                        </div>
                                        <span className="text-xs font-medium text-muted">{routeEditLockedSteps.length + routeEditForm.officeIds.length}/30 offices</span>
                                    </div>

                                    <div className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                                        <Search size={17} className="shrink-0" aria-hidden="true" />
                                        <label htmlFor="route-edit-office-search" className="sr-only">Search offices for the remaining route</label>
                                        <input id="route-edit-office-search" type="search" value={routeEditSearch} onChange={(event) => setRouteEditSearch(event.target.value)} placeholder="Search offices…" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted focus:ring-0" />
                                        {routeEditSearch && <button type="button" onClick={() => setRouteEditSearch('')} className="rounded-md p-1 text-muted hover:bg-secondary hover:text-foreground" aria-label="Clear office search"><X size={15} aria-hidden="true" /></button>}
                                    </div>
                                    <div className="grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-2 sm:grid-cols-2">
                                        {filteredRouteEditOffices.map((office) => {
                                            const officeId = String(office.id);
                                            const selected = routeEditForm.officeIds.includes(officeId);
                                            const locked = routeEditLockedOfficeIds.has(officeId);
                                            const unavailable = locked || (Boolean(office.disabled) && !selected)
                                                || (routeEditLockedSteps.length + routeEditForm.officeIds.length >= 30 && !selected);
                                            return <label key={office.id} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${unavailable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${selected ? 'border-primary bg-secondary' : 'border-border bg-surface'}`}>
                                                <input type="checkbox" checked={selected} disabled={unavailable} onChange={() => toggleRouteEditOffice(officeId)} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                                                <span className="text-foreground">{office.name}{locked && <span className="ml-2 text-xs text-muted">Locked</span>}</span>
                                            </label>;
                                        })}
                                        {filteredRouteEditOffices.length === 0 && <p className="p-2 text-sm text-muted sm:col-span-2">No offices match “{routeEditSearch.trim()}”.</p>}
                                    </div>

                                    {routeEditForm.officeIds.length > 0 ? <ol className="mt-4 space-y-2" aria-label="Updated remaining office order">
                                        {routeEditForm.officeIds.map((officeId, index) => {
                                            const office = offices.find((option) => String(option.id) === officeId);
                                            const originalAvailable = routeEditingDocument.editable_route?.steps.find((step) => step.status === 'available' && String(step.office_id) === officeId);
                                            const isPreservedAvailable = Boolean(originalAvailable);
                                            return <li key={officeId} draggable={!routeEditIsParallel} onDragStart={() => !routeEditIsParallel && setDraggedRouteEditOfficeId(officeId)} onDragOver={(event) => { if (!routeEditIsParallel) event.preventDefault(); }} onDrop={() => !routeEditIsParallel && reorderRouteEditOffice(officeId)} onDragEnd={() => setDraggedRouteEditOfficeId(null)} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                                                {!routeEditIsParallel && <GripVertical size={17} className="shrink-0 cursor-grab text-muted" aria-label="Drag to reorder" />}
                                                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white">{routeEditLockedSteps.length + index + 1}</span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="break-words text-sm font-medium text-foreground">{office?.name}</p>
                                                    {isPreservedAvailable && <p className="mt-0.5 text-[11px] font-medium text-primary">Waiting to be received</p>}
                                                    {routeEditIsParallel && !isPreservedAvailable && <p className="mt-0.5 text-[11px] font-medium text-primary">Will be available immediately</p>}
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    {!routeEditIsParallel && <button type="button" disabled={index === 0} onClick={() => moveRouteEditOffice(officeId, -1)} aria-label={`Move ${office?.name} up`} className="rounded-md p-2 text-muted hover:bg-secondary disabled:opacity-30"><ArrowUp size={15} /></button>}
                                                    {!routeEditIsParallel && <button type="button" disabled={index === routeEditForm.officeIds.length - 1} onClick={() => moveRouteEditOffice(officeId, 1)} aria-label={`Move ${office?.name} down`} className="rounded-md p-2 text-muted hover:bg-secondary disabled:opacity-30"><ArrowDown size={15} /></button>}
                                                    <button type="button" onClick={() => toggleRouteEditOffice(officeId)} aria-label={`Remove ${office?.name}`} className="rounded-md p-2 text-muted hover:bg-danger-soft hover:text-danger"><X size={15} /></button>
                                                </div>
                                            </li>;
                                        })}
                                    </ol> : <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">{routeEditIsParallel ? 'No unreceived office selected. The route can finish after all locked active offices approve.' : 'No future office selected. The route can finish after the locked active step is approved.'}</p>}
                                </section>

                                <section className="grid gap-3 rounded-xl border border-border bg-background p-4 sm:grid-cols-2" aria-label="Route change summary">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Before</p>
                                        <p className="mt-1 text-sm text-foreground">{routeEditOriginalOfficeIds.map((officeId) => routeEditingDocument.editable_route?.steps.find((step) => String(step.office_id) === officeId)?.office).filter(Boolean).join(routeEditIsParallel ? ', ' : ' → ') || 'No remaining offices'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">After</p>
                                        <p className="mt-1 text-sm text-foreground">{routeEditForm.officeIds.map((officeId) => offices.find((office) => String(office.id) === officeId)?.name).filter(Boolean).join(routeEditIsParallel ? ', ' : ' → ') || 'No remaining offices'}</p>
                                    </div>
                                </section>

                                <div>
                                    <label htmlFor="route-edit-reason" className="mb-1 block text-sm font-medium text-foreground">Reason for route change <span className="text-danger">*</span></label>
                                    <textarea id="route-edit-reason" required maxLength={1000} rows={3} value={routeEditForm.reason} onChange={(event) => { setRouteEditForm((current) => ({ ...current, reason: event.target.value })); setRouteEditError(''); }} className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm" placeholder="Explain why the remaining approval route needs to change." />
                                    <p className="mt-1 text-right text-xs text-muted">{routeEditForm.reason.length}/1000</p>
                                </div>
                                {routeEditError && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{routeEditError}</p>}
                            </div>

                            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-6">
                                <button type="button" onClick={closeRouteEditor} className="dots-button-secondary">Cancel</button>
                                <button type="submit" className="dots-button-primary">{processing ? 'Saving…' : 'Save route changes'}</button>
                            </div>
                        </fieldset>
                    </form>
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
                            <div className="flex shrink-0 items-center gap-2">
                                {releasingRow.is_finalized && <button type="button" onClick={() => printDisposition(releasingRow)} className="dots-button-secondary px-3" aria-label="Print disposition form"><Printer size={16} aria-hidden="true" /> Print disposition</button>}
                                <button type="button" onClick={closeRelease} aria-label="Close forwarding dialog" className="rounded-lg p-2 text-muted hover:bg-secondary hover:text-foreground">
                                    <X size={19} aria-hidden="true" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-6 p-5 sm:p-6">
                            {releasingRow.details_loading && <p role="status" className="inline-flex items-center gap-2 rounded-lg bg-background p-3 text-sm text-muted"><LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading forwarding details…</p>}
                            <DocumentRouteProgress document={releasingRow} />
                            {releasingRow.forwarding_under && <p className="rounded-xl border border-primary/20 bg-secondary/50 px-4 py-3 text-sm text-foreground"><strong>{releasingRow.forwarding_under}</strong> will remain responsible for its own approval after this branch finishes. Offices already above this branch are disabled; use Request changes to return the document for adjustments.</p>}

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
                                    <p className="mb-2 text-sm font-medium text-foreground">Approval flow</p>
                                    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Approval flow">
                                        {([
                                            ['sequential', 'Sequential approval', 'Offices review in order. The next office receives the document after the current office approves.'],
                                            ['parallel', 'Parallel approval', 'All selected offices receive the document immediately and can review independently.'],
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
                                    <div className="mb-2 flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                                        <Search size={17} className="shrink-0" aria-hidden="true" />
                                        <label htmlFor="release-office-search" className="sr-only">Search required offices</label>
                                        <input id="release-office-search" type="search" value={releaseOfficeSearch} onChange={(event) => setReleaseOfficeSearch(event.target.value)} placeholder="Search offices…" className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-muted focus:ring-0" />
                                        {releaseOfficeSearch && <button type="button" onClick={() => setReleaseOfficeSearch('')} className="rounded-md p-1 text-muted hover:bg-secondary hover:text-foreground" aria-label="Clear office search"><X size={15} aria-hidden="true" /></button>}
                                    </div>
                                    <div className="grid max-h-52 gap-2 overflow-y-auto rounded-xl border border-border bg-background p-2 sm:grid-cols-2">
                                        {filteredReleaseOffices.map((office) => {
                                            const blockedByParentRoute = releasingRow.forwarding_blocked_office_ids?.includes(Number(office.id)) ?? false;
                                            const unavailable = office.disabled || blockedByParentRoute;

                                            return <label key={office.id} className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${unavailable || (releaseForm.officeIds.length >= 30 && !releaseForm.officeIds.includes(String(office.id))) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${releaseForm.officeIds.includes(String(office.id)) ? 'border-primary bg-secondary' : 'border-border bg-surface'}`}>
                                                <input type="checkbox" checked={releaseForm.officeIds.includes(String(office.id))} disabled={unavailable || (releaseForm.officeIds.length >= 30 && !releaseForm.officeIds.includes(String(office.id)))} onChange={() => toggleReleaseOffice(String(office.id))} className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                                                <span className="text-foreground">{office.name}{blockedByParentRoute && <span className="ml-2 text-xs text-muted">Already above</span>}</span>
                                            </label>;
                                        })}
                                        {offices.length === 0 && <p className="p-2 text-sm text-muted">No receiving offices are available{officeRangeLabel ? ` in ${officeRangeLabel}` : ' in your range'}.</p>}
                                        {offices.length > 0 && filteredReleaseOffices.length === 0 && <p className="p-2 text-sm text-muted sm:col-span-2">No offices match “{releaseOfficeSearch.trim()}”.</p>}
                                    </div>
                                    <p className="mt-2 text-xs text-muted">{releaseForm.officeIds.length}/30 offices selected</p>
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
                                    <p className="mt-1 text-xs text-muted">A PDF snapshot with its own tracking number will be attached to this routing record. The generated source remains available for another routing record.</p>
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
                                <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC, or DOCX. Uploaded PDFs receive a QR code and DOTS No. when attached to the routing record; other file types remain unchanged. A source file is required to create a routing record. Maximum file size: {uploadLimitKb / 1024} MB.</p>
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
                                <p className="mt-1 text-xs text-muted">Add up to {maxSupportingFiles} PDF, JPG, PNG, DOC, or DOCX files. Each can be up to {uploadLimitKb / 1024} MB. Supporting PDFs receive the same QR code and DOTS No.; other file types remain unchanged. They are stored separately and are not sent through iPluma signing.</p>
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

export function DocumentRouteProgress({ document }: { document: DocumentRouteProgressData }) {
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
    const terminalTransaction = document.transactions?.find((transaction) => transaction.status?.toLowerCase() === 'terminal');
    if (routes.length === 0 && !terminalTransaction) return null;

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
    const terminalStep: RouteTreeStep | null = terminalTransaction ? {
        id: -1,
        office_id: 0,
        office: terminalTransaction.from_office_short_name || terminalTransaction.from_office || terminalTransaction.holder_short_name || terminalTransaction.holder || originOffice,
        position: allSteps.length + 1,
        status: 'terminal',
        decision: terminalTransaction.action || 'Tagged as Terminal',
        remarks: terminalTransaction.remarks,
        received_by: terminalTransaction.created_by_short_name || terminalTransaction.created_by,
        received_at: terminalTransaction.created_at,
    } : null;
    // When there are routes above the terminal card, the main rail must run
    // continuously from the last route's last step down into the terminal dot.
    const terminalConnected = Boolean(terminalStep) && routes.length > 0;

    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-background" aria-label="Office approval route">
            <div className="border-b border-border bg-gradient-to-br from-primary/10 via-surface to-background p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Route map</p>
                        <h3 className="mt-1 text-base font-semibold text-foreground">Office approval route</h3>
                        <p className="mt-1 text-sm text-muted">Every listed office must approve. Forwarded offices branch off to the side, and the parent office still makes its own decision.</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getStatusClasses(document.status || 'pending')}`}>{statusLabel(document.status || 'pending')}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                    <span><strong className="text-foreground">{allSteps.length}</strong> {allSteps.length === 1 ? 'office' : 'offices'}</span>
                    <span><strong className="text-success">{approvedCount}</strong> approved</span>
                    <span><strong className="text-foreground">{allSteps.length - approvedCount}</strong> remaining</span>
                </div>
                {/* Small legend so the lines are easy to read */}
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted" aria-label="Legend">
                    <span className="inline-flex items-center gap-2"><span className="h-4 w-0 border-l-2 border-solid border-primary/60" aria-hidden="true" />Sequential approval</span>
                    <span className="inline-flex items-center gap-2"><span className="h-4 w-0 border-l-2 border-dashed border-primary/60" aria-hidden="true" />Parallel approval</span>
                    <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-primary bg-primary ring-4 ring-primary/10" aria-hidden="true" />Current</span>
                    <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-success bg-success" aria-hidden="true" />Approved</span>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                <div className="rounded-xl border border-primary/20 bg-surface p-3 sm:p-4">
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

                <div className="mt-5">
                    {routes.length > 0 && <div className="space-y-6">
                        {routes.map((route, index) => <RouteTreeGroup key={route.id} route={route} statusLabel={statusLabel} depth={0} round={index + 1} continues={terminalConnected && index === routes.length - 1} />)}
                    </div>}
                    {terminalStep && <ol className="relative" aria-label="Terminal transaction">
                        <li className={`relative pl-8 ${terminalConnected ? 'pt-3' : ''}`}>
                            {/* Rail from the previous step straight into the terminal dot (12px padding + 23px dot center = 35px) */}
                            {terminalConnected && <span className="absolute left-[6px] top-0 h-[35px] w-0 border-l-2 border-solid border-primary/60" aria-hidden="true" />}
                            <span className={`absolute left-0 h-3.5 w-3.5 rounded-full border-2 border-sidebar bg-sidebar ring-4 ring-sidebar/10 ${terminalConnected ? 'top-7' : 'top-4'}`} aria-hidden="true" />
                            <span className={`absolute left-3.5 h-0.5 w-[18px] bg-border ${terminalConnected ? 'top-[34px]' : 'top-[22px]'}`} aria-hidden="true" />
                            <RouteOfficeCard step={terminalStep} statusLabel={statusLabel} />
                        </li>
                    </ol>}
                </div>
            </div>
        </section>
    );
}
// Git-graph style route tree.
//
// Geometry (keep these in sync if you change sizes):
//   - Every lane has a rail at x = 7px (the `left-[6px]` + 2px border).
//   - Every step dot is 14px (h-3.5 w-3.5) at top-4, so its center is y = 23px.
//   - Cards start at x = 32px (pl-8).
//   - A forwarded branch is rendered INSIDE its parent step's <li>, right under the
//     parent card. It is indented 32px (ml-8), so its rail sits at x = 39px, which is
//     under the parent card. The branch header is 8px top padding + 24px label row
//     + 8px gap = 40px, and a connector rail covers it so the child lane visually
//     drops out of the parent card's bottom edge.
//   - The terminal card (if any) sits right below the last route with 12px top padding;
//     its dot center is at y = 12 + 23 = 35px, and the main rail of the last route
//     continues (`continues`) all the way down to it.
//
// Rows are separated with padding (never margin) so the rail stays continuous.

type RouteStep = RouteTree['steps'][number];

// One color per depth, like colored git lanes. Full class names so Tailwind can see them.
const LANE_BORDER = ['border-primary/60', 'border-sky-500/70', 'border-violet-500/70', 'border-amber-500/70'];
const LANE_TEXT = ['text-primary', 'text-sky-600', 'text-violet-600', 'text-amber-600'];
const LANE_BG = ['bg-primary/5', 'bg-sky-500/10', 'bg-violet-500/10', 'bg-amber-500/10'];

function RouteTreeGroup({ route, statusLabel, depth, round, continues = false }: { route: RouteTree; statusLabel: (status: string) => string; depth: number; round?: number; continues?: boolean }) {
    const isParallel = route.mode === 'parallel';
    const lane = depth % 4;
    const childLane = (depth + 1) % 4;

    return <section aria-label={depth > 0 ? `Forwarded route from ${route.from_office || 'office'}` : `Route round ${round}`}>
        {depth === 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="text-xs font-semibold text-foreground">Route {round}</p>
                <p className="text-[11px] text-muted">{isParallel ? 'Parallel approval · offices can act independently' : 'Sequential approval · next office waits for approval'}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusClasses(route.status)}`}>{statusLabel(route.status)}</span>
        </div>}

        <ol className="relative" aria-label={isParallel ? 'Parallel office branches' : 'Sequential office steps'}>
            {route.steps.map((step, index) => {
                const isFirst = index === 0;
                const isLast = index === route.steps.length - 1;
                const startsAtDot = isFirst && depth === 0;
                // The last step keeps its rail going to the bottom when something (the terminal card) follows this route.
                const runsThrough = isLast && continues;

                // Rail segment for this step. Solid = step by step, dashed = parallel.
                // The rail ends at the dot on the last step, even if that step has children,
                // because the children hang off their own (indented) lane.
                const start = startsAtDot ? 'top-[23px]' : 'top-0';
                const end = isLast && !runsThrough ? 'h-[23px]' : 'bottom-0';
                const rail = startsAtDot && isLast && !runsThrough ? null : <span
                    className={`absolute left-[6px] w-0 border-l-2 ${LANE_BORDER[lane]} ${isParallel ? 'border-dashed' : 'border-solid'} ${start} ${end}`}
                    aria-hidden="true"
                />;

                const isActive = ['in_progress', 'available', 'waiting_on_branch'].includes(step.status);
                const markerClass = step.status === 'approved'
                    ? 'border-success bg-success'
                    : ['rejected', 'changes_requested'].includes(step.status)
                        ? 'border-danger bg-danger'
                        : isActive
                            ? 'border-primary bg-primary ring-4 ring-primary/10'
                            : 'border-border bg-surface';

                const children = step.child_routes ?? [];

                return <li key={step.id} className={`relative pl-8 ${isLast ? '' : 'pb-3'}`}>
                    {rail}
                    <span className={`absolute left-0 top-4 h-3.5 w-3.5 rounded-full border-2 ${markerClass}`} aria-hidden="true" />
                    <span className="absolute left-3.5 top-[22px] h-0.5 w-[18px] bg-border" aria-hidden="true" />
                    <RouteOfficeCard step={step} statusLabel={statusLabel} branch={isParallel} compact={depth > 0} />

                    {/* Forwarded routes: nested under the parent card so they visibly branch from it */}
                    {children.map((child) => {
                        const childParallel = child.mode === 'parallel';
                        const childStyle = `${LANE_BORDER[childLane]} ${childParallel ? 'border-dashed' : 'border-solid'}`;

                        return <div key={child.id} className="relative ml-8 pt-2">
                            {/* Connector: drops from the parent card's bottom edge to the child lane (8 + 24 + 8 = 40px) */}
                            <span className={`absolute left-[6px] top-0 h-10 w-0 border-l-2 ${childStyle}`} aria-hidden="true" />
                            {/* Elbow into the label pill, at the pill's vertical center (8 + 12 = 20px) */}
                            <span className={`absolute left-[7px] top-[19px] w-[25px] border-t-2 ${childStyle}`} aria-hidden="true" />
                            <div className="flex h-8 items-center gap-2 overflow-hidden pb-2 pl-8">
                                <span className={`min-w-0 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${LANE_BG[childLane]} ${LANE_TEXT[childLane]}`}>
                                    Forwarded by {step.office} · {childParallel ? 'Parallel approval' : 'Sequential approval'}
                                </span>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold capitalize leading-none ${getStatusClasses(child.status)}`}>{statusLabel(child.status)}</span>
                            </div>
                            <RouteTreeGroup route={child} statusLabel={statusLabel} depth={depth + 1} />
                        </div>;
                    })}
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
    const isTerminal = step.status === 'terminal';
    const childBranchApproved = step.child_routes?.some((route) => route.status === 'approved');

    return (
        <div className={`rounded-xl border transition-colors ${compact ? 'p-3' : 'p-3.5 sm:p-4'} ${isTerminal ? 'border-sidebar/20 bg-sidebar/5' : isActive ? 'border-primary/40 bg-primary/5 shadow-sm' : step.status === 'approved' ? 'border-success/25 bg-success-soft/30' : 'border-border bg-surface'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className={`grid shrink-0 place-items-center rounded-lg font-bold ${compact ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs'} ${isTerminal ? 'bg-sidebar text-white' : isDecision && step.status === 'approved' ? 'bg-success-soft text-success' : isActive ? 'bg-primary text-white' : 'bg-background text-muted'}`}>{step.position}</span>
                    <div className="min-w-0">
                        <p className={`break-words font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{step.office || 'Office unavailable'}</p>
                        <p className="mt-0.5 text-xs text-muted">{isTerminal ? step.decision || 'Workflow closed' : branch ? `Branch ${step.position}` : `Step ${step.position}`}</p>
                    </div>
                </div>
                <span className={`shrink-0 rounded-full font-semibold capitalize ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${getStatusClasses(step.status)}`}>{statusLabel(step.status)}</span>
            </div>
            {step.status === 'waiting_on_branch' && <p className="mt-3 text-xs text-muted">This office is waiting for its forwarded offices to finish.</p>}
            {childBranchApproved && step.status === 'in_progress' && <p className="mt-3 rounded-lg bg-success-soft/50 px-3 py-2 text-xs font-medium text-success">Forwarded branch complete. This office still needs to approve.</p>}
            {(step.decided_by || step.received_by || step.decided_at || step.received_at) && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-2.5 text-xs text-muted">
                {(step.decided_by || step.received_by) && <span>{isTerminal ? 'Recorded by' : isDecision ? 'Decision by' : 'Received by'} <strong className="font-medium text-foreground">{step.decided_by || step.received_by}</strong></span>}
                {(step.decided_at || step.received_at) && <span>{isTerminal ? 'Recorded' : isDecision ? 'Decided' : 'Received'} {step.decided_at || step.received_at}</span>}
            </div>}
            {step.remarks && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground">{step.remarks}</p>}
        </div>
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
                                            {file.type === 'signed' && <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-medium text-success"><FileSignature size={14} aria-hidden="true" />Signed</span>}
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
