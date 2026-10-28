import LibraryLayout from '@/Layouts/LibraryLayout';
import WorkspaceDialog from '@/Components/WorkspaceDialog';
import WorkspaceAlert, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Printer, Search, RefreshCw, Link2, AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';

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
type HrisDirectoryEntry = {
    id: number;
    division_code: string;
    division_name: string;
    hris_office_code?: string | null;
    hris_office_name?: string | null;
    region_code?: string | null;
    directory_status?: string | null;
    is_current?: boolean;
    last_synced_at?: string | null;
    mapped_office_id?: number | null;
    mapped_office_name?: string | null;
    mapped_office_code?: string | null;
    match_method?: string | null;
    mapping_status?: 'auto_confirmed' | 'pending_review' | 'confirmed' | 'rejected' | null;
    review_note?: string | null;
};
type DirectoryCounts = { total: number; current: number; mapped: number; pending: number; unmapped: number };
type OfficeSyncSummary = { id: number; status: string; records_received: number; records_created: number; records_updated: number; error_summary?: string | null; started_at: string; finished_at?: string | null } | null;

type SortKey = 'name' | 'short_name' | 'code' | 'email' | 'location' | 'range_name';

export default function OfficesIndex({
    offices = [],
    ranges = [],
    officeListOptions = [],
    hrisDirectoryEntries = [],
    hrisOfficeSync = null,
    lastSuccessfulHrisOfficeSync = null,
    hrisDirectoryCounts = { total: 0, current: 0, mapped: 0, pending: 0, unmapped: 0 },
    canManageMappings = false,
    flash = {},
}: {
    offices?: OfficeRow[];
    ranges?: RangeOption[];
    officeListOptions?: OfficeListOption[];
    hrisDirectoryEntries?: HrisDirectoryEntry[];
    hrisOfficeSync?: OfficeSyncSummary;
    lastSuccessfulHrisOfficeSync?: { records_received: number; finished_at: string } | null;
    hrisDirectoryCounts?: DirectoryCounts;
    canManageMappings?: boolean;
    flash?: { success?: string; warning?: string };
}) {
    const [processing, setProcessing] = useState(false);
    const [formError, setFormError] = useState('');
    const [editingRow, setEditingRow] = useState<OfficeRow | null>(null);
    const [toast, setToast] = useState<{ title: string; message: string; variant: WorkspaceAlertVariant } | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [activeTab, setActiveTab] = useState<'offices' | 'hris-directory'>('offices');
    const [directorySearch, setDirectorySearch] = useState('');
    const [directoryStatus, setDirectoryStatus] = useState('all');
    const [directoryPage, setDirectoryPage] = useState(1);
    const [directoryParentSort, setDirectoryParentSort] = useState<'asc' | 'desc' | null>(null);
    const [mappingSelections, setMappingSelections] = useState<Record<string, string>>({});
    const [mappingNotes, setMappingNotes] = useState<Record<string, string>>({});
    const [mappingEditCode, setMappingEditCode] = useState<string | null>(null);
    const [mappingBusyCode, setMappingBusyCode] = useState<string | null>(null);
    const [hrisSyncBusy, setHrisSyncBusy] = useState(false);
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

    useEffect(() => {
        if (flash.warning) {
            setToast({ title: 'Action needs attention', message: flash.warning, variant: 'warning' });
        } else if (flash.success) {
            setToast({ title: 'Changes saved', message: flash.success, variant: 'success' });
        }
    }, [flash.success, flash.warning]);

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
        setDirectoryPage(1);
    }, [directorySearch, directoryStatus]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        }
    }, [page, totalPages]);

    const paginatedOffices = sortedOffices.slice((page - 1) * perPage, page * perPage);
    const filteredDirectoryEntries = hrisDirectoryEntries.filter((entry) => {
        const searchText = `${entry.division_code} ${entry.division_name} ${entry.hris_office_code ?? ''} ${entry.hris_office_name ?? ''} ${entry.mapped_office_name ?? ''}`.toLowerCase();
        const matchesSearch = searchText.includes(directorySearch.toLowerCase());
        const status = entry.mapping_status ?? 'unmapped';
        const matchesStatus = directoryStatus === 'all'
            || (directoryStatus === 'current' && entry.is_current)
            || (directoryStatus === 'stale' && !entry.is_current)
            || (directoryStatus === 'mapped' && ['auto_confirmed', 'confirmed'].includes(status))
            || (directoryStatus === 'pending_review' && status === 'pending_review')
            || (directoryStatus === 'unmapped' && status === 'unmapped');
        return matchesSearch && matchesStatus;
    });
    const sortedDirectoryEntries = directoryParentSort
        ? [...filteredDirectoryEntries].sort((left, right) => {
            const parentOrder = (left.hris_office_name ?? '').localeCompare(right.hris_office_name ?? '', undefined, { sensitivity: 'base' });
            const divisionOrder = left.division_name.localeCompare(right.division_name, undefined, { sensitivity: 'base' });
            const comparison = parentOrder || divisionOrder;
            return directoryParentSort === 'asc' ? comparison : -comparison;
        })
        : filteredDirectoryEntries;
    const directoryPageSize = 10;
    const directoryPageCount = Math.max(1, Math.ceil(sortedDirectoryEntries.length / directoryPageSize));
    const visibleDirectoryEntries = sortedDirectoryEntries.slice((directoryPage - 1) * directoryPageSize, directoryPage * directoryPageSize);
    const handleHrisSync = () => {
        if (hrisSyncBusy) return;
        setHrisSyncBusy(true);
        router.post('/offices/hris-directory/sync', {}, { preserveState: true, preserveScroll: true, onFinish: () => setHrisSyncBusy(false) });
    };
    const saveHrisMapping = (entry: HrisDirectoryEntry) => {
        const officeId = mappingSelections[entry.division_code] ?? (entry.mapped_office_id ? String(entry.mapped_office_id) : '');
        if (!officeId || mappingBusyCode) return;
        setMappingBusyCode(entry.division_code);
        router.post(`/offices/hris-directory/${encodeURIComponent(entry.division_code)}/mapping`, {
            office_id: officeId,
            review_note: mappingNotes[entry.division_code] ?? '',
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => setMappingEditCode(null),
            onFinish: () => setMappingBusyCode(null),
        });
    };
    const rangeOptions = editingRow?.range_id != null && !ranges.some((range) => String(range.id) === String(editingRow.range_id))
        ? [...ranges, { id: Number(editingRow.range_id), name: `${editingRow.range_name || 'Current range'} (Inactive)`, is_active: false, source: 'New DB' }]
        : ranges;

    return (
        <LibraryLayout>
            <Head title="Offices" />
            {toast && <WorkspaceAlert {...toast} toast onClose={() => setToast(null)} />}

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
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-foreground">Offices</h2>
                        <p className="mt-1 text-sm text-muted">Manage DOTS offices and the current HRIS office directory.</p>
                    </div>

                    <div className="mb-4 flex gap-5 border-b border-border" role="tablist" aria-label="Office registers">
                        <button type="button" role="tab" aria-selected={activeTab === 'offices'} onClick={() => setActiveTab('offices')} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${activeTab === 'offices' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
                            DOTS Offices <span className="ml-1 font-normal">({offices.length})</span>
                        </button>
                        <button type="button" role="tab" aria-selected={activeTab === 'hris-directory'} onClick={() => setActiveTab('hris-directory')} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${activeTab === 'hris-directory' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'}`}>
                            HRIS Directory <span className="ml-1 font-normal">({hrisDirectoryCounts.total})</span>
                        </button>
                    </div>

                    {activeTab === 'offices' && <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="relative col-span-2 block sm:col-span-1">
                            <span className="sr-only">Search offices</span>
                            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name, code, email, or location"
                                className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                            New Office
                        </button>
                    </div>
                    </>}
                </section>

                {activeTab === 'offices' && <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex items-center justify-between border-b border-border bg-background px-5 py-3 text-sm text-muted">
                        <span>{sortedOffices.length} {sortedOffices.length === 1 ? 'office' : 'offices'}</span>
                    </div>
                    <div className="overflow-x-auto" role="region" aria-label="Offices register" tabIndex={0}>
                    <table className="dots-responsive-table w-full min-w-[900px] text-left text-sm">
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
                                    <td colSpan={6} className="dots-responsive-empty px-4 py-8 text-center text-muted">
                                        No offices found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedOffices.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr key={`${row.id ?? 'row'}-${index}`} className="border-t border-border transition-colors hover:bg-background">
                                            <td data-label="Name" className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                                            {/* <td className="px-4 py-3 text-muted">{row.short_name || '—'}</td> */}
                                            <td data-label="Code" className="px-4 py-3 text-muted">{row.code || '—'}</td>
                                            <td data-label="Email" className="px-4 py-3 text-muted">{row.email || '—'}</td>
                                            <td data-label="Office address" className="px-4 py-3 text-muted">{row.location || '—'}</td>
                                            <td data-label="Range" className="px-4 py-3 text-muted">{row.range_name || '—'}</td>
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
                </section>}

                {activeTab === 'hris-directory' && <>
                    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-border bg-background p-5 lg:flex-row lg:items-center">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><RefreshCw aria-hidden="true" className="h-5 w-5" /></div>
                                <div><h3 className="font-semibold text-foreground">HRIS office directory</h3><p className="text-xs text-muted">Sync refreshes directory entries. DOTS office IDs remain separate.</p></div>
                            </div>
                            <div className="flex flex-1 flex-wrap gap-x-6 gap-y-2 text-xs lg:justify-end">
                                <div><span className="block text-muted">Last successful sync</span><span className="font-medium text-foreground">{lastSuccessfulHrisOfficeSync?.finished_at ? new Date(lastSuccessfulHrisOfficeSync.finished_at).toLocaleString() : 'Not synced yet'}</span></div>
                                <div><span className="block text-muted">Latest status</span><span className={`font-medium ${hrisOfficeSync?.status === 'succeeded' ? 'text-success' : hrisOfficeSync?.status === 'failed' ? 'text-danger' : 'text-muted'}`}>{hrisOfficeSync?.status ? hrisOfficeSync.status.replace('_', ' ') : 'No sync runs'}</span></div>
                            </div>
                            {canManageMappings && <button type="button" onClick={handleHrisSync} disabled={hrisSyncBusy} aria-busy={hrisSyncBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60">
                                {hrisSyncBusy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : <RefreshCw aria-hidden="true" className="h-4 w-4" />}{hrisSyncBusy ? 'Syncing…' : 'Sync from HRIS'}
                            </button>}
                        </div>
                        <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-3">
                            <div className="rounded-lg border border-border p-3"><span className="block text-xs text-muted">Current HRIS divisions</span><strong className="text-lg text-foreground">{hrisDirectoryCounts.current} <span className="text-xs font-normal text-muted">of {hrisDirectoryCounts.total} stored</span></strong></div>
                            <div className="rounded-lg border border-border p-3"><span className="block text-xs text-muted">Confirmed mappings</span><strong className="text-lg text-success">{hrisDirectoryCounts.mapped}</strong></div>
                            <div className="rounded-lg border border-border p-3"><span className="block text-xs text-muted">Needs review or mapping</span><strong className="text-lg text-warning">{hrisDirectoryCounts.pending + hrisDirectoryCounts.unmapped}</strong></div>
                        </div>
                        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                            <label className="relative block flex-1">
                                <span className="sr-only">Search HRIS directory</span>
                                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input value={directorySearch} onChange={(event) => setDirectorySearch(event.target.value)} placeholder="Search division, parent office, or code" className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
                            </label>
                            <select value={directoryStatus} onChange={(event) => setDirectoryStatus(event.target.value)} aria-label="Filter HRIS mapping status" className="h-10 rounded-lg border border-border bg-surface px-3 text-sm">
                                <option value="all">All entries</option><option value="current">Current in HRIS</option><option value="stale">Missing from latest sync</option><option value="mapped">Confirmed</option><option value="pending_review">Pending review</option><option value="unmapped">Unmapped</option>
                            </select>
                            <span className="text-xs text-muted">{sortedDirectoryEntries.length === 0 ? '0 entries' : `Showing ${(directoryPage - 1) * directoryPageSize + 1}–${Math.min(directoryPage * directoryPageSize, sortedDirectoryEntries.length)} of ${sortedDirectoryEntries.length}`}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1050px] text-left text-sm">
                                <thead className="bg-background text-xs uppercase text-muted"><tr>
                                    <th className="px-4 py-3 font-semibold">HRIS division</th><th className="px-4 py-3 font-semibold"><button type="button" aria-label={`Sort by parent HRIS office${directoryParentSort ? ` ${directoryParentSort}` : ''}`} onClick={() => { setDirectoryParentSort((current) => current === 'asc' ? 'desc' : 'asc'); setDirectoryPage(1); }} className="inline-flex items-center gap-1.5 text-left hover:text-foreground">Parent HRIS office{directoryParentSort === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : directoryParentSort === 'desc' ? <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5" />}</button></th><th className="px-4 py-3 font-semibold">Code</th><th className="px-4 py-3 font-semibold">DOTS office</th><th className="px-4 py-3 font-semibold">Mapping status</th>{canManageMappings && <th className="px-4 py-3 font-semibold">Review mapping</th>}
                                </tr></thead>
                                <tbody>
                                    {visibleDirectoryEntries.length === 0 ? <tr><td colSpan={canManageMappings ? 6 : 5} className="px-4 py-10 text-center text-muted">No HRIS directory entries match this filter.</td></tr> : visibleDirectoryEntries.map((entry) => {
                                        const selection = mappingSelections[entry.division_code] ?? (entry.mapped_office_id ? String(entry.mapped_office_id) : '');
                                        const confirmed = entry.mapping_status === 'confirmed' || entry.mapping_status === 'auto_confirmed';
                                        return <tr key={entry.division_code} className="border-t border-border align-top hover:bg-background/70">
                                            <td className="px-4 py-3"><div className="font-medium text-foreground">{entry.division_name}</div><div className="mt-1 text-xs text-muted">{entry.region_code ? `Region ${entry.region_code}` : 'Region not provided'}{!entry.is_current && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px]">Missing from latest sync</span>}</div></td>
                                            <td className="px-4 py-3"><div className="text-foreground">{entry.hris_office_name || '—'}</div><div className="mt-1 font-mono text-xs text-muted">{entry.hris_office_code || '—'}</div></td>
                                            <td className="px-4 py-3 font-mono text-xs text-muted">{entry.division_code}</td>
                                            <td className="px-4 py-3">{entry.mapped_office_name ? <><div className="font-medium text-foreground">{entry.mapped_office_name}</div><div className="mt-1 text-xs text-muted">ID {entry.mapped_office_id}{entry.mapped_office_code ? ` · ${entry.mapped_office_code}` : ''}</div></> : <span className="text-muted">No operational office selected</span>}</td>
                                            <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${confirmed ? 'bg-success-soft text-success' : entry.mapping_status === 'pending_review' ? 'bg-warning-soft text-warning' : entry.mapping_status === 'rejected' ? 'bg-danger-soft text-danger' : 'bg-secondary text-muted'}`}>
                                                {confirmed ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />}
                                                {entry.mapping_status === 'auto_confirmed' ? 'Exact code' : entry.mapping_status === 'confirmed' ? 'Confirmed' : entry.mapping_status === 'pending_review' ? 'Review candidate' : entry.mapping_status === 'rejected' ? 'Rejected' : 'Unmapped'}
                                            </span>{entry.match_method === 'normalized_exact_name' && <div className="mt-1 max-w-36 text-[11px] text-muted">Full-name candidate; review required</div>}</td>
                                            {canManageMappings && <td className="min-w-[230px] px-4 py-3">
                                                <button
                                                    type="button"
                                                    aria-expanded={mappingEditCode === entry.division_code}
                                                    aria-controls={`mapping-editor-${entry.id}`}
                                                    disabled={mappingBusyCode !== null}
                                                    onClick={() => setMappingEditCode((current) => current === entry.division_code ? null : entry.division_code)}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                                                >
                                                    <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                                                    {mappingEditCode === entry.division_code ? 'Close editor' : confirmed ? 'Change mapping' : 'Review mapping'}
                                                </button>
                                                {mappingEditCode === entry.division_code && <div id={`mapping-editor-${entry.id}`} className="mt-2 min-w-[280px] rounded-lg border border-border bg-background p-3">
                                                    <label className="mb-1 block text-xs font-medium text-foreground" htmlFor={`mapping-office-${entry.id}`}>DOTS office</label>
                                                    <select id={`mapping-office-${entry.id}`} aria-label={`Map ${entry.division_name} to DOTS office`} value={selection} onChange={(event) => setMappingSelections((current) => ({ ...current, [entry.division_code]: event.target.value }))} className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs">
                                                        <option value="">Select operational office</option>{offices.map((office) => <option key={String(office.id)} value={office.id}>{office.name}{office.code ? ` (${office.code})` : ''}</option>)}
                                                    </select>
                                                    <label className="mb-1 mt-3 block text-xs font-medium text-foreground" htmlFor={`mapping-note-${entry.id}`}>Review note <span className="font-normal text-muted">(optional)</span></label>
                                                    <input id={`mapping-note-${entry.id}`} value={mappingNotes[entry.division_code] ?? entry.review_note ?? ''} onChange={(event) => setMappingNotes((current) => ({ ...current, [entry.division_code]: event.target.value }))} placeholder="Why this office is the correct match" className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs" />
                                                    <button type="button" disabled={!selection || mappingBusyCode !== null} aria-busy={mappingBusyCode === entry.division_code} onClick={() => saveHrisMapping(entry)} className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">{mappingBusyCode === entry.division_code && <LoaderCircle aria-hidden="true" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />}{mappingBusyCode === entry.division_code ? 'Saving…' : confirmed ? 'Save mapping' : 'Confirm mapping'}</button>
                                                </div>}
                                            </td>}
                                        </tr>;
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {sortedDirectoryEntries.length > directoryPageSize && <div className="flex items-center justify-between border-t border-border px-5 py-3">
                            <span className="text-xs text-muted">Page {directoryPage} of {directoryPageCount}</span>
                            <div className="flex gap-2">
                                <button type="button" disabled={directoryPage <= 1} onClick={() => setDirectoryPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                                <button type="button" disabled={directoryPage >= directoryPageCount} onClick={() => setDirectoryPage((current) => Math.min(directoryPageCount, current + 1))} className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                            </div>
                        </div>}
                        <div className="border-t border-border bg-background px-5 py-3 text-xs text-muted">Directory IDs are not used for user assignments. Confirmed mappings resolve HRIS codes to canonical DOTS office IDs. Rows absent from a successful sync are retained for history and excluded from new account assignments.</div>
                    </section>
                </>}
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
                                                <button key={division.id} type="button" role="option" aria-selected={form.division_code === division.code} onClick={() => { setForm({ ...form, division_code: division.code, name: division.name, short_name: division.short_name, code: division.code, email: division.email }); setEmailError(null); setCodeError(null); setDivisionPickerOpen(false); setDivisionSearch(''); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/5">
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

                            <div className="grid grid-cols-2 gap-2 [&>button]:min-h-11 [&>button]:w-full sm:flex sm:justify-end sm:[&>button]:w-auto">
                                <button
                                    type="button"
                                    disabled={processing}
                                    onClick={() => { if (!processing) closeModal(); }}
                                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    aria-busy={processing}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                                >
                                    {processing && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
                                    {processing ? 'Saving…' : editingRow ? 'Save Changes' : 'Add Office'}
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
