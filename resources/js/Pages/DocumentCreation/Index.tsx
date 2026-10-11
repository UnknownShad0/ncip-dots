import WorkspaceDialog from "@/Components/WorkspaceDialog";
import WorkspaceAlert from "@/Components/WorkspaceAlert";
import InfoTip from "@/Components/InfoTip";
import { Search, FilePlus2, Printer, Save, Send } from "lucide-react";
import DocumentPaper from "@/Components/PaginatedDocument";
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
type Option = {
    id: number | string;
    name: string;
    short_name?: string | null;
    role?: string;
    source?: string;
    disabled?: boolean;
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

export default function Index({
    drafts = [],
    documentTypes = [],
    approverOffices = [],
    currentUserId,
    approvedOnly = false,
}: {
    drafts: Draft[];
    documentTypes: Option[];
    approverOffices: Option[];
    currentUserId: number;
    approvedOnly?: boolean;
}) {
    const [editing, setEditing] = useState<number | null>(null);
    const [typeId, setTypeId] = useState("");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState<Record<string, any>>({ ...blank });
    const [approverOfficeId, setApproverOfficeId] = useState("");
    const [reviewing, setReviewing] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState("");
    const [successAlert, setSuccessAlert] = useState<{ title: string; message: string } | null>(null);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
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
    const filtered = drafts.filter(
        (d) =>
            (statusFilter === "all" || d.status === statusFilter) &&
            [
                d.title,
                d.document_type?.name,
                d.creator?.name,
                d.creator?.short_name,
            ].some((value) =>
                value?.toLowerCase().includes(search.trim().toLowerCase()),
            ),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 15));
    const visibleDrafts = filtered.slice((page - 1) * 15, page * 15);
    useEffect(() => setPage(1), [search, statusFilter]);
    useEffect(() => {
        if (page > pages) setPage(pages);
    }, [page, pages]);
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
        setTypeId("");
        setTitle("");
        setContent({ ...blank });
        setApproverOfficeId("");
        setDirty(false);
        setErrors({});
    };
    const editDraft = (draft: Draft) => {
        setEditing(draft.id);
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
    const submitForApproval = () => {
        if (dirty) {
            setNotice("Save your changes before submitting for approval.");
            return;
        }
        if (!editing || !approverOfficeId) {
            setNotice("Save the draft first, then select an approver office.");
            return;
        }
        setConfirmation({
            title: "Submit for approval?",
            label: "Submit for approval",
            message: `Send this saved version to ${approverOffices.find((office) => String(office.id) === approverOfficeId)?.name || "the selected approval office"}?`,
            action: () =>
                postAction(
                    `/document-creation/${editing}/submit`,
                    { approver_office_id: approverOfficeId },
                    () => {
                        startNew();
                        setSuccessAlert({
                            title: "Submitted for approval",
                            message: "The document version was sent to the selected approval office.",
                        });
                    },
                ),
        });
    };
    const decision = (draft: Draft, value: string) => {
        setRemarks("");
        setActionError("");
        setPendingDecision({ draft, value });
    };
    const decisionLabel =
        pendingDecision?.value === "approved"
            ? "Approve document"
            : pendingDecision?.value === "rejected"
              ? "Reject document"
              : "Request revision";
    const print = () => window.print();

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
                                    <div className="flex flex-wrap items-center gap-2">
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
                                            onClick={print}
                                            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-background"
                                        >
                                            <Printer
                                                size={16}
                                                className="mr-2 inline"
                                            />
                                            Print / PDF
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
                                        >
                                            <Save
                                                size={16}
                                                className="mr-2 inline"
                                            />
                                            {saving ? "Saving…" : "Save draft"}
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
                                                setTypeId(e.target.value);
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
                                                    {x.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="text-xs text-muted">
                                        Letter · Portrait{" "}
                                        <span className="mx-2 text-slate-300">
                                            |
                                        </span>{" "}
                                        Click the page to write
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
                                        printTarget={!reviewing}
                                    />
                                </div>
                            </fieldset>
                        </form>
                        {editing && (
                            <div className="m-5 grid gap-3 rounded-xl border border-border bg-surface p-4 md:grid-cols-[1fr_auto]">
                                <div>
                                    <label className="block text-sm font-medium">
                                        Approver Office
                                        <select
                                            disabled={saving}
                                            value={approverOfficeId}
                                            onChange={(e) =>
                                                setApproverOfficeId(
                                                    e.target.value,
                                                )
                                            }
                                            className="mt-1 w-full rounded-lg border-border"
                                        >
                                            <option value="">
                                                {approverOffices.length
                                                    ? "Select office"
                                                    : "No offices have an active admin"}
                                            </option>
                                            {approverOffices.map((office) => (
                                                <option
                                                    key={office.id}
                                                    value={office.id}
                                                >
                                                    {office.short_name ||
                                                        office.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <p className="mt-2 text-xs text-muted">
                                        Save your latest changes, then select
                                        the office that will review this
                                        document.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={submitForApproval}
                                    disabled={
                                        !approverOfficeId || dirty || saving
                                    }
                                    className="self-end rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Send size={16} className="mr-2 inline" />
                                    Submit for approval
                                </button>
                            </div>
                        )}
                    </section>
                )}

                <section className="rounded-xl border border-border bg-surface p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">
                            {approvedOnly
                                ? "Approved documents"
                                : "Drafts and approval tasks"}{" "}
                            <span className="ml-1 text-sm font-normal text-muted">
                                ({drafts.length})
                            </span>
                        </h2>
                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            <label className="relative">
                                <span className="sr-only">Search drafts</span>
                                <Search
                                    size={16}
                                    className="absolute left-3 top-3 text-muted"
                                />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search documents"
                                    className="h-10 w-full rounded-lg border-border pl-9 text-sm"
                                />
                            </label>
                            <select
                                aria-label="Filter document status"
                                value={statusFilter}
                                onChange={(e) =>
                                    setStatusFilter(e.target.value)
                                }
                                className="h-10 rounded-lg border-border text-sm"
                            >
                                <option value="all">All statuses</option>
                                {Array.from(
                                    new Set(drafts.map((d) => d.status)),
                                )
                                    .sort()
                                    .map((value) => (
                                        <option key={value} value={value}>
                                            {value.replaceAll("_", " ")}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    </div>
                    <div className="divide-y divide-border">
                        {filtered.length === 0 ? (
                            <p className="rounded-lg bg-background p-5 text-sm text-muted">
                                {search || statusFilter !== "all"
                                    ? "No documents match these filters."
                                    : "No drafts or approval tasks available."}
                            </p>
                        ) : (
                            visibleDrafts.map((d) => (
                                <article key={d.id} className="py-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <h3 className="font-semibold">
                                                {d.title}
                                            </h3>
                                            <p className="text-sm text-muted">
                                                {d.document_type?.name} ·
                                                Created by{" "}
                                                {d.creator?.short_name ||
                                                    d.creator?.name}{" "}
                                                · Version{" "}
                                                {d.version_number || "draft"}
                                            </p>
                                            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">
                                                {d.status.replaceAll("_", " ")}
                                                {d.approver_office
                                                    ? ` · Approval office: ${d.approver_office.short_name || d.approver_office.name}`
                                                    : d.approver
                                                      ? ` · Approver: ${d.approver.short_name || d.approver.name}`
                                                      : ""}
                                                {d.decision_maker
                                                    ? ` · Decided by: ${d.decision_maker.short_name || d.decision_maker.name}`
                                                    : ""}
                                            </p>
                                            {(d.decision_remarks ||
                                                d.verification_notes) && (
                                                <p className="mt-2 text-sm text-muted">
                                                    {d.decision_remarks ||
                                                        d.verification_notes}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {d.created_by === currentUserId &&
                                                [
                                                    "draft",
                                                    "revision_requested",
                                                ].includes(d.status) && (
                                                    <button
                                                        disabled={saving}
                                                        onClick={() =>
                                                            guardChanges(() =>
                                                                editDraft(d),
                                                            )
                                                        }
                                                        className="rounded-lg border px-3 py-2 text-sm"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            {d.status === "pending_approval" &&
                                                d.current_submission && (
                                                    <button
                                                        disabled={saving}
                                                        onClick={() => {
                                                            setActionError("");
                                                            setReviewing(d);
                                                        }}
                                                        className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-primary"
                                                    >
                                                        Review version{" "}
                                                        {
                                                            d.current_submission
                                                                .version_number
                                                        }
                                                    </button>
                                                )}
                                            {d.created_by === currentUserId &&
                                                [
                                                    "approved",
                                                    "awaiting_verification",
                                                    "verified",
                                                ].includes(d.status) &&
                                                !d.official_document_id && (
                                                    <button
                                                        disabled={saving}
                                                        onClick={() =>
                                                            setConfirmation({
                                                                title: "Register in DOTS?",
                                                                label: "Register document",
                                                                message: `Create an official tracking record for ${d.title}?`,
                                                                action: () =>
                                                                    postAction(
                                                                        `/document-creation/${d.id}/register`,
                                                                        {},
                                                                        () => setSuccessAlert({
                                                                            title: "Document registered",
                                                                            message: "The document was registered in DOTS.",
                                                                        }),
                                                                    ),
                                                            })
                                                        }
                                                        className="rounded-lg bg-primary px-3 py-2 text-sm text-white"
                                                    >
                                                        Register in DOTS
                                                    </button>
                                                )}
                                            {d.official_document_id && (
                                                <span className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
                                                    Registered in Documents
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {d.events?.length ? (
                                        <details className="mt-3 border-t pt-3">
                                            <summary className="cursor-pointer text-xs font-medium text-muted">
                                                Approval and verification
                                                history ({d.events.length})
                                            </summary>
                                            <ol className="mt-2 space-y-1">
                                                {d.events.map(
                                                    (event, index) => (
                                                        <li
                                                            key={index}
                                                            className="text-xs text-muted"
                                                        >
                                                            {event.event} ·{" "}
                                                            {event.user
                                                                ?.short_name ||
                                                                event.user
                                                                    ?.name ||
                                                                "Former user"}
                                                            {event.user
                                                                ?.office_short_name
                                                                ? ` · ${event.user.office_short_name}`
                                                                : ""}{" "}
                                                            ·{" "}
                                                            {new Date(
                                                                event.created_at,
                                                            ).toLocaleString()}
                                                            {event.remarks
                                                                ? ` — ${event.remarks}`
                                                                : ""}
                                                        </li>
                                                    ),
                                                )}
                                            </ol>
                                        </details>
                                    ) : null}
                                </article>
                            ))
                        )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm text-muted">
                        <span>{filtered.length} documents · 15 per page</span>
                        <div className="flex items-center gap-3">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="dots-button-secondary"
                            >
                                Previous
                            </button>
                            <span>
                                Page {page} of {pages}
                            </span>
                            <button
                                disabled={page >= pages}
                                onClick={() => setPage((p) => p + 1)}
                                className="dots-button-secondary"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </section>
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
                                <DocumentPaper
                                    title={reviewing.title}
                                    content={
                                        reviewing.current_submission.content
                                    }
                                    printTarget
                                />
                            </div>
                            {reviewing.can_decide ? (
                                <div className="mt-4 flex flex-wrap justify-end gap-2">
                                    <button
                                        onClick={print}
                                        className="rounded-lg border bg-surface px-4 py-2 text-sm"
                                    >
                                        Print / Save as PDF
                                    </button>
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
