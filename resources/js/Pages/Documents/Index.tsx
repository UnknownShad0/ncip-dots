import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function DocumentsIndex({ documents = [] }: { documents?: any[] }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">Documents</h2>}
        >
            <Head title="Documents" />

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">Document Register</h3>
                    <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                        New Document
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3">Tracking No.</th>
                                <th className="px-4 py-3">Title</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Office</th>
                            </tr>
                        </thead>
                        <tbody>
                            {documents.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                                        No documents found.
                                    </td>
                                </tr>
                            ) : (
                                documents.map((document) => (
                                    <tr key={document.id} className="border-t border-slate-200">
                                        <td className="px-4 py-3">{document.tracking_number || 'N/A'}</td>
                                        <td className="px-4 py-3">{document.title || 'Untitled'}</td>
                                        <td className="px-4 py-3">
                                            <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700">
                                                {document.status || 'pending'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{document.office?.name || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
