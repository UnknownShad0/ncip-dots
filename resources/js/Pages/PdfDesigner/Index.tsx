import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { FileText, PencilRuler } from 'lucide-react';

type DocumentTypeItem = { id: number; name: string; creation_template?: { id: number; name: string; version: number; is_active: boolean } | null };

export default function Index({ documentTypes = [] }: { documentTypes: DocumentTypeItem[] }) {
    return <AuthenticatedLayout header={<div><p className="text-xs uppercase tracking-[.18em] text-slate-500">Document creation</p><h1 className="text-2xl font-semibold">PDF Templates</h1></div>}>
        <Head title="PDF Templates" />
        <div className="mx-auto max-w-5xl space-y-4">
            <p className="text-sm text-slate-600">Choose a document type to arrange its fields on an A4 page. The saved layout is used for both draft previews and generated PDFs.</p>
            {documentTypes.map((type) => <article key={type.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><FileText size={20}/></span><div><h2 className="font-semibold">{type.name}</h2><p className="text-sm text-slate-500">{type.creation_template?.is_active ? `${type.creation_template.name} · version ${type.creation_template.version}` : 'No template saved'}</p></div></div>
                <Link href={route('document-templates.edit', type.id)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"><PencilRuler size={16}/>{type.creation_template ? 'Edit template' : 'Create template'}</Link>
            </article>)}
        </div>
    </AuthenticatedLayout>;
}
