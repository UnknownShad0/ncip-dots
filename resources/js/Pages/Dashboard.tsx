import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { Archive, FileClock, Files, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

type DashboardStats = {
    total_documents?: number;
    active_users?: number;
    pending_documents?: number;
    released_today?: number;
    archived_documents?: number;
};

type RecentDocument = {
    id?: string | number;
    title?: string;
    tracking_number?: string;
    status?: string;
    created_at?: string;
    office?: { name?: string } | null;
};

const formatNumber = (value?: number | string) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number.toLocaleString() : '0';
};

const relativeTime = (date: string | undefined, index: number) => {
    if (date) {
        const minutes = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
        if (minutes < 60) return `${minutes} min ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        return `${Math.floor(hours / 24)} days ago`;
    }
    return ['10 min ago', '1 hour ago', '3 hours ago'][index] ?? 'Recently';
};

export default function Dashboard({
    stats = {},
    recentDocuments = [],
}: {
    stats?: DashboardStats;
    recentDocuments?: RecentDocument[];
}) {
    const [query, setQuery] = useState('');
    const documents = useMemo(() => recentDocuments.filter((document) => {
        const search = query.trim().toLowerCase();
        return !search || [document.title, document.tracking_number, document.office?.name].some((value) => value?.toLowerCase().includes(search));
    }), [recentDocuments, query]);

    const cards = [
        {
            label: 'Incoming Documents',
            value: formatNumber(stats.total_documents),
            detail: 'Documents recorded across both systems',
            icon: Files,
            tone: 'border-blue-200 bg-blue-50 text-blue-800',
            iconTone: 'bg-blue-100 text-blue-700',
        },
        {
            label: 'Pending for Release Documents',
            value: formatNumber(stats.pending_documents),
            detail: 'Waiting to be released',
            icon: FileClock,
            tone: 'border-amber-200 bg-amber-50 text-amber-900',
            iconTone: 'bg-amber-100 text-amber-700',
        },
        {
            label: 'Released Documents (Today)',
            value: formatNumber(stats.released_today),
            detail: 'Released so far today',
            icon: Send,
            tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
            iconTone: 'bg-emerald-100 text-emerald-700',
        },
        {
            label: 'Archived Documents',
            value: formatNumber(stats.archived_documents),
            detail: 'Moved to the archives',
            icon: Archive,
            tone: 'border-violet-200 bg-violet-50 text-violet-900',
            iconTone: 'bg-violet-100 text-violet-700',
        },
    ];

    return (
        <AuthenticatedLayout header={
            <div className="flex w-full items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight sm:text-[42px]">Dashboard</h1>
                <label className="hidden h-12 w-full max-w-[360px] items-center gap-3 rounded-xl border border-[#e0e0dc] bg-white px-4 text-[#898984] focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 sm:flex">
                    <Search size={21} />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" className="w-full border-0 bg-transparent p-0 text-[16px] text-[#171717] placeholder:text-[#898984] focus:ring-0" />
                </label>
            </div>
        }>
            <Head title="Dashboard" />
            <div className="mx-auto max-w-[1280px]">
                <section aria-label="Document summary" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {cards.map(({ label, value, detail, icon: Icon, tone, iconTone }) => (
                        <article key={label} className={`flex min-h-[190px] flex-col rounded-2xl border px-5 py-5 shadow-sm sm:px-6 ${tone}`}>
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="max-w-[190px] text-[16px] font-semibold leading-5 text-slate-800">{label}</h2>
                                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
                                    <Icon size={22} strokeWidth={2} aria-hidden="true" />
                                </span>
                            </div>
                            <p className="mt-auto pt-4 text-[36px] font-bold leading-none tracking-tight text-slate-900">{value}</p>
                            <p className="mt-2 text-[13px] leading-5 text-slate-600">{detail}</p>
                        </article>
                    ))}
                </section>

                <section className="rounded-[20px] border border-[#e2e2df] bg-white px-5 py-6 sm:px-8">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h2 className="text-[21px] font-semibold tracking-tight">Recent activity</h2>
                        <span className="text-sm text-[#898984]">Latest {recentDocuments.length}</span>
                    </div>
                    {documents.length === 0 ? (
                        <p className="py-8 text-center text-sm text-[#898984]">{query ? 'No documents match your search.' : 'No recent documents available.'}</p>
                    ) : (
                        <ul>
                            {documents.map((document, index) => (
                                <li key={document.id ?? `${document.title ?? 'document'}-${index}`} className="flex flex-col gap-1 border-b border-[#e2e2df] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                                    <div className="min-w-0">
                                        <p className="truncate text-[16px] font-medium">{document.title || document.tracking_number || 'Document activity'}</p>
                                        <p className="mt-0.5 text-sm text-[#898984]">{[document.tracking_number, document.office?.name, document.status].filter(Boolean).join(' · ') || 'Document updated'}</p>
                                    </div>
                                    <time className="shrink-0 text-sm text-[#898984]">{relativeTime(document.created_at, index)}</time>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
