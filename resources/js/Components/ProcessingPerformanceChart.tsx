import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type ProcessingPerformanceRow = {
    office_id: number;
    name: string;
    label: string;
    tracking: number | null;
    approval: number | null;
    tracking_count: number;
    approval_count: number;
};

export default function ProcessingPerformanceChart({ data }: { data: ProcessingPerformanceRow[] }) {
    const hasData = data.some(row => row.tracking !== null || row.approval !== null);
    const display = (value: number | null, count: number) => value === null ? 'No data' : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} days · ${count} completed`;
    return <section aria-labelledby="processing-performance-title" className="mb-8 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 id="processing-performance-title" className="text-lg font-semibold text-slate-900">Processing Performance</h2>
        <p className="mt-1 text-sm text-slate-500">All-time median turnaround per office. Shorter bars mean faster processing.</p>
        {hasData ? <div className="mt-5 max-h-[480px] overflow-y-auto">
            <div style={{ height: Math.max(260, data.length * 76 + 70) }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 16, left: 0 }} accessibilityLayer>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                        <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 12 }} label={{ value: 'Weekdays (median)', position: 'insideBottom', offset: -10, fontSize: 12 }} />
                        <YAxis type="category" dataKey="label" width={115} interval={0} tick={{ fontSize: 11 }} tickFormatter={(name: string) => name.length > 19 ? `${name.slice(0, 18)}…` : name} />
                        <Tooltip content={({ active, payload }) => {
                            const row = payload?.[0]?.payload as ProcessingPerformanceRow | undefined;
                            return active && row ? <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg">
                                <p className="mb-2 font-semibold">{row.name}</p>
                                <p className="text-blue-700">Tracking: {display(row.tracking, row.tracking_count)}</p>
                                <p className="text-violet-700">Approval: {display(row.approval, row.approval_count)}</p>
                            </div> : null;
                        }} />
                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 12 }} />
                        <Bar dataKey="tracking" name="Document Tracking" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={20} />
                        <Bar dataKey="approval" name="Document Approval" fill="#7c3aed" radius={[0, 4, 4, 0]} maxBarSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div> : <p className="flex min-h-40 items-center justify-center text-center text-sm text-slate-500">No completed receipt-to-release or approval records with sufficient history in this office scope.</p>}
        <p className="mt-4 text-xs leading-5 text-slate-500">Tracking: receipt to release. Approval: submission to decision, including rejection or a request for revision. Monday–Friday elapsed time in Manila; weekends excluded, holidays included. Pending items are excluded. No data means no measurable completed records, not zero days.</p>
        {data.length > 0 && <details className="mt-3 text-sm text-slate-600">
            <summary className="cursor-pointer">View turnaround and completed counts</summary>
            <div className="mt-3 max-h-72 overflow-auto">
                <table className="w-full text-left text-sm">
                    <thead><tr className="border-b"><th className="p-2">Office</th><th className="p-2">Document Tracking</th><th className="p-2">Document Approval</th></tr></thead>
                    <tbody>{data.map(row => <tr key={row.office_id} className="border-b border-slate-100"><th className="p-2 font-medium">{row.name}</th><td className="whitespace-nowrap p-2">{display(row.tracking, row.tracking_count)}</td><td className="whitespace-nowrap p-2">{display(row.approval, row.approval_count)}</td></tr>)}</tbody>
                </table>
            </div>
        </details>}
    </section>;
}
