import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import CrudAlertModal from '@/Components/CrudAlertModal';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Printer, Search } from 'lucide-react';

type OfficeRow = {
    id: number | string | null;
    name: string;
    short_name?: string;
    code?: string;
    email?: string;
    location?: string;
    parentOfficeId?: number | null;
    parent_name?: string | null;
    range_id?: number | string | null;
    range_name?: string | null;
    range_is_active?: boolean | number | null;
    source?: string;
};

type RangeOption = { id: number | string; name: string; is_active: boolean | number; source?: 'Old DB' | 'New DB' };
type OfficeListOption = { id: number; code: string; name: string; division_name: string; short_name: string; email: string };

type SortKey = 'name' | 'short_name' | 'code' | 'email' | 'location' | 'range_name';

export default function OfficesIndex({
    offices = [],
    ranges = [],
    officeListOptions = [],
}: {
    offices?: OfficeRow[];
    ranges?: RangeOption[];
    officeListOptions?: OfficeListOption[];
}) {
    const [editingRow, setEditingRow] = useState<OfficeRow | null>(null);
    const [crudAlert, setCrudAlert] = useState<{ title: string; message: string } | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [divisionSearch, setDivisionSearch] = useState('');
    const [divisionPickerOpen, setDivisionPickerOpen] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [codeError, setCodeError] = useState<string | null>(null);
    const [form, setForm] = useState({
        division_code: '',
        name: '',
        short_name: '',
        code: '',
        email: '',
        range_id: '',
    });
    const selectedDivision = officeListOptions.find((office) => office.code === form.division_code);
    const filteredDivisionOptions = officeListOptions.filter((office) =>
        `${office.name} ${office.division_name} ${office.code}`.toLowerCase().includes(divisionSearch.toLowerCase()),
    );

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setDivisionPickerOpen(false);
        setDivisionSearch('');
        setEmailError(null);
        setCodeError(null);
        setForm({
            division_code: '',
            name: '',
            short_name: '',
            code: '',
            email: '',
            range_id: '',
        });
    };

    const openEdit = (row: OfficeRow) => {
        if (row.source === 'Old DB') {
            return;
        }

        setEmailError(null);
        setCodeError(null);
        setEditingRow(row);
        setForm({
            division_code: row.code ?? '',
            name: row.name ?? '',
            short_name: row.short_name ?? '',
            code: row.code ?? '',
            email: row.email ?? '',
            range_id: row.range_id == null ? '' : String(row.range_id),
        });
    };

    const openCreate = () => {
        setEmailError(null);
        setCodeError(null);
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            division_code: '',
            name: '',
            short_name: '',
            code: '',
            email: '',
            range_id: '',
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError(null);
        setCodeError(null);

        router.post('/offices', {
            ...form,
            operation: 'create',
        }, {
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Office created', message: 'Office added successfully.' });
            },
            onError: (errors) => {
                setEmailError(errors.email ?? null);
                setCodeError(errors.division_code ?? errors.code ?? null);
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError(null);
        setCodeError(null);

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
            onError: (errors) => {
                setEmailError(errors.email ?? null);
                setCodeError(errors.division_code ?? errors.code ?? null);
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
                row.range_name ?? '',
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
    const rangeOptions = editingRow?.range_id != null && !ranges.some((range) => String(range.id) === String(editingRow.range_id))
        ? [...ranges, { id: Number(editingRow.range_id), name: `${editingRow.range_name || 'Current range'} (Inactive)`, is_active: false, source: 'New DB' }]
        : ranges;

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

            <div className="mx-auto flex max-w-[1440px] flex-col gap-5 print-table-only">
                <section className="rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm sm:p-6 no-print">
                    <div className="mb-5">
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#171717]">Office register</h2>
                        <p className="mt-1 text-sm text-[#73736e]">Manage offices and their organizational relationships.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="relative block">
                            <span className="sr-only">Search offices</span>
                            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, code, email, or location"
                                className="h-11 w-full rounded-xl border border-[#deded9] bg-[#fafaf8] pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
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
                            New Office
                        </button>
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border border-[#e2e2df] bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#e8e8e4] bg-[#fafaf8] px-5 py-3 text-sm text-slate-600">
                        <span>{sortedOffices.length} {sortedOffices.length === 1 ? 'office' : 'offices'}</span>
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
                                {/* <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('short_name')} className="flex items-center gap-1">
                                        Short Name {sortKey === 'short_name' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th> */}
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('code')} className="flex items-center gap-1">
                                        Code {sortKey === 'code' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('email')} className="flex items-center gap-1">
                                        Email {sortKey === 'email' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('location')} className="flex items-center gap-1">
                                        Office Address {sortKey === 'location' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
                                    </button>
                                </th>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('range_name')} className="flex items-center gap-1">
                                        Range {sortKey === 'range_name' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
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
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]">
                                            <td className="px-4 py-3 font-medium text-slate-800">{row.name}</td>
                                            {/* <td className="px-4 py-3 text-slate-600">{row.short_name || '—'}</td> */}
                                            <td className="px-4 py-3 text-slate-600">{row.code || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.email || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.location || '—'}</td>
                                            <td className="px-4 py-3 text-slate-600">{row.range_name || '—'}</td>
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
                                    <input id="division-search" value={divisionPickerOpen ? divisionSearch : (selectedDivision?.name ?? '')} onFocus={() => { setDivisionPickerOpen(true); setDivisionSearch(''); }} onChange={(e) => { setDivisionSearch(e.target.value); setDivisionPickerOpen(true); }} placeholder="Search offices..." autoComplete="off" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
                                    {divisionPickerOpen && (
                                        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg" role="listbox" aria-label="Office divisions">
                                            {form.division_code && (
                                                <button type="button" role="option" aria-selected="false" onClick={() => { setForm({ ...form, division_code: '', name: '', short_name: '', code: '', email: '' }); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full border-b border-slate-200 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
                                                    Clear selection
                                                </button>
                                            )}
                                            {filteredDivisionOptions.length ? filteredDivisionOptions.map((division) => (
                                                <button key={division.id} type="button" role="option" aria-selected={form.division_code === division.code} onClick={() => { setForm({ ...form, division_code: division.code, name: division.name, short_name: division.short_name, code: division.code, email: division.email }); setEmailError(null); setCodeError(null); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">
                                                    {division.name} <span className="text-slate-500">({division.code})</span>
                                                </button>
                                            )) : <p className="px-3 py-2 text-sm text-slate-500">No matching divisions.</p>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-slate-700">Code</label>
                                    <input
                                        value={form.code}
                                        readOnly
                                        aria-invalid={Boolean(codeError)}
                                        aria-describedby={codeError ? 'office-code-error' : undefined}
                                        className={`w-full rounded-lg border bg-slate-50 px-3 py-2 text-slate-600 ${codeError ? 'border-red-500' : 'border-slate-300'}`}
                                    />
                                    {codeError && <p id="office-code-error" role="alert" className="mt-1 text-sm text-red-600">{codeError}</p>}
                                </div>
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
                                    <label htmlFor="range" className="mb-1 block text-sm font-medium text-slate-700">Range</label>
                                    <select id="range" value={form.range_id} onChange={(e) => setForm({ ...form, range_id: e.target.value })} className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm">
                                        <option value="">Select range</option>
                                        {rangeOptions.map((range) => <option key={`${range.source ?? 'range'}-${range.id}`} value={range.id}>{range.name}{!range.is_active ? ' (Inactive)' : ''}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                                    <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailError(null); }}
                                    aria-invalid={Boolean(emailError)}
                                    aria-describedby={emailError ? 'office-email-error' : undefined}
                                    className={`w-full rounded-lg border px-3 py-2 ${emailError ? 'border-red-500' : 'border-slate-300'}`}
                                />
                                {emailError && <p id="office-email-error" className="mt-1 text-sm text-red-600">{emailError}</p>}
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
