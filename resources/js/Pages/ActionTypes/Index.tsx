import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/CrudAlertModal';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Printer, Search } from 'lucide-react';

type ActionTypeRow = {
    id: number | string | null;
    name: string;
    code?: string;
    description?: string;
    is_active: number;
    source?: string;
};

type SortKey = 'name' | 'code' | 'description' | 'is_active';

export default function ActionTypesIndex({
    actionTypes = [],
}: {
    actionTypes?: ActionTypeRow[];
}) {
    const [editingRow, setEditingRow] = useState<ActionTypeRow | null>(null);
    const [crudAlert, setCrudAlert] = useState<{ title: string; message: string } | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [form, setForm] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
    });

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm({
            name: '',
            code: '',
            description: '',
            is_active: true,
        });
    };

    const openEdit = (row: ActionTypeRow) => {
        if (row.source === 'Old DB') {
            return;
        }

        setEditingRow(row);
        setForm({
            name: row.name ?? '',
            code: row.code ?? '',
            description: row.description ?? '',
            is_active: Number(row.is_active) === 1,
        });
    };

    const openCreate = () => {
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            name: '',
            code: '',
            description: '',
            is_active: true,
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        router.post('/action-types', {
            ...form,
            is_active: form.is_active ? 1 : 0,
        }, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Action type created', message: 'Action type added successfully.' });
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRow || editingRow.id == null) {
            return;
        }

        router.put(`/action-types/${editingRow.id}`, {
            ...form,
            is_active: form.is_active ? 1 : 0,
        }, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Action type updated', message: 'Action type updated successfully.' });
            },
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

    const sortedActionTypes = useMemo(() => {
        const filtered = actionTypes.filter((row) => {
            const haystack = [row.name, row.code ?? '', row.description ?? '']
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
    }, [actionTypes, search, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedActionTypes.length / perPage));

    useEffect(() => {
        setPage(1);
    }, [search, perPage]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedActionTypes = sortedActionTypes.slice((page - 1) * perPage, page * perPage);

    return (
        <AuthenticatedLayout header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Library management</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Action Types</h1></div>}>
            <Head title="Action Types" />
            {crudAlert && <CrudAlertModal {...crudAlert} onClose={() => setCrudAlert(null)} />}

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

            <div className="mx-auto flex max-w-[1440px] flex-col gap-5 print-table-only">
                <section className="rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm sm:p-6 no-print">
                    <div><h2 className="text-xl font-semibold tracking-tight text-[#171717]">Action type register</h2><p className="mt-1 text-sm text-[#73736e]">Manage the actions available during document routing.</p></div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="relative block">
                        <span className="sr-only">Search action types</span>
                        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, code, or description"
                            className="h-11 w-full rounded-xl border border-[#deded9] bg-[#fafaf8] pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />
                        </label>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#deded9] bg-white px-4 text-sm font-semibold text-[#444] transition hover:bg-[#f6f6f3]"
                        >
                            <Printer aria-hidden="true" className="h-4 w-4" />
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            <Plus aria-hidden="true" className="h-4 w-4" />
                            New Action Type
                        </button>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-[#e2e2df] bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#e8e8e4] bg-[#fafaf8] px-5 py-3 text-sm text-slate-600">
                        <span>{sortedActionTypes.length} {sortedActionTypes.length === 1 ? 'action type' : 'action types'}</span>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#f7f8fa] text-[#555752]">
                            <tr>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('name')} className="flex items-center gap-1">
                                        Name {sortKey === 'name' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('code')} className="flex items-center gap-1">
                                        Code {sortKey === 'code' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('description')} className="flex items-center gap-1">
                                        Description {sortKey === 'description' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('is_active')} className="flex items-center gap-1">
                                        Status {sortKey === 'is_active' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold no-print">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedActionTypes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        No action types found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedActionTypes.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]">
                                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.code || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.description || '—'}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${Number(row.is_active) === 1 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'}`}>
                                                    {Number(row.is_active) === 1 ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
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

                <div className="flex flex-col gap-3 border-t border-[#e8e8e4] bg-[#fafaf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Rows per page:</span>
                        <select
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            className="min-w-[4.5rem] rounded-md border border-slate-300 bg-white py-1 pl-2 pr-9 text-sm"
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
                </section>
            </div>

            {(isCreateOpen || editingRow) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div role="dialog" aria-modal="true" aria-labelledby="action-type-modal-title" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 id="action-type-modal-title" className="text-lg font-semibold text-slate-800">
                                {editingRow ? 'Update Action Type' : 'Add Action Type'}
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

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
                                <input
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                    rows={4}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                                />
                                <label htmlFor="is_active" className="text-sm text-slate-700">Active</label>
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
                                    {editingRow ? 'Save Changes' : 'Add Action Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
