import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

type OfficeRow = {
    id: number | string | null;
    name: string;
    short_name?: string;
    code?: string;
    email?: string;
    location?: string;
    parent_id?: number | null;
    source?: string;
};

type SortKey = 'name' | 'short_name' | 'code' | 'email' | 'location';

export default function OfficesIndex({
    offices = [],
}: {
    offices?: OfficeRow[];
}) {
    const [editingRow, setEditingRow] = useState<OfficeRow | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [form, setForm] = useState({
        name: '',
        short_name: '',
        code: '',
        email: '',
        location: '',
    });

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm({
            name: '',
            short_name: '',
            code: '',
            email: '',
            location: '',
        });
    };

    const openEdit = (row: OfficeRow) => {
        if (row.source === 'Old DB') {
            return;
        }

        setEditingRow(row);
        setForm({
            name: row.name ?? '',
            short_name: row.short_name ?? '',
            code: row.code ?? '',
            email: row.email ?? '',
            location: row.location ?? '',
        });
    };

    const openCreate = () => {
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            name: '',
            short_name: '',
            code: '',
            email: '',
            location: '',
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        router.post('/offices', {
            ...form,
        }, {
            onSuccess: closeModal,
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRow || editingRow.id == null) {
            return;
        }

        router.put(`/offices/${editingRow.id}`, {
            ...form,
        }, {
            onSuccess: closeModal,
        });
    };

    const handlePrint = () => {
        window.print();
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
        }

        setSortKey(key);
        setSortDirection('asc');
    };

    const sortedOffices = useMemo(() => {
        const filtered = offices.filter((row) => {
            const haystack = [
                row.name,
                row.short_name ?? '',
                row.code ?? '',
                row.email ?? '',
                row.location ?? '',
            ]
                .join(' ')
                .toLowerCase();

            return haystack.includes(search.toLowerCase());
        });

        return [...filtered].sort((a, b) => {
            const valueA = String(a[sortKey] ?? '').toLowerCase();
            const valueB = String(b[sortKey] ?? '').toLowerCase();

            if (valueA < valueB) {
                return sortDirection === 'asc' ? -1 : 1;
            }

            if (valueA > valueB) {
                return sortDirection === 'asc' ? 1 : -1;
            }

            return 0;
        });
    }, [offices, search, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedOffices.length / perPage));

    useEffect(() => {
        setPage(1);
    }, [search, perPage]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedOffices = sortedOffices.slice((page - 1) * perPage, page * perPage);

    return (
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-slate-800">Offices</h2>}>
            <Head title="Offices" />

            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-table-only, .print-table-only * { visibility: visible !important; }
                    .print-table-only { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
                    .no-print { display: none !important; }
                    table { width: 100% !important; }
                    th, td { font-size: 11px !important; }
                }
            `}</style>

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm print-table-only">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between no-print">
                    <h3 className="text-lg font-semibold text-slate-800">Office List</h3>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, code, email, or location"
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500"
                        />

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        >
                            New Office
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('name')} className="flex items-center gap-1">
                                        Name {sortKey === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('short_name')} className="flex items-center gap-1">
                                        Short Name {sortKey === 'short_name' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('code')} className="flex items-center gap-1">
                                        Code {sortKey === 'code' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('email')} className="flex items-center gap-1">
                                        Email {sortKey === 'email' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('location')} className="flex items-center gap-1">
                                        Location {sortKey === 'location' ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold no-print">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedOffices.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        No offices found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedOffices.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-slate-200">
                                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.short_name || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.code || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.location || '—'}</td>
                                            <td className="px-4 py-3 no-print">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(row)}
                                                    disabled={isLegacy}
                                                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${isLegacy ? 'cursor-not-allowed bg-slate-300 text-slate-500' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between no-print">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Rows per page:</span>
                        <select
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous
                        </button>

                        <span className="text-sm text-slate-600">
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {(isCreateOpen || editingRow) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {editingRow ? 'Update Office' : 'Add Office'}
                            </h3>

                            <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700">
                                Close
                            </button>
                        </div>

                        <form onSubmit={editingRow ? handleUpdate : handleCreate} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Short Name</label>
                                    <input
                                        value={form.short_name}
                                        onChange={(e) => setForm({ ...form, short_name: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
                                    <input
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
                                <input
                                    value={form.location}
                                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                                >
                                    {editingRow ? 'Save Changes' : 'Add Office'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
