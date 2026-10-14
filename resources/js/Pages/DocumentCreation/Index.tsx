import WorkspaceDialog from "@/Components/WorkspaceDialog";
import WorkspaceAlert from "@/Components/WorkspaceAlert";
import InfoTip from "@/Components/InfoTip";
import {
    Search,
    FilePlus2,
    Save,
    Send,
    Pencil,
    Clock3,
    CircleCheck,
    CircleAlert,
    CircleX,
    FileCheck2,
    CircleHelp,
    Eye,
    type LucideIcon,
} from "lucide-react";
import DocumentPaper, { type DocumentTemplate } from "@/Components/PaginatedDocument";
import DocumentPdfPreview from "@/Components/DocumentPdfPreview";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import { FormEvent, useEffect, useState } from "react";

type Draft = {
    id: number;
    title: string;
    status: string;
    content: Record<string, any>;
    document_type_id: number;
    version_number: number;
    created_by: number;
    approver_id?: number;
    approver_office_id?: number;
    approver_office?: { name: string; short_name?: string | null };
    decision_maker?: { name: string; short_name?: string };
    can_decide?: boolean;
    decision_remarks?: string;
    verification_notes?: string;
    verified_file_name?: string;
    official_document_id?: number;
    creator?: { name: string; short_name?: string };
    approver?: { name: string; short_name?: string };
    document_type?: { name: string };
    current_submission?: {
        version_number: number;
        content: Record<string, any>;
        submitted_at: string;
    } | null;
    events?: {
        event: string;
        remarks?: string;
        created_at: string;
        user?: {
            name: string;
            short_name?: string;
            office_short_name?: string | null;
        };
    }[];
};
type PaginationSummary = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
};
type ListFilters = {
    queue?: string;
    my_search?: string;
    my_status?: string;
    approval_search?: string;
    search?: string;
    status?: string;
    my_page?: number;
    approval_page?: number;
    page?: number;
};
type Option = {
    id: number | string;
    name: string;
    short_name?: string | null;
    role?: string;
    source?: string;
    disabled?: boolean;
    template?: DocumentTemplate;
    template_error?: string;
    sample_content?: Record<string, any> | null;
};
const blank = {
    for: "",
    thru: "",
    attention: "",
    from: "",
    subject: "",
    date: new Date().toISOString().slice(0, 10),
    body: "",
    cc: [] as string[],
};

const statusPresentation: Record<
    string,
    { label: string; className: string; Icon: LucideIcon }
> = {
    draft: { label: "Draft", className: "bg-slate-100 text-slate-700", Icon: Pencil },
    pending_approval: { label: "Awaiting approval", className: "bg-warning-soft text-warning", Icon: Clock3 },
    revision_requested: { label: "Returned for revision", className: "bg-warning-soft text-warning", Icon: CircleAlert },
    rejected: { label: "Rejected", className: "bg-danger-soft text-danger", Icon: CircleX },
    approved: { label: "Approved", className: "bg-success-soft text-success", Icon: CircleCheck },
    awaiting_verification: { label: "Awaiting verification", className: "bg-warning-soft text-warning", Icon: Clock3 },
    verified: { label: "Verified", className: "bg-success-soft text-success", Icon: FileCheck2 },
    registered: { label: "Registered", className: "bg-success-soft text-success", Icon: CircleCheck },
};

function DraftStatusBadge({ status }: { status: string }) {
    const presentation = statusPresentation[status] ?? {
        label: status.replaceAll("_", " "),
        className: "bg-slate-100 text-slate-700",
        Icon: CircleHelp,
    };
    const Icon = presentation.Icon;

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.className}`}>
            <Icon size={14} aria-hidden="true" />
            {presentation.label}
        </span>
    );
}

function DraftListSection({
    id,
    title,
    emptyMessage,
    mode,
    drafts,
    pagination,
    currentUserId,
    saving,
    search,
    onSearchChange,
    onSearchSubmit,
    status = "all",
    statusOptions,
    onStatusChange,
    onPageChange,
    onEdit,
    onSubmitApproval,
    onReview,
    onRegister,
}: {
    id: string;
    title: string;
    emptyMessage: string;
    mode: "work" | "approval" | "approved";
    drafts: Draft[];
    pagination: PaginationSummary;
    currentUserId: number;
    saving: boolean;
    search: string;
    onSearchChange: (value: string) => void;
    onSearchSubmit: () => void;
    status?: string;
    statusOptions?: [string, string][];
    onStatusChange?: (value: string) => void;
    onPageChange: (page: number) => void;
    onEdit?: (draft: Draft) => void;
    onSubmitApproval?: (draft: Draft) => void;
    onReview?: (draft: Draft) => void;
    onRegister?: (draft: Draft) => void;
}) {
    return (
        <section id={id} className="scroll-mt-6 rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                    {title}{" "}
                    <span className="ml-1 text-sm font-normal text-muted">({pagination.total})</span>
                </h2>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <form onSubmit={(event: FormEvent) => { event.preventDefault(); onSearchSubmit(); }} className="flex gap-2">
                        <label className="relative min-w-0 flex-1">
                            <span className="sr-only">Search {title.toLowerCase()}</span>
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                            <input
                                value={search}
                                onChange={(event) => onSearchChange(event.target.value)}
                                placeholder="Search documents"
                                className="h-11 w-full rounded-lg border-border pl-9 text-sm"
                            />
                        </label>
                        <button type="submit" className="dots-button-secondary">Search</button>
                    </form>
                    {statusOptions && onStatusChange && (
                        <select
                            aria-label={`Filter ${title.toLowerCase()} by status`}
                            value={status}
                            onChange={(event) => onStatusChange(event.target.value)}
                            className="h-11 rounded-lg border-border text-sm"
                        >
                            <option value="all">All statuses</option>
                            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    )}
                </div>
            </div>
            <div className="divide-y divide-border">
                {drafts.length === 0 ? (
                    <p className="rounded-lg bg-background p-5 text-sm text-muted">
                        {search || status !== "all" ? "No documents match these filters." : emptyMessage}
                    </p>
                ) : drafts.map((draft) => (
                    <article key={draft.id} className="py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="font-semibold">{draft.title}</h3>
                                <p className="text-sm text-muted">
                                    {draft.document_type?.name} · Created by {draft.creator?.short_name || draft.creator?.name} · Version {draft.version_number || "draft"}
                                </p>
                                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                    <DraftStatusBadge status={draft.status} />
                                    {draft.approver_office
                                        ? ` · Approval office: ${draft.approver_office.short_name || draft.approver_office.name}`
                                        : draft.approver
                                            ? ` · Approver: ${draft.approver.short_name || draft.approver.name}`
                                            : ""}
                                    {draft.decision_maker ? ` · Decided by: ${draft.decision_maker.short_name || draft.decision_maker.name}` : ""}
                                </p>
                                {(draft.decision_remarks || draft.verification_notes) && (
                                    <p className="mt-2 text-sm text-muted">{draft.decision_remarks || draft.verification_notes}</p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {mode === "work" && draft.created_by === currentUserId && ["draft", "revision_requested"].includes(draft.status) && (
                                    <>
                                        <button type="button" disabled={saving} onClick={() => onEdit?.(draft)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50">
                                            <Pencil size={16} aria-hidden="true" />
                                            Continue editing
                                        </button>
                                        <button type="button" disabled={saving} onClick={() => onSubmitApproval?.(draft)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                                            <Send size={16} aria-hidden="true" />
                                            Submit for approval
                                        </button>
                                    </>
                                )}
                                {mode === "approval" && draft.status === "pending_approval" && draft.can_decide && draft.current_submission && (
                                    <button type="button" disabled={saving} onClick={() => onReview?.(draft)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-primary">
                                        <Eye size={16} aria-hidden="true" />
                                        Review version {draft.current_submission.version_number}
                                    </button>
                                )}
                                {mode === "approved" && draft.created_by === currentUserId && ["approved", "awaiting_verification", "verified"].includes(draft.status) && !draft.official_document_id && (
                                    <button type="button" disabled={saving} onClick={() => onRegister?.(draft)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white"><FileCheck2 size={16} aria-hidden="true" />Register in DOTS</button>
                                )}
                                {draft.official_document_id && (
                                    <span className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Registered in Documents</span>
                                )}
                            </div>
                        </div>
                        {draft.events?.length ? (
                            <details className="mt-3 border-t pt-3">
                                <summary className="cursor-pointer text-xs font-medium text-muted">Approval and verification history ({draft.events.length})</summary>
                                <ol className="mt-2 space-y-1.5">
                                    {draft.events.map((event, index) => (
                                        <li key={index} className="text-xs text-muted">
                                            {event.event} · {event.user?.short_name || event.user?.name || "Former user"}
                                            {event.user?.office_short_name ? ` · ${event.user.office_short_name}` : ""} · {new Date(event.created_at).toLocaleString()}
                                            {event.remarks ? ` — ${event.remarks}` : ""}
                                        </li>
                                    ))}
                                </ol>
                            </details>
                        ) : null}
                    </article>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted">
                <span>{pagination.total} documents · {pagination.per_page} per page</span>
                <div className="flex items-center gap-3">
                    <button disabled={pagination.current_page <= 1} onClick={() => onPageChange(pagination.current_page - 1)} className="dots-button-secondary">Previous</button>
                    <span>Page {pagination.current_page} of {pagination.last_page}</span>
                    <button disabled={pagination.current_page >= pagination.last_page} onClick={() => onPageChange(pagination.current_page + 1)} className="dots-button-secondary">Next</button>
                </div>
            </div>
        </section>
    );
}

export default function Index({
    drafts = [],
    draftsPagination = { current_page: 1, last_page: 1, per_page: 5, total: 0 },
    approvalTasks = [],
    approvalTasksPagination = { current_page: 1, last_page: 1, per_page: 5, total: 0 },
    documentTypes = [],
    approverOffices = [],
    currentUserId,
    approvedOnly = false,
    canReviewOfficeApprovals = false,
    draftToEdit = null,
    filters = {},
}: {
    drafts: Draft[];
    draftsPagination?: PaginationSummary;
    approvalTasks?: Draft[] | null;
    approvalTasksPagination?: PaginationSummary | null;
    documentTypes: Option[];
    approverOffices: Option[];
    currentUserId: number;
    approvedOnly?: boolean;
    canReviewOfficeApprovals?: boolean;
    draftToEdit?: Draft | null;
    filters?: ListFilters;
}) {
    const [editing, setEditing] = useState<number | null>(draftToEdit?.id ?? null);
    const [typeId, setTypeId] = useState(String(draftToEdit?.document_type_id ?? ""));
    const [title, setTitle] = useState(draftToEdit?.title ?? "");
    const [content, setContent] = useState<Record<string, any>>({ ...blank, ...(draftToEdit?.content ?? {}) });
    const [savedTemplate, setSavedTemplate] = useState<{ typeId: string; template?: DocumentTemplate } | null>(draftToEdit ? { typeId: String(draftToEdit.document_type_id), template: draftToEdit.content.template } : null);
    const [approverOfficeId, setApproverOfficeId] = useState(String(draftToEdit?.approver_office_id ?? ""));
    const [previewOpen, setPreviewOpen] = useState(false);
    const [submissionTarget, setSubmissionTarget] = useState<{
        id: number | null;
        title: string;
        fromEditor: boolean;
    } | null>(null);
    const [submissionOfficeId, setSubmissionOfficeId] = useState("");
    const [reviewing, setReviewing] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState("");
    const [successAlert, setSuccessAlert] = useState<{ title: string; message: string } | null>(null);
    const [confirmation, setConfirmation] = useState<{
        title: string;
        message: string;
        label: string;
        destructive?: boolean;
        action: () => void;
    } | null>(null);
    const [pendingDecision, setPendingDecision] = useState<{
        draft: Draft;
        value: string;
    } | null>(null);
    const [remarks, setRemarks] = useState("");
    const [actionError, setActionError] = useState("");
    const [mySearch, setMySearch] = useState(filters.my_search ?? "");
    const [myStatus, setMyStatus] = useState(filters.my_status ?? "all");
    const [approvalSearch, setApprovalSearch] = useState(filters.approval_search ?? "");
    const [approvedSearch, setApprovedSearch] = useState(filters.search ?? "");
    const [approvedStatus, setApprovedStatus] = useState(filters.status ?? "all");
    useEffect(() => {
        setMySearch(filters.my_search ?? "");
        setMyStatus(filters.my_status ?? "all");
        setApprovalSearch(filters.approval_search ?? "");
        setApprovedSearch(filters.search ?? "");
        setApprovedStatus(filters.status ?? "all");
    }, [filters]);
    useEffect(() => {
        if (!draftToEdit) return;
        setEditing(draftToEdit.id);
        setSavedTemplate({ typeId: String(draftToEdit.document_type_id), template: draftToEdit.content.template });
        setTypeId(String(draftToEdit.document_type_id));
        setTitle(draftToEdit.title);
        setContent({ ...blank, ...draftToEdit.content });
        setApproverOfficeId(String(draftToEdit.approver_office_id ?? ""));
        setDirty(false);
        setErrors({});
        setPreviewOpen(false);
    }, [draftToEdit?.id]);
    const visitQuery = (changes: Record<string, string | number>) => {
        router.get(window.location.pathname, { ...filters, ...changes }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
            only: approvedOnly
                ? ["drafts", "draftsPagination", "filters"]
                : ["drafts", "draftsPagination", "approvalTasks", "approvalTasksPagination", "filters"],
        });
    };
    useEffect(() => {
        if (!approvedOnly && filters.queue === "approval") {
            document.getElementById("approval-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [approvedOnly, filters.queue]);
    const guardChanges = (action: () => void) => {
        if (saving) return;
        if (!dirty) {
            action();
            return;
        }
        setConfirmation({
            title: "Discard unsaved changes?",
            label: "Discard changes",
            destructive: true,
            message:
                "Your unsaved edits will be lost. Saved drafts will remain available.",
            action,
        });
    };
    const postAction = (
        url: string,
        data: Record<string, any>,
        onSuccess: () => void,
    ) => {
        if (saving) return;
        setSaving(true);
        setActionError("");
        router.post(url, data, {
            preserveScroll: true,
            onFinish: () => setSaving(false),
            onError: (errors) =>
                setActionError(Object.values(errors).join(" ")),
            onSuccess,
        });
    };

    const startNew = () => {
        setEditing(null);
        setSavedTemplate(null);
        setTypeId("");
        setTitle("");
        setContent({ ...blank });
        setApproverOfficeId("");
        setDirty(false);
        setErrors({});
    };
    const editDraft = (draft: Draft) => {
        setEditing(draft.id);
        setSavedTemplate({ typeId: String(draft.document_type_id), template: draft.content.template });
        setTypeId(String(draft.document_type_id));
        setTitle(draft.title);
        setContent({ ...blank, ...draft.content });
        setApproverOfficeId(String(draft.approver_office_id ?? ""));
        setDirty(false);
        setErrors({});
    };
    const change = (key: string, value: any) => {
        setDirty(true);
        setContent((current) => ({ ...current, [key]: value }));
    };
    const saveDraft = (event: FormEvent) => {
        event.preventDefault();
        if (saving) return;
        setNotice("");
        setActionError("");
        const data = { document_type_id: typeId, title, content };
        const options = {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onError: (errors: Record<string, string>) => setErrors(errors),
            onSuccess: (page: any) => {
                setEditing(Number(page.props.savedDraftId));
                setSavedTemplate({ typeId, template: content.template });
                setDirty(false);
                setErrors({});
                setSuccessAlert({
                    title: "Draft saved",
                    message: "Your draft was saved. You can continue editing or submit it for approval.",
                });
            },
        };
        if (editing) router.put(`/document-creation/${editing}`, data, options);
        else router.post("/document-creation", data, options);
    };
    const openSubmissionDialog = (
        target: { id: number | null; title: string; fromEditor: boolean },
        selectedOfficeId?: number | string | null,
    ) => {
        if (!approverOffices.length) {
            setNotice("There are no available approval offices. Contact an administrator.");
            return;
        }
        setNotice("");
        setSubmissionTarget(target);
        setSubmissionOfficeId(String(selectedOfficeId ?? ""));
    };
    const requestDraftSubmission = (draft: Draft) => {
        if (dirty) {
            setNotice("Save or finish your current edits before submitting another draft.");
            return;
        }
        openSubmissionDialog(
            { id: draft.id, title: draft.title, fromEditor: false },
            draft.approver_office_id,
        );
    };
    const submitForApproval = () => {
        openSubmissionDialog({ id: editing, title, fromEditor: true }, approverOfficeId);
    };
    const submitToApprovalOffice = () => {
        if (!submissionTarget || !submissionOfficeId) return;
        const target = submissionTarget;
        setSubmissionTarget(null);
        postAction(
            target.fromEditor ? "/document-creation/submit-current" : `/document-creation/${target.id}/submit`,
            target.fromEditor
                ? {
                    draft_id: target.id,
                    document_type_id: typeId,
                    title,
                    content,
                    approver_office_id: submissionOfficeId,
                }
                : { approver_office_id: submissionOfficeId },
            () => {
                if (target.fromEditor || editing === target.id) startNew();
                setSuccessAlert({
                    title: "Submitted for approval",
                    message: "The document version was sent to the selected approval office.",
                });
            },
        );
    };
    const decision = (draft: Draft, value: string) => {
        setRemarks("");
        setActionError("");
        setPendingDecision({ draft, value });
    };
    const openReview = (draft: Draft) => {
        setActionError("");
        setReviewing(draft);
    };
    const registerDraft = (draft: Draft) => {
        setConfirmation({
            title: "Register in DOTS?",
            label: "Register document",
            message: `Create an official tracking record for ${draft.title}?`,
            action: () => postAction(
                `/document-creation/${draft.id}/register`,
                {},
                () => setSuccessAlert({
                    title: "Document registered",
                    message: "The document was registered in DOTS.",
                }),
            ),
        });
    };
    const decisionLabel =
        pendingDecision?.value === "approved"
            ? "Approve document"
            : pendingDecision?.value === "rejected"
              ? "Reject document"
              : "Request revision";
    const showApprovalTasks =
        canReviewOfficeApprovals || (approvalTasksPagination?.total ?? 0) > 0;
    const selectedType = documentTypes.find(type => String(type.id) === typeId);
    const loadSample = () => {
        if (!selectedType?.sample_content) return;
        const apply = () => {
            const { title: sampleTitle, ...sample } = selectedType.sample_content!;
            setTitle(sampleTitle || selectedType.name.toUpperCase());
            setContent(current => ({ ...current, ...sample, body: "" }));
            setDirty(true);
        };
        if (title || content.body || content.body_document) {
            setConfirmation({ title: "Load sample content?", message: "This replaces the current title, sample fields, and document body. Your assigned header stays in place.", label: "Load sample", destructive: false, action: apply });
        } else apply();
    };

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {approvedOnly
                            ? "Approved documents"
                            : "Document creation"}
                    </h1>
                </div>
            }
        >
            <Head
                title={
                    approvedOnly ? "Approved documents" : "Document creation"
                }
            />
            <div className="mx-auto max-w-[1440px] space-y-6">
                <div className="flex items-center gap-2 print:hidden">
                    <p className="text-sm text-muted">
                        {approvedOnly
                            ? "Approved records ready for the next step."
                            : "Create a draft, save your work, then send it for approval."}
                    </p>
                    <InfoTip label="Document creation workflow">
                        Choose a document type and write on the page. Save the
                        draft before choosing an approval office. Approval
                        decisions apply to the submitted version. Registration
                        creates the document in DOTS.
                    </InfoTip>
                </div>
                {actionError && !pendingDecision && (
                    <p
                        role="alert"
                        className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
                    >
                        {actionError}
                    </p>
                )}
                {notice && (
                    <div
                        role="status"
                        className="rounded-lg bg-secondary px-4 py-3 text-sm text-primary"
                    >
                        {notice}
                    </div>
                )}
                {!approvedOnly && (
                    <section
                        className="overflow-hidden rounded-xl border border-border bg-background shadow-sm print:hidden"
                        aria-label="Document editor"
                    >
                        <form onSubmit={saveDraft} aria-busy={saving}>
                            <fieldset disabled={saving} className="min-w-0">
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-5 py-4">
                                    <div>
                                        <h2 className="mt-1 text-lg font-semibold text-foreground">
                                            {editing
                                                ? "Edit document"
                                                : "New document"}
                                        </h2>
                                    </div>
                                    <div id="document-actions" className="flex flex-wrap items-center gap-2">
                                        <span
                                            role="status"
                                            className="mr-2 text-xs text-muted"
                                        >
                                            {saving
                                                ? "Saving…"
                                                : dirty
                                                ? "Unsaved changes"
                                                  : editing
                                                    ? "All changes saved"
                                                    : "New draft"}
                                        </span>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() =>
                                                guardChanges(startNew)
                                            }
                                            className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-slate-100"
                                        >
                                            <FilePlus2
                                                size={16}
                                                className="mr-2 inline"
                                            />
                                            New draft
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewOpen(true)}
                                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
                                        >
                                            <Eye
                                                size={16}
                                                className="mr-2 inline"
                                            />
                                            Preview
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="inline-flex items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-background disabled:opacity-50"
                                        >
                                            <Save
                                                size={16}
                                                className="mr-2 inline"
                                            />
                                            {saving ? "Saving…" : editing ? "Save changes" : "Save draft"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={submitForApproval}
                                            disabled={saving}
                                            title="Choose an approval office; current edits will be saved and submitted"
                                            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <Send size={16} className="mr-2" aria-hidden="true" />
                                            Submit for approval
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3">
                                    <label className="flex items-center gap-3 text-sm text-muted">
                                        Template
                                        <select
                                            aria-label="Document type"
                                            required
                                            value={typeId}
                                            onChange={(e) => {
                                                const next = e.target.value;
                                                setTypeId(next);
                                                setContent(current => ({ ...current, template: savedTemplate?.typeId === next ? savedTemplate.template : documentTypes.find(type => String(type.id) === next)?.template }));
                                                setDirty(true);
                                            }}
                                            className="max-w-[260px] rounded-lg border-border bg-surface py-1.5 text-sm"
                                        >
                                            <option value="">
                                                Select document type
                                            </option>
                                            {documentTypes.map((x) => (
                                                <option
                                                    key={x.id}
                                                    value={x.id}
                                                    disabled={x.disabled}
                                                >
                                                    {x.name}{x.template_error ? " (template unavailable)" : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <button type="button" onClick={loadSample} disabled={!selectedType?.sample_content || saving} className="dots-button-secondary disabled:opacity-40">Load sample content</button>
                                    <p className="text-xs text-muted">
                                        {content.template?.name || "NCIP Standard"} · Letter · Portrait{" "}
                                        <span className="mx-2 text-slate-300">
                                            |
                                        </span>{" "}
                                        Use Preview for page breaks
                                    </p>
                                </div>
                                {Object.keys(errors).length > 0 && (
                                    <div
                                        role="alert"
                                        className="m-4 rounded-lg border border-danger/20 bg-danger-soft p-3 text-sm text-danger"
                                    >
                                        {Object.entries(errors).map(
                                            ([key, message]) => (
                                                <p key={key}>{message}</p>
                                            ),
                                        )}
                                    </div>
                                )}
                                <div className="overflow-x-auto px-3 py-8 sm:px-8 sm:py-10">
                                    <DocumentPaper
                                        title={title}
                                        content={content}
                                        onTitleChange={(value) => {
                                            setTitle(value);
                                            setDirty(true);
                                        }}
                                        onChange={change}
                                        disabled={saving}
                                    />
                                </div>
                            </fieldset>
                        </form>
                    </section>
                )}

                {approvedOnly ? (
                    <DraftListSection
                        id="approved-documents"
                        title="My approved documents"
                        emptyMessage="No approved documents are ready for registration."
                        mode="approved"
                        drafts={drafts}
                        pagination={draftsPagination}
                        currentUserId={currentUserId}
                        saving={saving}
                        search={approvedSearch}
                        onSearchChange={setApprovedSearch}
                        onSearchSubmit={() => visitQuery({ search: approvedSearch, page: 1 })}
                        status={approvedStatus}
                        statusOptions={[
                            ["approved", "Approved"],
                            ["awaiting_verification", "Awaiting verification"],
                            ["verified", "Verified"],
                            ["registered", "Registered"],
                        ]}
                        onStatusChange={(status) => {
                            setApprovedStatus(status);
                            visitQuery({ status, page: 1 });
                        }}
                        onPageChange={(page) => visitQuery({ page })}
                        onRegister={registerDraft}
                    />
                ) : (
                    <div className={showApprovalTasks ? "grid items-start gap-6 xl:grid-cols-2" : "space-y-6"}>
                        <DraftListSection
                            id="my-work"
                            title="My submissions"
                            emptyMessage="You have no items awaiting approval or returned for action."
                            mode="work"
                            drafts={drafts}
                            pagination={draftsPagination}
                            currentUserId={currentUserId}
                            saving={saving}
                            search={mySearch}
                            onSearchChange={setMySearch}
                            onSearchSubmit={() => visitQuery({ my_search: mySearch, my_page: 1 })}
                            status={myStatus}
                            statusOptions={[
                                ["pending_approval", "Awaiting approval"],
                                ["revision_requested", "Returned for revision"],
                                ["rejected", "Rejected"],
                            ]}
                            onStatusChange={(status) => {
                                setMyStatus(status);
                                visitQuery({ my_status: status, my_page: 1 });
                            }}
                            onPageChange={(page) => visitQuery({ my_page: page })}
                            onEdit={(draft) => guardChanges(() => editDraft(draft))}
                            onSubmitApproval={requestDraftSubmission}
                        />
                        {showApprovalTasks && (
                            <DraftListSection
                                id="approval-tasks"
                                title="Approval tasks"
                                emptyMessage="No submissions are waiting for your decision."
                                mode="approval"
                                drafts={approvalTasks ?? []}
                                pagination={approvalTasksPagination ?? { current_page: 1, last_page: 1, per_page: 5, total: 0 }}
                                currentUserId={currentUserId}
                                saving={saving}
                                search={approvalSearch}
                                onSearchChange={setApprovalSearch}
                                onSearchSubmit={() => visitQuery({ approval_search: approvalSearch, approval_page: 1 })}
                                onPageChange={(page) => visitQuery({ approval_page: page })}
                                onReview={openReview}
                            />
                        )}
                    </div>
                )}
                <WorkspaceDialog
                    open={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    labelledBy="document-preview-title"
                    width="max-w-6xl"
                >
                    <div className="bg-background p-4 sm:p-6">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h2 id="document-preview-title" className="text-xl font-semibold">
                                    Preview document
                                </h2>
                                <p className="mt-1 text-sm text-muted">
                                    Review the final layout. Close the preview to save as a draft or submit for approval.
                                </p>
                            </div>
                        </div>
                        <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-surface p-3 sm:p-6">
                            {previewOpen && <DocumentPdfPreview payload={{ draft_id: editing, document_type_id: typeId, title, content }} />}
                        </div>
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(false)}
                                className="dots-button-secondary"
                            >
                                Back to editing
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPreviewOpen(false);
                                    window.setTimeout(() => document.getElementById("document-actions")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
                                }}
                                className="dots-button-primary"
                            >
                                Looks good — close preview
                            </button>
                        </div>
                    </div>
                </WorkspaceDialog>
                <WorkspaceDialog
                    open={Boolean(submissionTarget)}
                    onClose={() => setSubmissionTarget(null)}
                    labelledBy="submit-document-title"
                    width="max-w-lg"
                    busy={saving}
                >
                    {submissionTarget && (
                        <form
                            className="space-y-5 p-6"
                            onSubmit={(event) => {
                                event.preventDefault();
                                submitToApprovalOffice();
                            }}
                        >
                            <fieldset disabled={saving} className="space-y-4">
                                <div>
                                    <h2 id="submit-document-title" className="text-xl font-semibold">
                                        Submit for approval
                                    </h2>
                                    <p className="mt-1 text-sm text-muted">
                                        Choose who should review {submissionTarget.fromEditor ? "this document" : "the saved version of this document"}.
                                    </p>
                                </div>
                                <label htmlFor="submission-office" className="block text-sm font-medium">
                                    Approver office
                                    <select
                                        id="submission-office"
                                        required
                                        value={submissionOfficeId}
                                        onChange={(event) => {
                                            setSubmissionOfficeId(event.target.value);
                                            if (editing === submissionTarget?.id) {
                                                setApproverOfficeId(event.target.value);
                                            }
                                        }}
                                        className="mt-1 w-full rounded-lg border-border"
                                    >
                                        <option value="">Select an office</option>
                                        {approverOffices.map((office) => (
                                            <option key={office.id} value={office.id}>
                                                {office.short_name || office.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <p className="text-xs text-muted">
                                    {submissionTarget.fromEditor
                                        ? "Your current edits will be saved as a new version and submitted."
                                        : "The saved version will be submitted for review."}
                                </p>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSubmissionTarget(null)}
                                        className="dots-button-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!submissionOfficeId || saving}
                                        className="dots-button-primary inline-flex items-center gap-2"
                                    >
                                        <Send size={16} aria-hidden="true" />
                                        Submit for approval
                                    </button>
                                </div>
                            </fieldset>
                        </form>
                    )}
                </WorkspaceDialog>
                <WorkspaceDialog
                    open={Boolean(reviewing?.current_submission)}
                    onClose={() => setReviewing(null)}
                    labelledBy="review-document-title"
                    width="max-w-5xl"
                    busy={saving}
                >
                    {reviewing?.current_submission && (
                        <div className="bg-background p-4 sm:p-6">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2
                                        id="review-document-title"
                                        className="text-lg font-semibold"
                                    >
                                        Review: {reviewing.title}
                                    </h2>
                                    <p className="text-sm text-muted">
                                        Version{" "}
                                        {
                                            reviewing.current_submission
                                                .version_number
                                        }{" "}
                                        · {reviewing.document_type?.name}
                                    </p>
                                </div>
                                <button
                                    disabled={saving}
                                    onClick={() => setReviewing(null)}
                                    className="rounded-lg border bg-surface px-3 py-2 text-sm"
                                >
                                    Close
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <DocumentPdfPreview draftId={reviewing.id} />
                            </div>
                            {reviewing.can_decide ? (
                                <div className="mt-4 flex flex-wrap justify-end gap-2">
                                    <button
                                        onClick={() =>
                                            decision(
                                                reviewing,
                                                "revision_requested",
                                            )
                                        }
                                        className="rounded-lg bg-warning px-4 py-2 text-sm text-white"
                                    >
                                        Request revision
                                    </button>
                                    <button
                                        onClick={() =>
                                            decision(reviewing, "rejected")
                                        }
                                        className="rounded-lg bg-danger px-4 py-2 text-sm text-white"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() =>
                                            decision(reviewing, "approved")
                                        }
                                        className="rounded-lg bg-success px-4 py-2 text-sm text-white"
                                    >
                                        Approve
                                    </button>
                                </div>
                            ) : (
                                <p className="mt-4 text-right text-sm text-muted">
                                    This submission is awaiting action from{" "}
                                    {reviewing.approver_office?.short_name ||
                                        reviewing.approver_office?.name ||
                                        reviewing.approver?.short_name ||
                                        reviewing.approver?.name ||
                                        "the assigned approver"}
                                    .
                                </p>
                            )}
                        </div>
                    )}
                </WorkspaceDialog>

                <WorkspaceDialog
                    open={Boolean(pendingDecision)}
                    onClose={() => setPendingDecision(null)}
                    labelledBy="decision-title"
                    width="max-w-lg"
                    busy={saving}
                >
                    {pendingDecision && (
                        <form
                            className="p-6"
                            onSubmit={(event) => {
                                event.preventDefault();
                                postAction(
                                    `/document-creation/${pendingDecision.draft.id}/decision`,
                                    {
                                        decision: pendingDecision.value,
                                        version_number:
                                            pendingDecision.draft
                                                .current_submission
                                                ?.version_number,
                                        remarks,
                                    },
                                    () => {
                                        setPendingDecision(null);
                                        setReviewing(null);
                                        setSuccessAlert({
                                            title: "Decision recorded",
                                            message: `The document was ${pendingDecision.value === "approved" ? "approved" : pendingDecision.value === "rejected" ? "rejected" : "returned for revision"}.`,
                                        });
                                    },
                                );
                            }}
                        >
                            <fieldset disabled={saving} className="space-y-4">
                                <h2
                                    id="decision-title"
                                    className="text-xl font-semibold"
                                >
                                    {decisionLabel}
                                </h2>
                                <p className="text-sm text-muted">
                                    {pendingDecision.draft.title} · Version{" "}
                                    {
                                        pendingDecision.draft.current_submission
                                            ?.version_number
                                    }
                                </p>
                                <div>
                                    <label
                                        htmlFor="decision-remarks"
                                        className="mb-1 block text-sm font-medium"
                                    >
                                        Remarks{" "}
                                        <span className="font-normal text-muted">
                                            (optional)
                                        </span>
                                    </label>
                                    <textarea
                                        id="decision-remarks"
                                        value={remarks}
                                        onChange={(e) =>
                                            setRemarks(e.target.value)
                                        }
                                        rows={4}
                                        maxLength={4000}
                                        className="w-full rounded-lg border-border text-base"
                                    />
                                </div>
                                {actionError && (
                                    <p
                                        role="alert"
                                        className="rounded-lg bg-danger-soft p-3 text-sm text-danger"
                                    >
                                        {actionError}
                                    </p>
                                )}
                                <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPendingDecision(null)}
                                        className="dots-button-secondary"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className={
                                            pendingDecision.value === "rejected"
                                                ? "dots-button bg-danger text-white"
                                                : "dots-button-primary"
                                        }
                                    >
                                        {saving ? "Saving…" : decisionLabel}
                                    </button>
                                </div>
                            </fieldset>
                        </form>
                    )}
                </WorkspaceDialog>
                {confirmation && (
                    <WorkspaceAlert
                        title={confirmation.title}
                        message={confirmation.message}
                        confirmLabel={confirmation.label}
                        isDestructive={confirmation.destructive}
                        onClose={() => setConfirmation(null)}
                        onConfirm={() => {
                            const action = confirmation.action;
                            setConfirmation(null);
                            action();
                        }}
                    />
                )}
                {successAlert && (
                    <WorkspaceAlert
                        title={successAlert.title}
                        message={successAlert.message}
                        onClose={() => setSuccessAlert(null)}
                    />
                )}
            </div>
        </AuthenticatedLayout>
    );
}
