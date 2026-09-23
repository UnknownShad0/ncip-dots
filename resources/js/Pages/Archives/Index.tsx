import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function ArchivesIndex({ documents = [] }: { documents?: any[] }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">Archives</h2>}
        >
            <Head title="Archives" />

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-800">Archived Documents</h3>

                {documents.length === 0 ? (
                    <p className="text-slate-500">No archived documents yet.</p>
                ) : (
                    <div className="space-y-3">
                        {documents.map((document) => (
                            <div key={document.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                                <div>
                                    <div className="font-medium text-slate-800">{document.title}</div>
                                    <div className="text-sm text-slate-500">{document.tracking_number}</div>
                                </div>
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                                    Archived
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
