import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/CrudAlertModal';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

type OfficeRow = {
    id: number | string | null;
    name: string;
    short_name?: string;
    code?: string;
    email?: string;
    location?: string;
    parentOfficeId?: number | null;
    parent_name?: string | null;
    division_code?: string | null;
    range_id?: number | null;
    range_name?: string | null;
    range_is_active?: boolean | number | null;
    is_active?: boolean | number;
    source?: string;
};

type DirectoryDivisionOption = { code: string; name: string };
type RangeOption = { value: string; name: string; source: 'SQLite' | 'Legacy'; is_active: boolean };

type SortKey = 'name' | 'short_name' | 'code' | 'email' | 'location';

export default function OfficesIndex({
    offices = [],
    directoryDivisions = [],
    ranges = [],
}: {
    offices?: OfficeRow[];
    directoryDivisions?: DirectoryDivisionOption[];
    ranges?: RangeOption[];
}) {
    const [editingRow, setEditingRow] = useState<OfficeRow | null>(null);
    const [crudAlert, setCrudAlert] = useState<{ title: string; message: string } | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [divisionPickerOpen, setDivisionPickerOpen] = useState(false);
    const [divisionSearch, setDivisionSearch] = useState('');
    const [form, setForm] = useState({
        division_code: '',
        email: '',
        is_active: '1',
        range: '',
    });

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setDivisionPickerOpen(false);
        setDivisionSearch('');
        setForm({
            division_code: '',
            email: '',
            is_active: '1',
            range: '',
        });
    };

    const openEdit = (row: OfficeRow) => {
        if (row.source === 'Old DB') {
            return;
        }

        setEditingRow(row);
        setDivisionPickerOpen(false);
        setDivisionSearch('');
        setForm({
            division_code: row.division_code ?? row.code ?? '',
            email: row.email ?? '',
            is_active: String(Number(row.is_active ?? 1)),
            range: row.range_id != null
                ? `sqlite:${row.range_id}`
                : ranges.find((range) => range.source === 'Legacy' && range.name === row.location)?.value ?? '',
        });
    };

    const openCreate = () => {
        setEditingRow(null);
        setIsCreateOpen(true);
        setDivisionPickerOpen(false);
        setDivisionSearch('');
        setForm({
            division_code: '',
            email: '',
            is_active: '1',
            range: '',
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();

        router.post('/offices', {
            ...form,
            operation: 'create',
        }, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Office created', message: 'Office added successfully.' });
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRow || editingRow.id == null) {
            return;
        }

        router.put(`/offices/${editingRow.id}`, {
            ...form,
            operation: 'update',
        }, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Office updated', message: 'Office updated successfully.' });
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
    const directoryDivisionOptions = editingRow?.code && !directoryDivisions.some((division) => division.code === (editingRow.division_code ?? editingRow.code))
        ? [...directoryDivisions, { code: editingRow.division_code ?? editingRow.code ?? '', name: editingRow.name }]
        : directoryDivisions;
    const selectedDivision = directoryDivisionOptions.find((division) => division.code === form.division_code);
    const filteredDivisionOptions = directoryDivisionOptions.filter((division) => `${division.name} ${division.code}`.toLowerCase().includes(divisionSearch.toLowerCase()));

    return (
        <AuthenticatedLayout header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Library management</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Offices</h1></div>}>
            <Head title="Offices" />
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

            <div className="mx-auto max-w-[1440px] overflow-hidden rounded-2xl border border-[#e2e2df] bg-white shadow-sm print-table-only">
                <div className="flex flex-col gap-4 border-b border-[#e2e2df] bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 no-print">
                    <div><h2 className="text-xl font-semibold tracking-tight text-[#171717]">Office register</h2><p className="mt-1 text-sm text-[#73736e]">Manage offices and their organizational relationships.</p></div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, code, email, or location"
                            className="h-11 rounded-xl border border-[#deded9] bg-[#fafaf8] px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        />

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="h-11 rounded-xl border border-[#deded9] bg-white px-4 text-sm font-semibold text-[#444] transition hover:bg-[#f6f6f3]"
                        >
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                        >
                            New Office
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#f7f8fa] text-[#555752]">
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
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold no-print">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {paginatedOffices.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                        No offices found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedOffices.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]">
                                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.short_name || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.code || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.location || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{Boolean(Number(row.is_active)) ? 'Active' : 'Inactive'}</td>
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
                    <div role="dialog" aria-modal="true" aria-labelledby="office-modal-title" className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 id="office-modal-title" className="text-lg font-semibold text-slate-800">
                                {editingRow ? 'Update Office' : 'Add Office'}
                            </h3>

                            <button type="button" onClick={closeModal} className="text-sm text-slate-500 hover:text-slate-700">
                                Close
                            </button>
                        </div>

                        <form onSubmit={editingRow ? handleUpdate : handleCreate} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="division-search" className="mb-1 block text-sm font-medium text-slate-700">Office</label>
                                    <input id="division-search" value={divisionPickerOpen ? divisionSearch : (selectedDivision?.name ?? '')} onFocus={() => { setDivisionPickerOpen(true); setDivisionSearch(''); }} onChange={(e) => { setDivisionSearch(e.target.value); setDivisionPickerOpen(true); }} placeholder="Search divisions..." autoComplete="off" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                                    {divisionPickerOpen && (
                                        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg" role="listbox" aria-label="Office divisions">
                                            {form.division_code && (
                                                <button type="button" role="option" aria-selected="false" onClick={() => { setForm({ ...form, division_code: '' }); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full border-b border-slate-200 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
                                                    Clear selection
                                                </button>
                                            )}
                                            {filteredDivisionOptions.length ? filteredDivisionOptions.map((division) => (
                                                <button key={division.code} type="button" role="option" aria-selected={form.division_code === division.code} onClick={() => { setForm({ ...form, division_code: division.code }); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">
                                                    {division.name}
                                                </button>
                                            )) : <p className="px-3 py-2 text-sm text-slate-500">No matching divisions.</p>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="range" className="mb-1 block text-sm font-medium text-slate-700">Range</label>
                                    <select id="range" value={form.range} onChange={(e) => setForm({ ...form, range: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="">Select range</option>
                                        {ranges.map((range) => <option key={range.value} value={range.value}>{range.name}{!range.is_active ? ' (Inactive)' : ''}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Office Code</label>
                                    <input value={form.division_code} readOnly aria-readonly="true" required className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-600" />
                                </div>
                                <div>
                                    <label htmlFor="is_active" className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                                    <select id="is_active" value={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                                        <option value="1">Active</option>
                                        <option value="0">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Office Email</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    required
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
