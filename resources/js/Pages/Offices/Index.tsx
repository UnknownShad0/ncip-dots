import LibraryLayout from '@/Layouts/LibraryLayout';
import WorkspaceDialog from '@/Components/WorkspaceDialog';
import CrudAlertModal from '@/Components/WorkspaceAlert';
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
    const [processing, setProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingRow, setEditingRow] = useState<OfficeRow | null>(null);
    const [crudAlert, setCrudAlert] = useState<{ title: string; message: string } | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [divisionSearch, setDivisionSearch] = useState('');
    const [divisionPickerOpen, setDivisionPickerOpen] = useState(false);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [shortNameError, setShortNameError] = useState<string | null>(null);
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
        setShortNameError(null);
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
        setFormError('');
        if (row.source === 'Old DB') {
            return;
        }

        setEmailError(null);
        setCodeError(null);
        setShortNameError(null);
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
        setFormError('');
        setEmailError(null);
        setCodeError(null);
        setShortNameError(null);
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
        if (processing) return;
        setEmailError(null);
        setCodeError(null);
        setShortNameError(null);

        setProcessing(true);
        setFormError('');
        router.post('/offices', {
            ...form,
            operation: 'create',
        }, {
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Office created', message: 'Office added successfully.' });
            },
            onError: (errors) => {
                setFormError(Object.values(errors).join(' '));
                setEmailError(errors.email ?? null);
                setShortNameError(errors.short_name ?? null);
                setCodeError(errors.division_code ?? errors.code ?? null);
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing) return;
        setEmailError(null);
        setCodeError(null);
        setShortNameError(null);

        if (!editingRow || editingRow.id == null) {
            return;
        }

        setProcessing(true);
        setFormError('');
        router.put(`/offices/${editingRow.id}`, {
            ...form,
            operation: 'update',
        }, {
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Office updated', message: 'Office updated successfully.' });
            },
            onError: (errors) => {
                setFormError(Object.values(errors).join(' '));
                setEmailError(errors.email ?? null);
                setShortNameError(errors.short_name ?? null);
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
        <LibraryLayout>
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
                <section className="no-print">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-foreground">Offices</h2>
                        <p className="mt-1 text-sm text-muted">Manage offices and their organizational relationships.</p>
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
                                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition hover:bg-secondary"
                        >
                            <Printer aria-hidden="true" className="h-4 w-4" />
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover"
                        >
                            <Plus aria-hidden="true" className="h-4 w-4" />
                            New Office
                        </button>
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex items-center justify-between border-b border-border bg-background px-5 py-3 text-sm text-muted">
                        <span>{sortedOffices.length} {sortedOffices.length === 1 ? 'office' : 'offices'}</span>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-background text-[#555752]">
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
                                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                                        No offices found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedOffices.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-border transition-colors hover:bg-background">
                                            <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                                            {/* <td className="px-4 py-3 text-muted">{row.short_name || '—'}</td> */}
                                            <td className="px-4 py-3 text-muted">{row.code || '—'}</td>
                                            <td className="px-4 py-3 text-muted">{row.email || '—'}</td>
                                            <td className="px-4 py-3 text-muted">{row.location || '—'}</td>
                                            <td className="px-4 py-3 text-muted">{row.range_name || '—'}</td>
                                            <td className="px-4 py-3 no-print">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(row)}
                                                    disabled={isLegacy}
                                                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${isLegacy ? 'cursor-not-allowed bg-slate-300 text-muted' : 'bg-primary text-white hover:bg-primary-hover'}`}
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

                <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between no-print">
                    <div className="flex items-center gap-2 text-sm text-muted">
                        <span>Rows per page:</span>
                        <select
                            aria-label="Rows per page"
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            className="min-w-[4.5rem] rounded-md border border-border bg-surface py-1 pl-2 pr-9 text-sm"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={page === 1}
                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous
                        </button>

                        <span className="text-sm text-muted">
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
                </section>
            </div>

            <WorkspaceDialog open={Boolean(isCreateOpen || editingRow)} onClose={() => { if (!processing) closeModal(); }} labelledBy="office-modal-title" width="max-w-xl" busy={processing}>
                {(isCreateOpen || editingRow) && (
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 id="office-modal-title" className="text-lg font-semibold text-foreground">
                                {editingRow ? 'Update Office' : 'Add Office'}
                            </h3>

                            <button type="button" onClick={() => { if (!processing) closeModal(); }} className="text-sm text-muted hover:text-foreground">
                                Close
                            </button>
                        </div>

                        <form onSubmit={editingRow ? handleUpdate : handleCreate} className="space-y-4">
                            <fieldset disabled={processing} className="min-w-0 space-y-4">
                            {formError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{formError}</p>}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div
                                    onBlur={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget)) {
                                            setDivisionPickerOpen(false);
                                            setDivisionSearch('');
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            e.preventDefault();
        if (processing) return;
                                            setDivisionPickerOpen(false);
                                            setDivisionSearch('');
                                        }
                                    }}
                                >
                                    <label htmlFor="division-search" className="mb-1 block text-sm font-medium text-foreground">Office</label>
                                    <input
                                        id="division-search"
                                        value={divisionPickerOpen ? divisionSearch : (selectedDivision?.name ?? '')}
                                        onFocus={() => { setDivisionPickerOpen(true); setDivisionSearch(''); }}
                                        onClick={() => {
                                            if (!divisionPickerOpen) {
                                                setDivisionSearch('');
                                                setDivisionPickerOpen(true);
                                            }
                                        }}
                                        onChange={(e) => { setDivisionSearch(e.target.value); setDivisionPickerOpen(true); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'ArrowDown') {
                                                e.preventDefault();
        if (processing) return;
                                                setDivisionPickerOpen(true);
                                            }
                                        }}
                                        aria-expanded={divisionPickerOpen}
                                        aria-controls={divisionPickerOpen ? 'office-division-options' : undefined}
                                        aria-haspopup="listbox"
                                        placeholder="Search offices..."
                                        autoComplete="off"
                                        className="w-full rounded-lg border border-border px-3 py-2"
                                    />
                                    {divisionPickerOpen && (
                                        <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg" id="office-division-options" role="listbox" aria-label="Office divisions">
                                            {form.division_code && (
                                                <button type="button" role="option" aria-selected="false" onClick={() => { setForm({ ...form, division_code: '', name: '', short_name: '', code: '', email: '' }); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full border-b border-border px-3 py-2 text-left text-sm text-muted hover:bg-slate-50">
                                                    Clear selection
                                                </button>
                                            )}
                                            {filteredDivisionOptions.length ? filteredDivisionOptions.map((division) => (
                                                <button key={division.id} type="button" role="option" aria-selected={form.division_code === division.code} onClick={() => { setForm({ ...form, division_code: division.code, name: division.name, short_name: division.short_name, code: division.code, email: division.email }); setEmailError(null); setCodeError(null); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50">
                                                    {division.name} <span className="text-muted">({division.code})</span>
                                                </button>
                                            )) : <p className="px-3 py-2 text-sm text-muted">No matching divisions.</p>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">Code</label>
                                    <input
                                        value={form.code}
                                        readOnly
                                        aria-invalid={Boolean(codeError)}
                                        aria-describedby={codeError ? 'office-code-error' : undefined}
                                        className={`w-full rounded-lg border bg-slate-50 px-3 py-2 text-muted ${codeError ? 'border-red-500' : 'border-border'}`}
                                    />
                                    {codeError && <p id="office-code-error" role="alert" className="mt-1 text-sm text-red-600">{codeError}</p>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-foreground">Short Name</label>
                                    <input
                                        value={form.short_name}
                                        onChange={(e) => { setForm({ ...form, short_name: e.target.value }); setShortNameError(null); }}
                                        maxLength={255}
                                        aria-invalid={Boolean(shortNameError)}
                                        aria-describedby={shortNameError ? 'office-short-name-error' : undefined}
                                        className={`w-full rounded-lg border px-3 py-2 ${shortNameError ? 'border-red-500' : 'border-border'}`}
                                    />
                                    {shortNameError && <p id="office-short-name-error" role="alert" className="mt-1 text-sm text-red-600">{shortNameError}</p>}
                                </div>
                                <div>
                                    <label htmlFor="range" className="mb-1 block text-sm font-medium text-foreground">Range</label>
                                    <select id="range" value={form.range_id} onChange={(e) => setForm({ ...form, range_id: e.target.value })} className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-10 text-sm">
                                        <option value="">Select range</option>
                                        {rangeOptions.map((range) => <option key={`${range.source ?? 'range'}-${range.id}`} value={range.id}>{range.name}{!range.is_active ? ' (Inactive)' : ''}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Email</label>
                                    <input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => { setForm({ ...form, email: e.target.value }); setEmailError(null); }}
                                    aria-invalid={Boolean(emailError)}
                                    aria-describedby={emailError ? 'office-email-error' : undefined}
                                    className={`w-full rounded-lg border px-3 py-2 ${emailError ? 'border-red-500' : 'border-border'}`}
                                />
                                {emailError && <p id="office-email-error" className="mt-1 text-sm text-red-600">{emailError}</p>}
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => { if (!processing) closeModal(); }}
                                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
                                >
                                    {editingRow ? 'Save Changes' : 'Add Office'}
                                </button>
                            </div>
                        </fieldset>
                        </form>
                    </div>
                )}
            </WorkspaceDialog>
        </LibraryLayout>
    );
}
