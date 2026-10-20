import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import InfoTip from './InfoTip';

type DocumentStats = {
    incoming_documents?: number;
    pending_documents?: number;
    released_documents?: number;
    archived_documents?: number;
};

// Independent bars share a scale, rather than implying mutually exclusive parts of a total.
function CountBars({ rows }: { rows: { name: string; count: number; color: string }[] }) {
    const reduced = useReducedMotion();
    const maximum = Math.max(1, ...rows.map((row) => row.count));
    return <ul className="space-y-5">{rows.map((row) => <li key={row.name}>
        <div className="mb-2 flex items-baseline justify-between gap-4 text-sm"><span className="min-w-0 break-words">{row.name}</span><span className="shrink-0 font-semibold tabular-nums">{row.count.toLocaleString()}</span></div>
        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-background"><motion.div initial={false} animate={{width: `${Math.max(0, row.count) / maximum * 100}%`}} transition={{duration: reduced ? 0 : .2}} className={`h-full rounded-full ${row.color}`} /></div>
    </li>)}</ul>;
}

export default function DashboardCharts({ stats, documentTypes, officeFiltered = false }: { officeFiltered?: boolean; stats: DocumentStats; documentTypes: { name: string; count: number }[] }) {
    const [showAll, setShowAll] = useState(false);
    const counts = [
        { name: 'Incoming', count: stats.incoming_documents ?? 0, color: 'bg-primary' },
        { name: 'Pending release', count: stats.pending_documents ?? 0, color: 'bg-warning' },
        { name: 'Released', count: stats.released_documents ?? 0, color: 'bg-success' },
        { name: 'Archived', count: stats.archived_documents ?? 0, color: 'bg-sidebar' },
    ];
    const rankedTypes = [...documentTypes].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const visibleTypes = showAll ? rankedTypes : rankedTypes.slice(0, 5);
    return <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="document-overview-title" className="min-w-0 rounded-lg border border-border bg-surface p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between gap-3"><h3 id="document-overview-title" className="text-lg font-semibold">Workflow overview</h3><InfoTip label="How workflow counts are counted">Counts for {officeFiltered ? 'the selected office' : 'the current chart scope'}. A document can appear in more than one category, so the bars are independent counts, not portions of a total.</InfoTip></div>
            <p className="mb-6 text-xs text-muted">Independent counts · categories may overlap</p>
            {counts.some((item) => item.count > 0) ? <CountBars rows={counts} /> : <p className="flex min-h-48 items-center justify-center text-sm text-muted">No documents in this chart scope.</p>}
        </section>
        <section aria-labelledby="document-types-title" className="min-w-0 rounded-lg border border-border bg-surface p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between gap-3"><h3 id="document-types-title" className="text-lg font-semibold">Documents by type</h3><InfoTip label="About document type counts">All-time document counts in {officeFiltered ? 'the selected office' : 'the current chart scope'}, including imported records. Personal-only access is excluded. Types are ranked from most to least documents.</InfoTip></div>
            <p className="mb-6 text-xs text-muted">All time · {showAll ? 'All types' : 'Top 5 types'}</p>
            {rankedTypes.some((item) => item.count > 0) ? <div id="document-type-bars" className="max-h-80 overflow-y-auto"><CountBars rows={visibleTypes.map((item) => ({...item, color: 'bg-primary'}))} /></div> : <p className="flex min-h-48 items-center justify-center text-sm text-muted">No document types in this chart scope.</p>}
            {rankedTypes.length > 5 && <button type="button" aria-expanded={showAll} aria-controls="document-type-bars" onClick={() => setShowAll((value) => !value)} className="mt-5 text-sm font-semibold text-primary hover:underline">{showAll ? 'Show top 5' : `Show all ${rankedTypes.length} types`}</button>}
        </section>
    </div>;
}
