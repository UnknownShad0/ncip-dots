import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

type DashboardStats = {
    total_documents?: number;
    active_users?: number;
    pending_documents?: number;
    archived_documents?: number;
};

type RecentDocument = {
    id?: string | number;
    title?: string;
    tracking_number?: string;
    status?: string;
    office?: {
        name?: string;
    } | null;
};

const formatNumber = (value?: number | string) => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number.toLocaleString() : '0';
};

const getStatusClasses = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();

    switch (normalized) {
        case 'approved':
        case 'completed':
        case 'done':
            return 'bg-emerald-100 text-emerald-700';
        case 'pending':
            return 'bg-amber-100 text-amber-700';
        case 'rejected':
        case 'cancelled':
            return 'bg-rose-100 text-rose-700';
        case 'archived':
            return 'bg-violet-100 text-violet-700';
        default:
            return 'bg-slate-100 text-slate-700';
    }
};

export default function Dashboard({
    stats = {},
    recentDocuments = [],
}: {
    stats?: DashboardStats;
    recentDocuments?: RecentDocument[];
}) {
    const cards = [
        {
            label: 'Incoming Documents',
            value: formatNumber(stats.total_documents),
            color: 'bg-sky-100 text-sky-700',
        },
        {
            label: 'Pending for Release Documents',
            value: formatNumber(stats.active_users),
            color: 'bg-emerald-100 text-emerald-700',
        },
        {
            label: 'Released Documents (Today)',
            value: formatNumber(stats.pending_documents),
            color: 'bg-amber-100 text-amber-700',
        },
        {
            label: 'Archived',
            value: formatNumber(stats.archived_documents),
            color: 'bg-violet-100 text-violet-700',
        },
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
                        <div
                            key={card.label}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                        >
                            <div
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${card.color}`}
                            >
                                {card.label}
                            </div>

                            <div className="mt-4 text-3xl font-bold text-slate-800">
                                {card.value}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-800">
                            Receive Document
                        </h3>
                        <input type ="text" placeholder="Enter Tracking Number" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-sky-500 focus:ring focus:ring-sky-200 focus:ring-opacity-50" />
                        <button className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus:ring focus:ring-sky-200 focus:ring-opacity-50">
                            Receive
                        </button>
                </div>


                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800">
                            Overdue Documents
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-600">
                                    <th className="px-4 py-3 font-semibold">Title</th>
                                    <th className="px-4 py-3 font-semibold">Tracking No.</th>
                                    <th className="px-4 py-3 font-semibold">Office</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {Array.isArray(recentDocuments) && recentDocuments.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-8 text-center text-slate-500"
                                        >
                                            No recent documents available.
                                        </td>
                                    </tr>
                                ) : (
                                    recentDocuments.map((document, index) => (
                                        <tr
                                            key={document.id ?? `${document.title ?? 'document'}-${index}`}
                                            className="border-b border-slate-200 last:border-b-0"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {document.title || 'Untitled Document'}
                                            </td>

                                            <td className="px-4 py-3 text-slate-600">
                                                {document.tracking_number || 'No tracking number'}
                                            </td>

                                            <td className="px-4 py-3 text-slate-600">
                                                {document.office?.name || 'Unassigned'}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                                                        document.status
                                                    )}`}
                                                >
                                                    {document.status || 'pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-800">
                            Latest Activities
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-slate-200 text-slate-600">
                                    <th className="px-4 py-3 font-semibold">Title</th>
                                    <th className="px-4 py-3 font-semibold">Tracking No.</th>
                                    <th className="px-4 py-3 font-semibold">Office</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {Array.isArray(recentDocuments) && recentDocuments.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={4}
                                            className="px-4 py-8 text-center text-slate-500"
                                        >
                                            No recent documents available.
                                        </td>
                                    </tr>
                                ) : (
                                    recentDocuments.map((document, index) => (
                                        <tr
                                            key={document.id ?? `${document.title ?? 'document'}-${index}`}
                                            className="border-b border-slate-200 last:border-b-0"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {document.title || 'Untitled Document'}
                                            </td>

                                            <td className="px-4 py-3 text-slate-600">
                                                {document.tracking_number || 'No tracking number'}
                                            </td>

                                            <td className="px-4 py-3 text-slate-600">
                                                {document.office?.name || 'Unassigned'}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                                                        document.status
                                                    )}`}
                                                >
                                                    {document.status || 'pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}