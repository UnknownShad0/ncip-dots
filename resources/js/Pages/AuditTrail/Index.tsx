import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';

type Pagination = { current_page: number; last_page: number; total: number; from: number | null; to: number | null; prev_page_url: string | null; next_page_url: string | null };

export default function AuditTrailIndex({ trail = [], pagination, canFilterBureaus = false, bureaus = [], filters = { office_id: null }, scopeNotice }: { trail?: any[]; pagination?: Pagination; scopeNotice?: string | null; canFilterBureaus?: boolean; bureaus?: Array<{ id: number; name: string }>; filters?: { office_id: number | null } }) {
    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">System activity</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Audit Trail</h1></div>}
        >
            <Head title="Audit Trail" />

            <div className="mx-auto max-w-[1440px] rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm sm:p-6">
                <div className="mb-5"><h2 className="text-xl font-semibold tracking-tight text-[#171717]">System activity history</h2><p className="mt-1 text-sm text-[#73736e]">Review recorded actions, including imported legacy activity.</p></div>

                {scopeNotice && <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{scopeNotice}</p>}

                {canFilterBureaus && <div className="mb-5 max-w-xl">
                    <label htmlFor="audit-bureau" className="mb-1 block text-sm font-medium text-slate-700">Bureau</label>
                    <select id="audit-bureau" value={filters.office_id ?? ''} onChange={(event) => router.get('/audit-trail', event.target.value ? { office_id: event.target.value } : {}, { preserveState: true, preserveScroll: true, replace: true })} className="w-full rounded-lg border-slate-300 text-sm">
                        <option value="">All bureaus</option>
                        {bureaus.map((bureau) => <option key={bureau.id} value={bureau.id}>{bureau.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Native entries use the bureau recorded at the time. Legacy entries without a bureau snapshot are matched using the actor's current bureau assignment.</p>
                </div>}

                <div className="space-y-3">
                    {trail.length === 0 ? (
                        <p className="text-slate-500">{filters.office_id ? 'No activity found for this bureau.' : 'No activity recorded yet.'}</p>
                    ) : (
                        trail.map((entry) => (
                            <div key={entry.id} className="rounded-lg border border-slate-200 p-4">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-slate-800">{entry.action || 'Unspecified action'}{entry.record_source === 'legacy_import' && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Legacy</span>}{entry.result && <span className={`ml-2 rounded px-2 py-0.5 text-xs ${entry.result === 'failure' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{entry.result}</span>}</div>
                                        {entry.legacy_module && <div className="mt-1 text-xs text-slate-500">{entry.legacy_module}</div>}
                                        <div className="text-sm text-slate-500">
                                            {entry.actor_name || (entry.user ? (entry.user.short_name || entry.user.name) : entry.action === 'login.failed' || entry.action === 'login.rate_limited' || entry.action === 'password.reset_requested' ? 'Unauthenticated request' : entry.record_source === 'legacy_import' ? 'User not recorded or unavailable' : 'System')}
                                            {entry.actor_office_name && <span className="block text-xs">{entry.actor_office_name}</span>}
                                            {entry.bureau_filter_uses_current_assignment && <span className="block text-xs">Historical bureau unavailable; matched by current assignment</span>}
                                        </div>
                                        {entry.details && <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">{entry.details}</pre>}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Date not recorded'}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {pagination && pagination.total > 0 && <nav aria-label="Audit trail pagination" className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
                    <p className="text-slate-600">{pagination.from ?? 0}–{pagination.to ?? 0} of {pagination.total.toLocaleString()} entries · Page {pagination.current_page} of {pagination.last_page}</p>
                    <div className="flex gap-2">
                        {pagination.prev_page_url ? <Link href={pagination.prev_page_url} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">Previous</Link> : <span aria-disabled="true" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-400">Previous</span>}
                        {pagination.next_page_url ? <Link href={pagination.next_page_url} className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">Next</Link> : <span aria-disabled="true" className="rounded-lg border border-slate-200 px-3 py-2 text-slate-400">Next</span>}
                    </div>
                </nav>}
            </div>
        </AuthenticatedLayout>
    );
}
