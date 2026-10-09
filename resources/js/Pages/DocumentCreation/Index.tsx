import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

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
    const [tab, setTab] = useState<'edit' | 'preview'>('edit');
    const [notice, setNotice] = useState('');
    const cc = useMemo(() => content.cc ?? [], [content.cc]);

    const startNew = () => {
        setEditing(null); setTypeId(''); setTitle(''); setContent({ ...blank }); setApproverOfficeId(''); setTab('edit');
    };
    const editDraft = (draft: Draft) => {
        setEditing(draft.id); setTypeId(String(draft.document_type_id)); setTitle(draft.title); setContent({ ...blank, ...draft.content }); setTab('edit');
    };
    const change = (key: string, value: any) => setContent((current) => ({ ...current, [key]: value }));
    const saveDraft = (event: FormEvent) => {
        event.preventDefault(); setNotice('');
        const data = { document_type_id: typeId, title, content };
        const options = { onSuccess: () => { setNotice('Draft saved.'); setEditing(null); startNew(); } };
        if (editing) router.put(`/document-creation/${editing}`, data, options);
        else router.post('/document-creation', data, options);
    };
    const submitForApproval = () => {
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
        <style>{`@media print { @page { size: letter portrait; margin: 0.65in; } body * { visibility: hidden !important; } .creation-print-page, .creation-print-page * { visibility: visible !important; } .creation-print-page { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; min-height: 9.7in !important; padding: 0 !important; box-shadow: none !important; } }`}</style>
        <div className="mx-auto max-w-[1500px] space-y-6">
            {notice && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
            {!approvedOnly && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{editing ? 'Edit draft' : 'Create document'}</h2><p className="text-sm text-slate-500">Choose a type, enter the details, and preview the printable page.</p></div><div className="flex gap-2"><button type="button" onClick={() => setTab('edit')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'edit' ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}>Edit</button><button type="button" onClick={() => setTab('preview')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'preview' ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}>Preview</button>{editing && <button type="button" onClick={startNew} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">New draft</button>}</div></div>
                <form onSubmit={saveDraft} className="grid gap-6 xl:grid-cols-2">
                    <div className={`${tab === 'preview' ? 'hidden xl:block' : ''} space-y-4`}>
                        <label className="block text-sm font-medium">Document type<select required value={typeId} onChange={e => setTypeId(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300"><option value="">Select document type</option>{documentTypes.map(x => <option key={`${x.source ?? 'new'}-${x.id}`} value={x.id} disabled={x.disabled}>{x.name}{x.disabled ? ' (Unavailable)' : ''}</option>)}</select></label>
                        <label className="block text-sm font-medium">Draft title<input required maxLength={255} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" placeholder="For example, Memorandum on..." /></label>
                        <div className="grid gap-3 sm:grid-cols-2">{([['for', 'FOR'], ['thru', 'THRU'], ['attention', 'ATTENTION'], ['from', 'FROM'], ['subject', 'SUBJECT'], ['date', 'DATE']] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}{key === 'date' ? <input type="date" value={content[key] ?? ''} onChange={e => change(key, e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" /> : <input required={key === 'from' || key === 'subject'} value={content[key] ?? ''} onChange={e => change(key, e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" />}</label>)}</div>
                        <label className="block text-sm font-medium">CONTENT<textarea required rows={10} value={content.body ?? ''} onChange={e => change('body', e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" placeholder="Write the body of the document. Use blank lines to separate paragraphs." /></label>
                        <div className="space-y-2"><div className="text-sm font-medium">CC</div>{cc.map((value: string, index: number) => <div className="flex gap-2" key={index}><input value={value} onChange={e => change('cc', cc.map((entry: string, i: number) => i === index ? e.target.value : entry))} className="w-full rounded-lg border-slate-300" placeholder="Name or office" /><button type="button" onClick={() => change('cc', cc.filter((_: string, i: number) => i !== index))} className="rounded-lg bg-slate-100 px-3">Remove</button></div>)}<button type="button" onClick={() => change('cc', [...cc, ''])} className="text-sm font-medium text-blue-700">+ Add recipient</button></div>
                        <div className="flex flex-wrap gap-2 border-t pt-4"><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save draft</button><button type="button" onClick={print} className="rounded-lg border px-4 py-2 text-sm">Print / Save as PDF</button></div>
                    </div>
                    <div className={`${tab === 'edit' ? 'hidden xl:block' : ''}`}><p className="mb-2 text-sm font-medium text-slate-600">Live preview</p><PrintPreview title={title} content={content} /></div>
                </form>
                {editing && <div className="mt-4 grid gap-3 rounded-xl bg-blue-50 p-4 md:grid-cols-[1fr_auto]"><div><label className="block text-sm font-medium">Approver Office<select value={approverOfficeId} onChange={e => setApproverOfficeId(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300"><option value="">{approverOffices.length ? 'Select office' : 'No offices have an active admin'}</option>{approverOffices.map(office => <option key={office.id} value={office.id}>{office.short_name || office.name}</option>)}</select></label><p className="mt-2 text-xs text-slate-600">Active admins in the selected office can review and decide on this submission. DOTS records which admin makes the decision.</p></div><button type="button" onClick={submitForApproval} disabled={!approverOfficeId} className="self-end rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Submit for approval</button></div>}
            </section>}

            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">My drafts and approval tasks</h2><div className="space-y-3">{drafts.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">No drafts or approval tasks available.</p> : drafts.map(d => <article key={d.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{d.title}</h3><p className="text-sm text-slate-500">{d.document_type?.name} · Created by {d.creator?.short_name || d.creator?.name} · Version {d.version_number || 'draft'}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">{d.status.replaceAll('_', ' ')}{d.approver_office ? ` · Approval office: ${d.approver_office.short_name || d.approver_office.name}` : d.approver ? ` · Approver: ${d.approver.short_name || d.approver.name}` : ''}{d.decision_maker ? ` · Decided by: ${d.decision_maker.short_name || d.decision_maker.name}` : ''}</p>{(d.decision_remarks || d.verification_notes) && <p className="mt-2 text-sm text-slate-600">{d.decision_remarks || d.verification_notes}</p>}</div><div className="flex flex-wrap gap-2">
                    {d.created_by === currentUserId && ['draft', 'revision_requested'].includes(d.status) && <button onClick={() => editDraft(d)} className="rounded-lg border px-3 py-2 text-sm">Edit</button>}
                    {d.status === 'pending_approval' && d.current_submission && <button onClick={() => setReviewing(d)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">Review version {d.current_submission.version_number}</button>}
                    {d.created_by === currentUserId && ['approved', 'awaiting_verification', 'verified'].includes(d.status) && !d.official_document_id && <button onClick={() => router.post(`/document-creation/${d.id}/register`)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white">Register in DOTS</button>}
                    {d.official_document_id && <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Registered in Documents</span>}
                </div></div>{d.events?.length ? <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs font-medium text-slate-600">Approval and verification history ({d.events.length})</summary><ol className="mt-2 space-y-1">{d.events.map((event, index) => <li key={index} className="text-xs text-slate-600">{event.event} · {event.user?.short_name || event.user?.name || 'Former user'}{event.user?.office_short_name ? ` · ${event.user.office_short_name}` : ''} · {new Date(event.created_at).toLocaleString()}{event.remarks ? ` — ${event.remarks}` : ''}</li>)}</ol></details> : null}</article>)}</div></section>
            {reviewing?.current_submission && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Review submitted document"><div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-slate-100 p-5 shadow-2xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Review: {reviewing.title}</h2><p className="text-sm text-slate-500">Version {reviewing.current_submission.version_number} · {reviewing.document_type?.name}</p></div><button onClick={() => setReviewing(null)} className="rounded-lg border bg-white px-3 py-2 text-sm">Close</button></div><PrintPreview title={reviewing.title} content={reviewing.current_submission.content} />{reviewing.can_decide ? <div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={print} className="rounded-lg border bg-white px-4 py-2 text-sm">Print / Save as PDF</button><button onClick={() => decision(reviewing, 'revision_requested')} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white">Request revision</button><button onClick={() => decision(reviewing, 'rejected')} className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white">Reject</button><button onClick={() => decision(reviewing, 'approved')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">Approve</button></div> : <p className="mt-4 text-right text-sm text-slate-600">This submission is awaiting action from {reviewing.approver_office?.short_name || reviewing.approver_office?.name || reviewing.approver?.short_name || reviewing.approver?.name || 'the assigned approver'}.</p>}</div></div>}
        </div>
    </AuthenticatedLayout>;
}

function PrintPreview({ title, content }: { title: string; content: Record<string, any> }) {
    const labels: [string, string][] = [['for', 'FOR'], ['thru', 'THRU'], ['attention', 'ATTENTION'], ['from', 'FROM'], ['subject', 'SUBJECT'], ['date', 'DATE']];
    return <article className="creation-print-page min-h-[10.2in] bg-white px-[0.65in] py-[0.6in] text-[11pt] leading-relaxed text-black shadow-lg"><div className="mb-10 text-center"><img src="/images/header.png" alt="National Commission on Indigenous Peoples" className="mx-auto mb-5 max-h-20 max-w-full object-contain"/><div className="text-xs uppercase tracking-widest text-slate-500">{title || 'Document title'}</div></div><div className="mb-8 space-y-2">{labels.map(([key, label]) => (content[key] || (key === 'for' || key === 'from' || key === 'subject')) && <div className="grid grid-cols-[1.1in_1fr] gap-2" key={key}><strong>{label}:</strong><span className="whitespace-pre-wrap">{key === 'date' && content[key] ? new Date(`${content[key]}T00:00:00`).toLocaleDateString() : content[key] || '—'}</span></div>)}</div><div className="min-h-[4in] whitespace-pre-wrap">{content.body || 'Document content will appear here.'}</div>{(content.cc ?? []).filter(Boolean).length > 0 && <div className="mt-8 grid grid-cols-[1.1in_1fr] gap-2"><strong>CC:</strong><span>{content.cc.filter(Boolean).join('; ')}</span></div>}</article>;
}
