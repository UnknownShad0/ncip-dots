import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DocumentStats = {
    incoming_documents?: number;
    pending_documents?: number;
    released_documents?: number;
    archived_documents?: number;
};

export default function DashboardCharts({ stats, documentTypes }: { stats: DocumentStats; documentTypes: { name: string; count: number }[] }) {
    const data = [
        { name: 'Incoming', count: stats.incoming_documents ?? 0, color: '#3b82f6' },
        { name: 'Pending for Release', count: stats.pending_documents ?? 0, color: '#d97706' },
        { name: 'Released', count: stats.released_documents ?? 0, color: '#059669' },
        { name: 'Archived', count: stats.archived_documents ?? 0, color: '#8b5cf6' },
    ];
    const hasDocuments = data.some((item) => item.count > 0);

    return (
        <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="document-overview-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="document-overview-title" className="text-lg font-semibold text-slate-900">Document Overview</h2>
            <p className="mt-1 text-sm text-slate-500">Current document counts matching the summary cards above.</p>
            {hasDocuments ? <div className="mt-5 h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 60, bottom: 4, left: 0 }} accessibilityLayer>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 12 }} interval={0} />
                        <Tooltip cursor={{ fill: '#f1f5f9' }} />
                        <Bar dataKey="count" name="Documents" radius={[0, 4, 4, 0]} maxBarSize={32}>
                            {data.map((item) => <Cell key={item.name} fill={item.color} />)}
                            <LabelList dataKey="count" position="right" className="fill-slate-700" fontSize={12} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div> : <p className="flex h-72 items-center justify-center text-sm text-slate-500">No incoming, pending, released, or archived documents available.</p>}
            <p className="mt-3 text-xs text-slate-500">Counts may overlap: a document can appear in more than one category.</p>
            <details className="mt-3 text-sm text-slate-600">
                <summary className="cursor-pointer">View document counts</summary>
                <ul className="mt-2 space-y-1">{data.map((item) => <li key={item.name} className="flex justify-between gap-3"><span>{item.name}</span><span>{item.count.toLocaleString()}</span></li>)}</ul>
            </details>
        </section>
        <section aria-labelledby="document-types-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 id="document-types-title" className="text-lg font-semibold text-slate-900">Documents by Type</h2>
            <p className="mt-1 text-sm text-slate-500">All-time counts for accessible documents, including legacy records.</p>
            {documentTypes.length ? <div className="mt-5 h-72 overflow-y-auto">
                <div style={{ height: Math.max(288, documentTypes.length * 44) }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={documentTypes} layout="vertical" margin={{ top: 8, right: 60, bottom: 4, left: 0 }} accessibilityLayer>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                            <YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 11 }} interval={0} tickFormatter={(name: string) => name.length > 19 ? `${name.slice(0, 18)}…` : name} />
                            <Tooltip cursor={{ fill: '#f1f5f9' }} />
                            <Bar dataKey="count" name="Documents" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={24}>
                                <LabelList dataKey="count" position="right" className="fill-slate-700" fontSize={12} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div> : <p className="flex h-72 items-center justify-center text-sm text-slate-500">No documents available.</p>}
            <details className="mt-3 text-sm text-slate-600">
                <summary className="cursor-pointer">View document type counts</summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">{documentTypes.map((item) => <li key={item.name} className="flex justify-between gap-3"><span>{item.name}</span><span>{item.count.toLocaleString()}</span></li>)}</ul>
            </details>
        </section>
        </div>
    );
}
