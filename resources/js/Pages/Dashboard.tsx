import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/CrudAlertModal';
import { Head, router } from '@inertiajs/react';
import { Archive, ArrowDownToLine, FileClock, Files, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';

type DashboardStats = {
    incoming_documents?: number;
    active_users?: number;
    pending_documents?: number;
    released_documents?: number;
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

type IncomingDocument = {
    id: number;
    tracking_number: string;
    title: string;
    from_office?: string | null;
    creator_name?: string | null;
};

type CrudAlert = { title: string; message: string; onConfirm?: () => void; confirmLabel?: string };

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
    incomingDocuments = [],
    canReceiveDocuments = false,
}: {
    stats?: DashboardStats;
    recentDocuments?: RecentDocument[];
    incomingDocuments?: IncomingDocument[];
    canReceiveDocuments?: boolean;
}) {
    const [query, setQuery] = useState('');
    const [incomingQuery, setIncomingQuery] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [receiveError, setReceiveError] = useState('');
    const [receivingId, setReceivingId] = useState<number | null>(null);
    const [crudAlert, setCrudAlert] = useState<CrudAlert | null>(null);
    const documents = useMemo(() => recentDocuments.filter((document) => {
        const search = query.trim().toLowerCase();
        return !search || [document.title, document.tracking_number, document.office?.name].some((value) => value?.toLowerCase().includes(search));
    }), [recentDocuments, query]);
    const visibleIncoming = useMemo(() => {
        const search = incomingQuery.trim().toLowerCase();
        return incomingDocuments.filter((document) => !search || [
            document.tracking_number, document.title, document.from_office, document.creator_name,
        ].some((value) => value?.toLowerCase().includes(search)));
    }, [incomingDocuments, incomingQuery]);

    const receive = (document: IncomingDocument) => {
        if (!canReceiveDocuments || receivingId !== null) return;
        setReceivingId(document.id);
        setReceiveError('');
        router.post(`/documents/${document.id}/receive`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setTrackingNumber('');
                setCrudAlert({ title: 'Document received', message: 'Document received successfully.' });
            },
            onError: (errors) => setReceiveError(errors.tracking_number ?? 'Could not receive this document. Refresh the incoming list and try again.'),
            onFinish: () => setReceivingId(null),
        });
    };

    const confirmReceive = (document: IncomingDocument) => {
        setCrudAlert({
            title: 'Receive document?',
            message: `Confirm receipt of ${document.tracking_number || 'this document'}?`,
            confirmLabel: 'Receive',
            onConfirm: () => {
                setCrudAlert(null);
                receive(document);
            },
        });
    };

    const receiveByTrackingNumber = () => {
        const normalized = trackingNumber.trim().toLowerCase();
        const document = incomingDocuments.find((item) => item.tracking_number.toLowerCase() === normalized);
        if (!document) {
            setReceiveError('No available incoming document matches that tracking number.');
            return;
        }
        confirmReceive(document);
    };

    const cards = [
        {
            label: 'Incoming Documents',
            value: formatNumber(stats.incoming_documents),
            detail: 'Available documents addressed to your office',
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
            label: 'Released Documents',
            value: formatNumber(stats.released_documents),
            detail: 'Currently released from your office',
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
            {crudAlert && <CrudAlertModal {...crudAlert} onClose={() => setCrudAlert(null)} />}
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

                <section aria-labelledby="receive-document-title" className="mb-8 rounded-[20px] border border-blue-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-5 flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><ArrowDownToLine size={22} /></span>
                        <div>
                            <h2 id="receive-document-title" className="text-xl font-semibold tracking-tight">Receive Document</h2>
                            <p className="mt-1 text-sm text-[#73736e]">Receive documents addressed to your office. Allowed roles: System Admin, Executive, Admin Staff, and Encoder.</p>
                        </div>
                    </div>

                    {canReceiveDocuments ? <>
                        <form onSubmit={(event) => { event.preventDefault(); receiveByTrackingNumber(); }} className="mb-5 flex flex-col gap-2 sm:flex-row">
                            <label className="sr-only" htmlFor="receive-tracking-number">Tracking number</label>
                            <input id="receive-tracking-number" value={trackingNumber} onChange={(event) => { setTrackingNumber(event.target.value); setReceiveError(''); }} placeholder="Enter tracking number" className="min-w-0 flex-1 rounded-xl border-slate-300 text-sm" />
                            <button type="submit" disabled={!trackingNumber.trim() || receivingId !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                                <ArrowDownToLine size={17} /> Receive
                            </button>
                        </form>
                        {receiveError && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{receiveError}</p>}
                        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="font-semibold text-slate-800">Incoming to your office <span className="ml-1 text-sm font-normal text-[#898984]">({incomingDocuments.length})</span></h3>
                            <label className="relative block w-full sm:max-w-xs">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#898984]" />
                                <input value={incomingQuery} onChange={(event) => setIncomingQuery(event.target.value)} placeholder="Search incoming documents" className="w-full rounded-lg border-slate-300 py-2 pl-9 text-sm" />
                            </label>
                        </div>
                        <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                            {visibleIncoming.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[#898984]">{incomingQuery ? 'No incoming documents match your search.' : 'No documents are waiting to be received.'}</p> : visibleIncoming.map((document) => (
                                <div key={document.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-800">{document.title || 'Untitled document'}</p>
                                        <p className="mt-0.5 truncate text-sm text-[#73736e]">{[document.tracking_number, document.from_office && `From ${document.from_office}`].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <button type="button" onClick={() => confirmReceive(document)} disabled={receivingId !== null} className="shrink-0 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50">
                                        {receivingId === document.id ? 'Receiving…' : 'Receive'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </> : <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">Your role or office assignment does not allow receiving documents.</p>}
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
