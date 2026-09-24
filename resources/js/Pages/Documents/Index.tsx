import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';

type DocumentItem = {
    id?: number | string;
    tracking_number?: string;
    title?: string;
    status?: string;
    office?: {
        name?: string;
    } | null;
};

const getStatusClasses = (status?: string) => {
    const normalized = (status ?? 'pending').toLowerCase();

    switch (normalized) {
        case 'approved':
        case 'completed':
        case 'released':
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

export default function DocumentsIndex({
    documents = [],
}: {
    documents?: DocumentItem[];
}) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredDocuments = useMemo(() => {
        return documents.filter((doc) => {
            const matchesSearch =
                !search ||
                (doc.title ?? '').toLowerCase().includes(search.toLowerCase()) ||
                (doc.tracking_number ?? '').toLowerCase().includes(search.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ||
                (doc.status ?? '').toLowerCase() === statusFilter.toLowerCase();

            return matchesSearch && matchesStatus;
        });
    }, [documents, search, statusFilter]);

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">Documents</h2>}
        >
            <Head title="Documents" />

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <h3 className="text-lg font-semibold text-slate-800">Document Register</h3>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                        />

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="released">Released</option>
                            <option value="archived">Archived</option>
                            <option value="rejected">Rejected</option>
                        </select>

                        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                            New Document
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Tracking No.</th>
                                <th className="px-4 py-3 font-semibold">Title</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Office</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                        No documents found.
                                    </td>
                                </tr>
                            ) : (
                                filteredDocuments.map((document, index) => (
                                    <tr
                                        key={document.id ?? `${document.tracking_number ?? 'doc'}-${index}`}
                                        className="border-t border-slate-200"
                                    >
                                        <td className="px-4 py-3 text-slate-700">
                                            {document.tracking_number || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800">
                                            {document.title || 'Untitled'}
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
                                        <td className="px-4 py-3 text-slate-600">
                                            {document.office?.name || '—'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
