import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import type { Template } from '@pdfme/common';
import type { Designer as DesignerInstance } from '@pdfme/ui';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type Props = {
    documentType: { id: number; name: string };
    templateId: number | null;
    templateName: string;
    templateVersion: number;
    template: Template;
    logoUrl: string;
    saveUrl: string;
};

export default function Edit({ documentType, templateName, templateVersion, template, logoUrl, saveUrl }: Props) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const designerRef = useRef<DesignerInstance | null>(null);
    const [currentTemplate, setCurrentTemplate] = useState<Template>(template);
    const [saving, setSaving] = useState(false);
    const [designerError, setDesignerError] = useState<string | null>(null);

    useEffect(() => {
        let designer: DesignerInstance | null = null;
        let cancelled = false;

        const initializeDesigner = async () => {
            try {
                const [{ Designer }, { image, text }] = await Promise.all([
                    import('@pdfme/ui'),
                    import('@pdfme/schemas'),
                ]);

                if (cancelled || !canvasRef.current) return;

                designer = new Designer({
                    domContainer: canvasRef.current,
                    template,
                    plugins: { image, text },
                    options: { zoomLevel: 1, sidebarOpen: true },
                });
                designer.onChangeTemplate((updated) => setCurrentTemplate(updated));
                designerRef.current = designer;
                setDesignerError(null);
            } catch (error) {
                console.error('Could not initialize the PDF template designer.', error);
                const reason = error instanceof Error ? error.message : String(error);
                setDesignerError(`The PDF designer could not load: ${reason}`);
            }
        };

        void initializeDesigner();

        return () => {
            cancelled = true;
            designer?.destroy();
            designerRef.current = null;
        };
    }, [template]);

    const save = () => {
        const updated = designerRef.current?.getTemplate() as Template | undefined;
        if (!updated) return;
        setSaving(true);
        router.put(saveUrl, { template_json: updated as any }, {
            preserveScroll: true,
            onSuccess: () => setCurrentTemplate(updated),
            onFinish: () => setSaving(false),
        });
    };

    return <AuthenticatedLayout header={<div><p className="text-xs uppercase tracking-[.18em] text-slate-500">PDF template builder</p><h1 className="text-2xl font-semibold">{documentType.name}</h1></div>}>
        <Head title={`Design ${templateName}`} />
        <div className="mx-auto max-w-[1500px] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
                <div><Link href={route('document-templates.index')} className="mb-1 inline-flex items-center gap-1 text-sm text-blue-700"><ArrowLeft size={15}/>PDF templates</Link><p className="text-sm text-slate-600">Drag fields to position them. Coordinates are in millimeters on an A4 page. Saved template version: {templateVersion || 'new'}.</p><p className="text-xs text-slate-500">Logo source: {logoUrl}</p></div>
                <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving ? 'Saving…' : 'Save Template'}</button>
            </div>
            <div className="min-h-[78vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {designerError && <div role="alert" className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{designerError}</div>}
                <div ref={canvasRef} className="min-h-[78vh]" />
            </div>
            <p className="text-xs text-slate-500">The starter template includes the standard document fields and NCIP header image. Add or reposition fields using the designer. {Object.keys(currentTemplate).length > 0 ? 'Unsaved changes are held in this page until saved.' : ''}</p>
        </div>
    </AuthenticatedLayout>;
}
