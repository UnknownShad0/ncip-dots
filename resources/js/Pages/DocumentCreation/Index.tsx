import DocumentPaper from '@/Components/PaginatedDocument';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';

type Draft = { id: number; title: string; status: string; content: Record<string, any>; document_type_id: number; version_number: number; created_by: number; approver_id?: number; approver_office_id?: number; approver_office?: { name: string; short_name?: string | null }; decision_maker?: { name: string; short_name?: string }; can_decide?: boolean; decision_remarks?: string; verification_notes?: string; verified_file_name?: string; official_document_id?: number; creator?: { name: string; short_name?: string }; approver?: { name: string; short_name?: string }; document_type?: { name: string }; current_submission?: { version_number: number; content: Record<string, any>; submitted_at: string } | null; events?: { event: string; remarks?: string; created_at: string; user?: { name: string; short_name?: string; office_short_name?: string | null } }[] };
type Option = { id: number | string; name: string; short_name?: string | null; role?: string; source?: string; disabled?: boolean };
const blank = { for: '', thru: '', attention: '', from: '', subject: '', date: new Date().toISOString().slice(0, 10), body: '', cc: [] as string[] };

export default function Index({ drafts = [], documentTypes = [], approverOffices = [], currentUserId, approvedOnly = false }: { drafts: Draft[]; documentTypes: Option[]; approverOffices: Option[]; currentUserId: number; approvedOnly?: boolean }) {
    const [editing, setEditing] = useState<number | null>(null);
    const [typeId, setTypeId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<Record<string, any>>({ ...blank });
    const [approverOfficeId, setApproverOfficeId] = useState('');
    const [reviewing, setReviewing] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState('');


    const startNew = () => {
        setEditing(null); setTypeId(''); setTitle(''); setContent({ ...blank }); setApproverOfficeId(''); setDirty(false); setErrors({});
    };
    const editDraft = (draft: Draft) => {
        setEditing(draft.id); setTypeId(String(draft.document_type_id)); setTitle(draft.title); setContent({ ...blank, ...draft.content }); setApproverOfficeId(String(draft.approver_office_id ?? '')); setDirty(false); setErrors({});
    };
    const change = (key: string, value: any) => { setDirty(true); setContent((current) => ({ ...current, [key]: value })); };
    const saveDraft = (event: FormEvent) => {
        event.preventDefault(); setNotice('');
        const data = { document_type_id: typeId, title, content };
        const options = { preserveScroll: true, onStart: () => setSaving(true), onFinish: () => setSaving(false), onError: (errors: Record<string, string>) => setErrors(errors), onSuccess: (page: any) => { setNotice('Draft saved. You can continue editing or submit for approval.'); setEditing(Number(page.props.savedDraftId)); setDirty(false); setErrors({}); } };
        if (editing) router.put(`/document-creation/${editing}`, data, options);
        else router.post('/document-creation', data, options);
    };
    const submitForApproval = () => {
        if (dirty) { setNotice('Save your changes before submitting for approval.'); return; }
        if (!editing || !approverOfficeId) { setNotice('Save the draft first, then select an approver office.'); return; }
        router.post(`/document-creation/${editing}/submit`, { approver_office_id: approverOfficeId }, { onSuccess: () => { setNotice('Document version submitted for approval.'); startNew(); } });
    };
    const decision = (draft: Draft, value: string) => {
        const remarks = window.prompt('Add remarks for the creator (optional):') ?? '';
        router.post(`/document-creation/${draft.id}/decision`, { decision: value, version_number: draft.current_submission?.version_number, remarks }, { onSuccess: () => setReviewing(null) });
    };
    const print = () => window.print();

    return <AuthenticatedLayout header={<div><p className="text-xs uppercase tracking-[.18em] text-slate-500">Document workflow</p><h1 className="text-2xl font-semibold">{approvedOnly ? 'Approved Documents' : 'Generate Document'}</h1></div>}>
        <Head title={approvedOnly ? 'Approved Documents' : 'Generate Document'} />
        <div className="mx-auto max-w-[1500px] space-y-6">
            {notice && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
            {!approvedOnly && <section className="overflow-hidden rounded-2xl border border-slate-200 bg-[#e9edf0] shadow-sm print:hidden" aria-label="Document editor">
                <form onSubmit={saveDraft}>
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
                        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">Document studio</p><h2 className="mt-1 text-lg font-semibold text-slate-900">{editing ? 'Edit document' : 'New document'}</h2></div>
                        <div className="flex flex-wrap items-center gap-2"><span role="status" className="mr-2 text-xs text-slate-500">{saving ? 'Saving…' : dirty ? 'Unsaved changes' : editing ? 'All changes saved' : 'New draft'}</span>
                            <button type="button" disabled={saving} onClick={() => { if (!dirty || window.confirm('Discard unsaved changes and start a new document?')) startNew(); }} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">New draft</button>
                            <button type="button" onClick={print} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Print / PDF</button>
                            <button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50">{saving ? 'Saving…' : 'Save draft'}</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                        <label className="flex items-center gap-3 text-sm text-slate-600">Template<select aria-label="Document type" required value={typeId} onChange={e => { setTypeId(e.target.value); setDirty(true); }} className="max-w-[260px] rounded-lg border-slate-200 bg-white py-1.5 text-sm"><option value="">Select document type</option>{documentTypes.map(x => <option key={x.id} value={x.id} disabled={x.disabled}>{x.name}</option>)}</select></label>
                        <p className="text-xs text-slate-500">Letter · Portrait <span className="mx-2 text-slate-300">|</span> Click the page to write</p>
                    </div>
                    {Object.keys(errors).length > 0 && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{Object.entries(errors).map(([key, message]) => <p key={key}>{message}</p>)}</div>}
                    <div className="overflow-x-auto px-3 py-8 sm:px-8 sm:py-10">
                        <DocumentPaper title={title} content={content} onTitleChange={value => { setTitle(value); setDirty(true); }} onChange={change} printTarget={!reviewing} />
                    </div>
                </form>
                {editing && <div className="m-5 grid gap-3 rounded-xl border border-blue-100 bg-white p-4 md:grid-cols-[1fr_auto]"><div><label className="block text-sm font-medium">Approver Office<select value={approverOfficeId} onChange={e => setApproverOfficeId(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300"><option value="">{approverOffices.length ? 'Select office' : 'No offices have an active admin'}</option>{approverOffices.map(office => <option key={office.id} value={office.id}>{office.short_name || office.name}</option>)}</select></label><p className="mt-2 text-xs text-slate-600">Save your latest changes, then select the office that will review this document.</p></div><button type="button" onClick={submitForApproval} disabled={!approverOfficeId || dirty || saving} className="self-end rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Submit for approval</button></div>}
            </section>}

            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">My drafts and approval tasks</h2><div className="space-y-3">{drafts.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">No drafts or approval tasks available.</p> : drafts.map(d => <article key={d.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{d.title}</h3><p className="text-sm text-slate-500">{d.document_type?.name} · Created by {d.creator?.short_name || d.creator?.name} · Version {d.version_number || 'draft'}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">{d.status.replaceAll('_', ' ')}{d.approver_office ? ` · Approval office: ${d.approver_office.short_name || d.approver_office.name}` : d.approver ? ` · Approver: ${d.approver.short_name || d.approver.name}` : ''}{d.decision_maker ? ` · Decided by: ${d.decision_maker.short_name || d.decision_maker.name}` : ''}</p>{(d.decision_remarks || d.verification_notes) && <p className="mt-2 text-sm text-slate-600">{d.decision_remarks || d.verification_notes}</p>}</div><div className="flex flex-wrap gap-2">
                    {d.created_by === currentUserId && ['draft', 'revision_requested'].includes(d.status) && <button onClick={() => { if (!dirty || window.confirm('Discard unsaved changes and open this draft?')) editDraft(d); }} className="rounded-lg border px-3 py-2 text-sm">Edit</button>}
                    {d.status === 'pending_approval' && d.current_submission && <button onClick={() => setReviewing(d)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">Review version {d.current_submission.version_number}</button>}
                    {d.created_by === currentUserId && ['approved', 'awaiting_verification', 'verified'].includes(d.status) && !d.official_document_id && <button onClick={() => router.post(`/document-creation/${d.id}/register`)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white">Register in DOTS</button>}
                    {d.official_document_id && <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Registered in Documents</span>}
                </div></div>{d.events?.length ? <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs font-medium text-slate-600">Approval and verification history ({d.events.length})</summary><ol className="mt-2 space-y-1">{d.events.map((event, index) => <li key={index} className="text-xs text-slate-600">{event.event} · {event.user?.short_name || event.user?.name || 'Former user'}{event.user?.office_short_name ? ` · ${event.user.office_short_name}` : ''} · {new Date(event.created_at).toLocaleString()}{event.remarks ? ` — ${event.remarks}` : ''}</li>)}</ol></details> : null}</article>)}</div></section>
            {reviewing?.current_submission && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Review submitted document"><div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-slate-100 p-5 shadow-2xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Review: {reviewing.title}</h2><p className="text-sm text-slate-500">Version {reviewing.current_submission.version_number} · {reviewing.document_type?.name}</p></div><button onClick={() => setReviewing(null)} className="rounded-lg border bg-white px-3 py-2 text-sm">Close</button></div><DocumentPaper title={reviewing.title} content={reviewing.current_submission.content} printTarget />{reviewing.can_decide ? <div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={print} className="rounded-lg border bg-white px-4 py-2 text-sm">Print / Save as PDF</button><button onClick={() => decision(reviewing, 'revision_requested')} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white">Request revision</button><button onClick={() => decision(reviewing, 'rejected')} className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white">Reject</button><button onClick={() => decision(reviewing, 'approved')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">Approve</button></div> : <p className="mt-4 text-right text-sm text-slate-600">This submission is awaiting action from {reviewing.approver_office?.short_name || reviewing.approver_office?.name || reviewing.approver?.short_name || reviewing.approver?.name || 'the assigned approver'}.</p>}</div></div>}
        </div>
    </AuthenticatedLayout>;
}
