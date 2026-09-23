import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function SetupIndex({
    offices = [],
    documentTypes = [],
    actionTypes = [],
    purposeTypes = [],
}: {
    offices?: any[];
    documentTypes?: any[];
    actionTypes?: any[];
    purposeTypes?: any[];
}) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">Setup</h2>}
        >
            <Head title="Setup" />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Offices</h3>
                    <div className="mt-4 text-3xl font-bold text-slate-800">{offices.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Document Types</h3>
                    <div className="mt-4 text-3xl font-bold text-slate-800">{documentTypes.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Action Types</h3>
                    <div className="mt-4 text-3xl font-bold text-slate-800">{actionTypes.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Purpose Types</h3>
                    <div className="mt-4 text-3xl font-bold text-slate-800">{purposeTypes.length}</div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
