import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import type { Template } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { image, text } from '@pdfme/schemas';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type Draft = { id: number; title: string; status: string; content: Record<string, any>; document_type_id: number; template_id: number; version_number: number; created_by: number; approver_id?: number; decision_remarks?: string; verification_notes?: string; verified_file_name?: string; official_document_id?: number; creator?: { name: string }; approver?: { name: string }; document_type?: { name: string }; current_submission?: { version_number: number; content: Record<string, any>; template_json: Template; submitted_at: string } | null; events?: { event: string; remarks?: string; created_at: string; user?: { name: string } }[] };
type Option = { id: number; name: string; role?: string; creation_template?: { id: number; name: string; version: number; template_json: Template; is_active: boolean } };
const blank = { for: '', thru: '', attention: '', from: '', subject: '', date: new Date().toISOString().slice(0, 10), body: '', cc: [] as string[] };

export default function Index({ drafts = [], documentTypes = [], approvers = [], currentUserId, logoDataUri }: { drafts: Draft[]; documentTypes: Option[]; approvers: Option[]; currentUserId: number; logoDataUri: string }) {
    const [editing, setEditing] = useState<number | null>(null);
    const [typeId, setTypeId] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState<Record<string, any>>({ ...blank });
    const [approverId, setApproverId] = useState('');
    const [returnedFile, setReturnedFile] = useState<Record<number, File | null>>({});
    const [reviewing, setReviewing] = useState<Draft | null>(null);
    const [tab, setTab] = useState<'edit' | 'preview'>('edit');
    const [notice, setNotice] = useState('');
    const cc = useMemo(() => content.cc ?? [], [content.cc]);

    const startNew = () => {
        setEditing(null); setTypeId(''); setTemplateId(''); setTitle(''); setContent({ ...blank }); setTab('edit');
    };
    const editDraft = (draft: Draft) => {
        setEditing(draft.id); setTypeId(String(draft.document_type_id)); setTemplateId(String(draft.template_id || '')); setTitle(draft.title); setContent({ ...blank, ...draft.content }); setTab('edit');
    };
    const selectedTemplate = documentTypes.find((option) => String(option.id) === typeId)?.creation_template;
    const changeDocumentType = (value: string) => {
        setTypeId(value);
        const matched = documentTypes.find((option) => String(option.id) === value)?.creation_template;
        setTemplateId(matched ? String(matched.id) : '');
    };
    const change = (key: string, value: any) => setContent((current) => ({ ...current, [key]: value }));
    const saveDraft = (event: FormEvent) => {
        event.preventDefault(); setNotice('');
        const data = { document_type_id: typeId, template_id: templateId, title, content };
        const options = { onSuccess: () => { setNotice('Draft saved.'); setEditing(null); startNew(); } };
        if (editing) router.put(`/document-creation/${editing}`, data, options);
        else router.post('/document-creation', data, options);
    };
    const submitForApproval = () => {
        if (!editing || !approverId) { setNotice('Save the draft first, then select an approver.'); return; }
        const data = { document_type_id: typeId, template_id: templateId, title, content };
        router.put(`/document-creation/${editing}`, data, {
            preserveState: true,
            onSuccess: () => router.post(`/document-creation/${editing}/submit`, { approver_id: approverId }, { onSuccess: () => { setNotice('Document version submitted for approval.'); startNew(); } }),
        });
    };
    const decision = (draft: Draft, value: string) => {
        const remarks = window.prompt('Add remarks for the creator (optional):') ?? '';
        router.post(`/document-creation/${draft.id}/decision`, { decision: value, version_number: draft.current_submission?.version_number, remarks }, { onSuccess: () => setReviewing(null) });
    };
    const verify = (event: FormEvent<HTMLFormElement>, id: number) => {
        event.preventDefault(); const form = event.currentTarget; const file = returnedFile[id];
        if (!file) { setNotice('Choose the returned approved or signed file.'); return; }
        const data = new FormData(form); data.append('returned_file', file);
        router.post(`/document-creation/${id}/verify`, data, { forceFormData: true, onSuccess: () => setNotice('Verification recorded.') });
    };
    const downloadPdf = async () => {
        if (!selectedTemplate || !templateId) return;
        try {
            const { logo: _logo, ...values } = toPdfInputs(content, logoDataUri);
            const response = await axios.post(route('document-templates.generate', Number(templateId)), { inputs: values }, { responseType: 'blob' });
            const url = URL.createObjectURL(response.data);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = `${(title || 'document').replace(/[^a-z0-9-_]+/gi, '-')}.pdf`; anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            setNotice('Could not generate the PDF. Refresh the page or contact an administrator.');
        }
    };

    return <AuthenticatedLayout header={<div><p className="text-xs uppercase tracking-[.18em] text-slate-500">Document workflow</p><h1 className="text-2xl font-semibold">Document Creation</h1></div>}>
        <Head title="Document Creation" />
        <div className="mx-auto max-w-[1500px] space-y-6">
            {notice && <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}</div>}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{editing ? 'Edit draft' : 'Create document'}</h2><p className="text-sm text-slate-500">Choose a type, enter the details, and preview the printable page.</p></div><div className="flex gap-2"><button type="button" onClick={() => setTab('edit')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'edit' ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}>Edit</button><button type="button" onClick={() => setTab('preview')} className={`rounded-lg px-3 py-2 text-sm ${tab === 'preview' ? 'bg-blue-700 text-white' : 'bg-slate-100'}`}>Preview</button>{editing && <button type="button" onClick={startNew} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">New draft</button>}</div></div>
                <form onSubmit={saveDraft} className="grid gap-6 xl:grid-cols-2">
                    <div className={`${tab === 'preview' ? 'hidden xl:block' : ''} space-y-4`}>
                        <label className="block text-sm font-medium">Document type<select required value={typeId} onChange={e => changeDocumentType(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300"><option value="">Select document type with a template</option>{documentTypes.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                        <label className="block text-sm font-medium">Draft title<input required maxLength={255} value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" placeholder="For example, Memorandum on..." /></label>
                        <div className="grid gap-3 sm:grid-cols-2">{([['for', 'FOR'], ['thru', 'THRU'], ['attention', 'ATTENTION'], ['from', 'FROM'], ['subject', 'SUBJECT'], ['date', 'DATE']] as const).map(([key, label]) => <label key={key} className="block text-sm font-medium">{label}{key === 'date' ? <input type="date" value={content[key] ?? ''} onChange={e => change(key, e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" /> : <input required={key === 'from' || key === 'subject'} value={content[key] ?? ''} onChange={e => change(key, e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" />}</label>)}</div>
                        <label className="block text-sm font-medium">CONTENT<textarea required rows={10} value={content.body ?? ''} onChange={e => change('body', e.target.value)} className="mt-1 w-full rounded-lg border-slate-300" placeholder="Write the body of the document. Use blank lines to separate paragraphs." /></label>
                        <div className="space-y-2"><div className="text-sm font-medium">CC</div>{cc.map((value: string, index: number) => <div className="flex gap-2" key={index}><input value={value} onChange={e => change('cc', cc.map((entry: string, i: number) => i === index ? e.target.value : entry))} className="w-full rounded-lg border-slate-300" placeholder="Name or office" /><button type="button" onClick={() => change('cc', cc.filter((_: string, i: number) => i !== index))} className="rounded-lg bg-slate-100 px-3">Remove</button></div>)}<button type="button" onClick={() => change('cc', [...cc, ''])} className="text-sm font-medium text-blue-700">+ Add recipient</button></div>
                        <div className="flex flex-wrap gap-2 border-t pt-4"><button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Save draft</button><button type="button" onClick={downloadPdf} disabled={!selectedTemplate} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Download PDF</button></div>
                    </div>
                    <div className={`${tab === 'edit' ? 'hidden xl:block' : ''}`}><p className="mb-2 text-sm font-medium text-slate-600">Live preview</p>{selectedTemplate ? <PdfPreview template={selectedTemplate.template_json} content={content} logoDataUri={logoDataUri} /> : <p className="rounded-xl border bg-white p-8 text-sm text-slate-500">Choose a document type with an active PDF template to preview it.</p>}</div>
                </form>
                {editing && <div className="mt-4 grid gap-3 rounded-xl bg-blue-50 p-4 md:grid-cols-[1fr_auto]"><div><label className="block text-sm font-medium">Approver<select value={approverId} onChange={e => setApproverId(e.target.value)} className="mt-1 w-full rounded-lg border-slate-300"><option value="">Select individual</option>{approvers.map(a => <option key={a.id} value={a.id}>{a.name}{a.role ? ` · ${a.role}` : ''}</option>)}</select></label><p className="mt-2 text-xs text-slate-600">DOTS will send the saved document data as a fixed version. The approver can preview and print it without you uploading a PDF.</p></div><button type="button" onClick={submitForApproval} className="self-end rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white">Submit for approval</button></div>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold">My drafts and approval tasks</h2><div className="space-y-3">{drafts.length === 0 ? <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">No document creation items yet.</p> : drafts.map(d => <article key={d.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{d.title}</h3><p className="text-sm text-slate-500">{d.document_type?.name} · Created by {d.creator?.name} · Version {d.version_number || 'draft'}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">{d.status.replaceAll('_', ' ')}{d.approver ? ` · Approver: ${d.approver.name}` : ''}</p>{(d.decision_remarks || d.verification_notes) && <p className="mt-2 text-sm text-slate-600">{d.decision_remarks || d.verification_notes}</p>}</div><div className="flex flex-wrap gap-2">
                    {d.created_by === currentUserId && ['draft', 'revision_requested'].includes(d.status) && <button onClick={() => editDraft(d)} className="rounded-lg border px-3 py-2 text-sm">Edit</button>}
                    {d.status === 'pending_approval' && d.current_submission && <button onClick={() => setReviewing(d)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-800">Review version {d.current_submission.version_number}</button>}
                    {d.version_number > 0 && <a href={`/document-creation/${d.id}/submitted-file`} className="rounded-lg border px-3 py-2 text-sm">Download submitted PDF</a>}
                    {d.verified_file_name && <a href={`/document-creation/${d.id}/returned-file`} className="rounded-lg border px-3 py-2 text-sm">View returned file</a>}
                    {['approved', 'awaiting_verification'].includes(d.status) && <form onSubmit={e => verify(e, d.id)} className="flex flex-wrap items-center gap-2"><input type="file" required onChange={e => setReturnedFile(current => ({ ...current, [d.id]: e.target.files?.[0] ?? null }))} className="max-w-56 text-xs"/><select name="result" className="rounded-lg border-slate-300 text-sm"><option value="verified">Matches / verified</option><option value="changes_flagged">Differences flagged</option></select><input name="notes" placeholder="Verification notes" className="w-40 rounded-lg border-slate-300 text-sm"/><button className="rounded-lg bg-violet-700 px-3 py-2 text-sm text-white">Record check</button></form>}
                    {d.status === 'verified' && !d.official_document_id && <button onClick={() => router.post(`/document-creation/${d.id}/register`)} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white">Register in DOTS</button>}
                    {d.official_document_id && <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Registered in Documents</span>}
                </div></div>{d.events?.length ? <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-xs font-medium text-slate-600">Approval and verification history ({d.events.length})</summary><ol className="mt-2 space-y-1">{d.events.map((event, index) => <li key={index} className="text-xs text-slate-600">{event.event} · {event.user?.name ?? 'Former user'} · {new Date(event.created_at).toLocaleString()}{event.remarks ? ` — ${event.remarks}` : ''}</li>)}</ol></details> : null}</article>)}</div></section>
            {reviewing?.current_submission && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Review submitted document"><div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl bg-slate-100 p-5 shadow-2xl"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Review: {reviewing.title}</h2><p className="text-sm text-slate-500">Version {reviewing.current_submission.version_number} · {reviewing.document_type?.name}</p></div><button onClick={() => setReviewing(null)} className="rounded-lg border bg-white px-3 py-2 text-sm">Close</button></div><PdfPreview template={reviewing.current_submission.template_json} content={reviewing.current_submission.content} logoDataUri={reviewing.current_submission.content._logo_data_uri ?? logoDataUri} /><div className="mt-4 flex flex-wrap justify-end gap-2"><button onClick={() => decision(reviewing, 'revision_requested')} className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white">Request revision</button><button onClick={() => decision(reviewing, 'rejected')} className="rounded-lg bg-rose-700 px-4 py-2 text-sm text-white">Reject</button><button onClick={() => decision(reviewing, 'approved')} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white">Approve</button></div></div></div>}
        </div>
    </AuthenticatedLayout>;
}

function toPdfInputs(content: Record<string, any>, logoDataUri: string) {
    return { FOR: content.for ?? '', THRU: content.thru ?? '', ATTENTION: content.attention ?? '', FROM: content.from ?? '', SUBJECT: content.subject ?? '', DATE: content.date ?? '', CONTENT: content.body ?? '', CC: (content.cc ?? []).filter(Boolean).join('; '), logo: logoDataUri };
}

function PdfPreview({ template, content, logoDataUri }: { template: Template; content: Record<string, any>; logoDataUri: string }) {
    const [url, setUrl] = useState('');
    const inputs = useMemo(() => toPdfInputs(content, logoDataUri), [content, logoDataUri]);
    useEffect(() => {
        let active = true;
        let objectUrl = '';
        setUrl('');
        generate({ template, inputs: [inputs], plugins: { image, text } }).then((pdf) => {
            if (!active) return;
            objectUrl = URL.createObjectURL(new Blob([new Uint8Array(pdf).buffer as ArrayBuffer], { type: 'application/pdf' }));
            setUrl(objectUrl);
        }).catch(() => { if (active) setUrl(''); });
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [template, inputs]);

    return url
        ? <div className="space-y-2"><div className="flex justify-end"><a href={url} download="document-preview.pdf" className="rounded-lg border bg-white px-3 py-2 text-sm font-medium">Download preview PDF</a></div><iframe title="PDF preview" src={url} className="h-[780px] w-full rounded-xl border bg-white" /></div>
        : <div className="flex h-[780px] items-center justify-center rounded-xl border bg-white text-sm text-slate-500">Preparing PDF preview…</div>;
}
