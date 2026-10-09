import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function AuditTrailIndex({ trail = [] }: { trail?: any[] }) {
    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">System activity</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Audit Trail</h1></div>}
        >
            <Head title="Audit Trail" />

            <div className="mx-auto max-w-[1440px] rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-[#171717]">Recent system activity</h2><p className="mt-1 text-sm text-[#73736e]">Review recent recorded actions.</p></div>

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
                                            {entry.user ? (entry.user.short_name || entry.user.name) : 'System'}
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
