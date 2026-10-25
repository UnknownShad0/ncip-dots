import InfoTip from './InfoTip';
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
    const maxValue = Math.max(0, ...data.flatMap(row => [row.tracking ?? 0, row.approval ?? 0]));
    const axisUnit = maxValue < 1 / 24 ? 'minutes' : maxValue < 1 ? 'hours' : 'weekdays';
    const toAxisUnit = (value: number) => axisUnit === 'minutes' ? value * 1440 : axisUnit === 'hours' ? value * 24 : value;
    const display = (value: number | null, count: number) => {
        if (value === null) return 'No data';
        const unit = value < 1 / 24 ? 'minutes' : value < 1 ? 'hours' : 'weekdays';
        const amount = unit === 'minutes' ? value * 1440 : unit === 'hours' ? value * 24 : value;
        return `${amount.toLocaleString(undefined, { maximumFractionDigits: unit === 'minutes' ? 1 : 2 })} ${unit} · ${count} completed`;
    };
    return <section aria-labelledby="processing-performance-title" className="min-w-0 rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h3 id="processing-performance-title" className="text-lg font-semibold text-foreground">Processing turnaround</h3><InfoTip label="How turnaround is measured">Tracking: receipt to release. Approval: submission to decision, including rejection or revision. Monday–Friday elapsed time in Manila; weekends excluded, holidays included. Pending items are excluded. No data means no measurable completed records, not zero days.</InfoTip></div>
        <p className="mt-1 text-sm text-muted">All-time median · weekdays · shorter bars mean faster processing</p>
        {hasData ? <div className="mt-5 hidden max-h-[480px] overflow-y-auto sm:block">
            <div style={{ height: Math.max(260, data.length * 76 + 70) }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 16, left: 0 }} accessibilityLayer>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgb(var(--color-border))" />
                        <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 15 }} tickFormatter={(value: number) => toAxisUnit(value).toLocaleString(undefined, { maximumFractionDigits: axisUnit === 'minutes' ? 1 : 2 })} label={{ value: `${axisUnit[0].toUpperCase()}${axisUnit.slice(1)} (median)`, position: 'insideBottom', offset: -10, fontSize: 15 }} />
                        <YAxis type="category" dataKey="label" width={115} interval={0} tick={{ fontSize: 14 }} tickFormatter={(name: string) => name.length > 19 ? `${name.slice(0, 18)}…` : name} />
                        <Tooltip content={({ active, payload }) => {
                            const row = payload?.[0]?.payload as ProcessingPerformanceRow | undefined;
                            return active && row ? <div className="rounded-lg border border-border bg-surface p-3 text-sm shadow-lg">
                                <p className="mb-2 font-semibold">{row.name}</p>
                                <p className="text-primary">Tracking: {display(row.tracking, row.tracking_count)}</p>
                                <p className="text-tertiary">Approval: {display(row.approval, row.approval_count)}</p>
                            </div> : null;
                        }} />
                        <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 16, fontSize: 15 }} />
                        <Bar isAnimationActive={false} dataKey="tracking" name="Document Tracking" fill="rgb(var(--color-primary))" radius={[0, 4, 4, 0]} maxBarSize={20} minPointSize={2} />
                        <Bar isAnimationActive={false} dataKey="approval" name="Document Approval" fill="rgb(var(--color-tertiary))" radius={[0, 4, 4, 0]} maxBarSize={20} minPointSize={2} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div> : <p className="flex min-h-40 items-center justify-center text-center text-sm text-muted">No completed receipt-to-release or approval records with sufficient history in this office scope.</p>}

        {hasData && <div className="mt-4 space-y-3 sm:hidden" aria-label="Processing turnaround by office">
            {data.map(row => <article key={row.office_id} className="rounded-lg border border-border bg-background p-3">
                <h4 className="font-semibold text-foreground">{row.name}</h4>
                <dl className="mt-2 space-y-2 text-sm">
                    <div><dt className="font-medium text-primary">Document Tracking</dt><dd className="text-muted">{display(row.tracking, row.tracking_count)}</dd></div>
                    <div><dt className="font-medium text-tertiary">Document Approval</dt><dd className="text-muted">{display(row.approval, row.approval_count)}</dd></div>
                </dl>
            </article>)}
        </div>}

        {data.length > 0 && <details className="mt-3 text-sm text-muted">
            <summary className="cursor-pointer">View turnaround and completed counts</summary>
            <div className="mt-3 hidden max-h-72 overflow-auto sm:block" tabIndex={0} role="region" aria-label="Turnaround data table">
                <table className="w-full text-left text-sm">
                    <thead><tr className="border-b"><th className="p-2">Office</th><th className="p-2">Document Tracking</th><th className="p-2">Document Approval</th></tr></thead>
                    <tbody>{data.map(row => <tr key={row.office_id} className="border-b border-border"><th className="p-2 font-medium">{row.name}</th><td className="whitespace-nowrap p-2">{display(row.tracking, row.tracking_count)}</td><td className="whitespace-nowrap p-2">{display(row.approval, row.approval_count)}</td></tr>)}</tbody>
                </table>
            </div>
        </details>}
    </section>;
}
