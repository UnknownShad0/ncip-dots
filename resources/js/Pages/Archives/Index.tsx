import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function ArchivesIndex({ documents = [] }: { documents?: any[] }) {
    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Document management</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Archives</h1></div>}
        >
            <Head title="Archives" />

            <div className="mx-auto max-w-[1440px] rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-[#171717]">Archived documents</h2><p className="mt-1 text-sm text-[#73736e]">Browse documents moved to archive.</p></div>

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
