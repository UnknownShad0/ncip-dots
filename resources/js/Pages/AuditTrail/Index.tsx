import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function AuditTrailIndex({ trail = [] }: { trail?: any[] }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">Audit Trail</h2>}
        >
            <Head title="Audit Trail" />

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-800">Recent System Activity</h3>

                <div className="space-y-3">
                    {trail.length === 0 ? (
                        <p className="text-slate-500">No activity recorded yet.</p>
                    ) : (
                        trail.map((entry) => (
                            <div key={entry.id} className="rounded-lg border border-slate-200 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-slate-800">{entry.action}</div>
                                        <div className="text-sm text-slate-500">
                                            {entry.user ? entry.user.name : 'System'}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {new Date(entry.created_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
