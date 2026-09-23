import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

type SigningTrail = {
    step: number;
    name: string;
    email: string;
    signedAt: string;
    declined: boolean;
    remarks: string | null;
};

type DocumentRow = {
    dotsId: string;
    fileName: string;
    fileType: string;
    originatorName: string;
    originatorEmail: string;
    uploadedAt: string;
    sharedAt: string;
    signers: string;
    status: string;
    signingTrails: SigningTrail[];
};

function statusBadge(status: string) {
    const map: Record<string, string> = {
        SIGNED: 'bg-emerald-100 text-emerald-700',
        'IN PROGRESS': 'bg-sky-100 text-sky-700',
        DECLINED: 'bg-rose-100 text-rose-700',
        UPLOADED: 'bg-amber-100 text-amber-700',
    };

    return (
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
}

export default function IntegrationsIndex({
    system = 'DRIP',
    documents = [],
}: {
    system?: string;
    documents?: DocumentRow[];
}) {
    const [selected, setSelected] = useState<DocumentRow | null>(null);

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">{system} – DOTS Summary</h2>}
        >
            <Head title={system} />

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800">{system} Documents</h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3">DOTS ID</th>
                                <th className="px-4 py-3">File Name</th>
                                <th className="px-4 py-3">Originator</th>
                                <th className="px-4 py-3">Uploaded At</th>
                                <th className="px-4 py-3">Shared At</th>
                                <th className="px-4 py-3">Signers</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                                        No {system} data available.
                                    </td>
                                </tr>
                            ) : (
                                documents.map((doc) => (
                                    <tr key={doc.dotsId} className="border-t border-slate-200">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{doc.dotsId}</td>
                                        <td className="px-4 py-3 text-slate-700">{doc.fileName}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-800">{doc.originatorName}</div>
                                            <div className="text-xs text-slate-500">{doc.originatorEmail}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{doc.uploadedAt}</td>
                                        <td className="px-4 py-3 text-slate-600">{doc.sharedAt}</td>
                                        <td className="px-4 py-3 text-slate-600">{doc.signers}</td>
                                        <td className="px-4 py-3">{statusBadge(doc.status)}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => setSelected(doc)}
                                                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                                            >
                                                View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                    <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">Signing Trails</h3>
                                <p className="text-sm text-slate-500">{selected.dotsId} • {selected.fileName}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelected(null)}
                                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-[70vh] overflow-auto p-6">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-slate-100 text-slate-700">
                                    <tr>
                                        <th className="px-3 py-2">Step</th>
                                        <th className="px-3 py-2">Signer</th>
                                        <th className="px-3 py-2">Email</th>
                                        <th className="px-3 py-2">Signed At</th>
                                        <th className="px-3 py-2">Status</th>
                                        <th className="px-3 py-2">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selected.signingTrails.map((trail) => (
                                        <tr key={`${selected.dotsId}-${trail.step}`} className="border-t border-slate-200">
                                            <td className="px-3 py-2">{trail.step}</td>
                                            <td className="px-3 py-2">{trail.name}</td>
                                            <td className="px-3 py-2 text-slate-600">{trail.email}</td>
                                            <td className="px-3 py-2 text-slate-600">{trail.signedAt}</td>
                                            <td className="px-3 py-2">
                                                {trail.declined ? (
                                                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">Declined</span>
                                                ) : trail.signedAt === 'Pending' ? (
                                                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Pending</span>
                                                ) : (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Signed</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-slate-600">{trail.remarks ?? '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
