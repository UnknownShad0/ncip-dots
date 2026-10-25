import LibraryLayout from '@/Layouts/LibraryLayout';
import WorkspaceDialog from '@/Components/WorkspaceDialog';
import CrudAlertModal from '@/Components/WorkspaceAlert';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Printer, Search } from 'lucide-react';

type RangeRow = {
    id: number | string | null;
    name: string;
    description: string;
    is_active: number;
    source?: string;
};

type SortKey = 'name' | 'description' | 'is_active';

export default function RangesIndex({
    ranges = [],
}: {
    ranges?: RangeRow[];
}) {
    const [processing, setProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingRow, setEditingRow] = useState<RangeRow | null>(null);
    const [crudAlert, setCrudAlert] = useState<{ title: string; message: string } | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [form, setForm] = useState({
        name: '',
        description: '',
        is_active: true,
    });

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm({
            name: '',
            description: '',
            is_active: true,
        });
    };

    const openEdit = (row: RangeRow) => {
        setFormError('');
        if (row.source === 'Old DB') {
            return;
        }

        setEditingRow(row);
        setForm({
            name: row.name ?? '',
            description: row.description ?? '',
            is_active: Number(row.is_active) === 1,
        });
    };

    const openCreate = () => {
        setFormError('');
        setEditingRow(null);
        setIsCreateOpen(true);
        setForm({
            name: '',
            description: '',
            is_active: true,
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing) return;

        setProcessing(true);
        setFormError('');
        router.post('/ranges', {
            ...form,
            is_active: form.is_active ? 1 : 0,
        }, {
            onError: (errors) => setFormError(Object.values(errors).join(' ')),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Range created', message: 'Range added successfully.' });
            },
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        if (processing) return;

        if (!editingRow || editingRow.id == null) {
            return;
        }

        setProcessing(true);
        setFormError('');
        router.put(`/ranges/${editingRow.id}`, {
            ...form,
            is_active: form.is_active ? 1 : 0,
        }, {
            onError: (errors) => setFormError(Object.values(errors).join(' ')),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                closeModal();
                setCrudAlert({ title: 'Range updated', message: 'Range updated successfully.' });
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

    const sortedRanges = useMemo(() => {
        const filtered = ranges.filter((row) => {
            const haystack = [row.name, row.description ?? '']
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
    }, [ranges, search, sortKey, sortDirection]);

    const totalPages = Math.max(1, Math.ceil(sortedRanges.length / perPage));

    useEffect(() => {
        setPage(1);
    }, [search, perPage]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedRanges = sortedRanges.slice((page - 1) * perPage, page * perPage);

    return (
        <LibraryLayout>
            <Head title="Ranges" />
            {crudAlert && <CrudAlertModal {...crudAlert} onClose={() => setCrudAlert(null)} />}

            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .print-table-only, .print-table-only * { visibility: visible !important; }
                    .print-table-only { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
                    .no-print { display: none !important; }
                    table { width: 100% !important; }
                    th, td { font-size: 14px !important; }
                }
            `}</style>

            <div className="mx-auto flex max-w-[1440px] flex-col gap-5 print-table-only">
                <section className="no-print">
                    <div className="mb-5"><h2 className="text-lg font-semibold text-foreground">Ranges</h2><p className="mt-1 text-sm text-muted">Manage routing regions and their availability.</p></div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="relative col-span-2 block sm:col-span-1">
                        <span className="sr-only">Search ranges</span>
                        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name or description"
                            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                        </label>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border bg-surface px-2 text-xs font-semibold text-foreground transition hover:bg-secondary sm:px-4 sm:text-sm"
                        >
                            <Printer aria-hidden="true" className="h-4 w-4" />
                            Print
                        </button>

                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-2 text-xs font-semibold text-white transition hover:bg-primary-hover sm:px-4 sm:text-sm"
                        >
                            <Plus aria-hidden="true" className="h-4 w-4" />
                            New Range
                        </button>
                    </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex items-center justify-between border-b border-border bg-background px-5 py-3 text-sm text-muted">
                        <span>{sortedRanges.length} {sortedRanges.length === 1 ? 'range' : 'ranges'}</span>
                    </div>
                    <div className="overflow-x-auto" role="region" aria-label="Ranges register" tabIndex={0}>
                    <table className="dots-responsive-table w-full min-w-[680px] text-left text-sm">
                        <thead className="bg-background text-[#555752]">
                            <tr>
                                <th className="px-4 py-3 font-semibold">
                                    <button type="button" onClick={() => handleSort('name')} className="flex items-center gap-1">
                                        Name {sortKey === 'name' ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
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
                            {paginatedRanges.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="dots-responsive-empty px-4 py-8 text-center text-muted">
                                        No ranges found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedRanges.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-border transition-colors hover:bg-background">
                                            <td data-label="Name" className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                                            <td data-label="Description" className="px-4 py-3 text-muted">{row.description || '—'}</td>
                                            <td data-label="Status" className="px-4 py-3">
                                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${Number(row.is_active) === 1 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-slate-100 text-muted ring-1 ring-inset ring-slate-200'}`}>
                                                    {Number(row.is_active) === 1 ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td data-label="Actions" className="px-4 py-3 no-print">
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

            <WorkspaceDialog open={Boolean(isCreateOpen || editingRow)} onClose={() => { if (!processing) closeModal(); }} labelledBy="range-modal-title" width="max-w-xl" busy={processing}>
                {(isCreateOpen || editingRow) && (
                    <div className="p-6">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 id="range-modal-title" className="text-lg font-semibold text-foreground">
                                {editingRow ? 'Update Range' : 'Add Range'}
                            </h3>

                            <button type="button" onClick={() => { if (!processing) closeModal(); }} className="text-sm text-muted hover:text-foreground">
                                Close
                            </button>
                        </div>

                        <form onSubmit={editingRow ? handleUpdate : handleCreate} className="space-y-4">
                            <fieldset disabled={processing} className="min-w-0 space-y-4">
                            {formError && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{formError}</p>}
                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Name</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-lg border border-border px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full rounded-lg border border-border px-3 py-2"
                                    rows={4}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                    className="h-4 w-4 rounded border-border text-primary"
                                />
                                <label htmlFor="is_active" className="text-sm text-foreground">Active</label>
                            </div>

                            <div className="grid grid-cols-2 gap-2 [&>button]:min-h-11 [&>button]:w-full sm:flex sm:justify-end sm:[&>button]:w-auto">
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
                                    {editingRow ? 'Save Changes' : 'Add Range'}
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
