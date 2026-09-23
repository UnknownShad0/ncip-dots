import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function Dashboard({
    stats = {},
    recentDocuments = [],
}: {
    stats?: any;
    recentDocuments?: any[];
}) {
    const cards = [
        { label: 'Total Documents', value: stats.total_documents || 0, color: 'bg-sky-100 text-sky-700' },
        { label: 'Active Users', value: stats.active_users || 0, color: 'bg-emerald-100 text-emerald-700' },
        { label: 'Pending', value: stats.pending_documents || 0, color: 'bg-amber-100 text-amber-700' },
        { label: 'Archived', value: stats.archived_documents || 0, color: 'bg-violet-100 text-violet-700' },
    ];

    return (
        <AuthenticatedLayout
            header={
                <h2 className="text-xl font-semibold leading-tight text-slate-800">
                    Dashboard
                </h2>
            }
        >
            <Head title="Dashboard" />

            <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {cards.map((card) => (
                        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${card.color}`}>
                                {card.label}
                            </div>
                            <div className="mt-4 text-3xl font-bold text-slate-800">{card.value}</div>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-lg font-semibold text-slate-800">Recent Documents</h3>

                    <div className="space-y-3">
                        {recentDocuments.length === 0 ? (
                            <p className="text-slate-500">No recent documents available.</p>
                        ) : (
                            recentDocuments.map((document) => (
                                <div key={document.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                                    <div>
                                        <div className="font-medium text-slate-800">{document.title}</div>
                                        <div className="text-sm text-slate-500">{document.tracking_number}</div>
                                    </div>
                                    <div className="text-right text-sm text-slate-600">
                                        <div>{document.status || 'pending'}</div>
                                        <div>{document.office?.name || 'Unassigned'}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
