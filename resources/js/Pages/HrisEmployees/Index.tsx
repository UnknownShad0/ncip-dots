import LibraryLayout from '@/Layouts/LibraryLayout';
import WorkspaceAlert from '@/Components/WorkspaceAlert';
import WorkspaceBusyOverlay from '@/Components/WorkspaceBusyOverlay';
import { formatPhilippineDateTime } from '@/lib/dateTime';
import { Head, router, usePage } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';

type EmployeeRow = {
    id: number;
    employee_code: string;
    username: string | null;
    email_address: string | null;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    ext_name: string | null;
    division: string | null;
    position: string | null;
    employment_status: string | null;
    last_synced_at: string | null;
};

type Paginator<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
    total: number;
};

type SyncSummary = {
    status: string;
    records_received: number;
    records_created: number;
    records_updated: number;
    error_summary: string | null;
    started_at: string;
    finished_at: string | null;
} | null;

function displayName(employee: EmployeeRow): string {
    return [employee.first_name, employee.middle_name, employee.last_name, employee.ext_name]
        .filter(Boolean)
        .join(' ');
}

export default function HrisEmployeesIndex({
    employees,
    filters,
    latestSync,
    lastSuccessfulSync,
    directoryCount,
}: {
    employees: Paginator<EmployeeRow>;
    filters: { search: string };
    latestSync: SyncSummary;
    lastSuccessfulSync: { records_received: number; finished_at: string | null } | null;
    directoryCount: number;
}) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [syncing, setSyncing] = useState(false);
    const [syncAlert, setSyncAlert] = useState<{ title: string; message: string; variant: 'success' | 'error' } | null>(null);
    const { props } = usePage();
    const flash = (props as any).flash as { success?: string; warning?: string } | undefined;

    const submitSearch = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('hris-employees.index'), { search: search.trim() || undefined }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const changePage = (page: number) => {
        router.get(route('hris-employees.index'), { search: search.trim() || undefined, page }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const syncEmployees = () => {
        setSyncing(true);
        setSyncAlert(null);
        router.post(route('hris-employees.sync'), {}, {
            preserveScroll: true,
            onSuccess: (page) => {
                const message = (page.props as any).flash?.success;
                if (typeof message === 'string') setSyncAlert({ title: 'HRIS sync completed', message, variant: 'success' });
            },
            onError: (errors) => setSyncAlert({ title: 'HRIS sync failed', message: Object.values(errors).join(' ') || 'The employee directory could not be synced. Please try again.', variant: 'error' }),
            onFinish: () => setSyncing(false),
        });
    };

    return (
        <LibraryLayout>
            <Head title="HRIS Employees" />
            <div className="space-y-5">
                <section className="rounded-xl border border-border bg-surface p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-foreground">HRIS Employees</h2>
                            <p className="mt-1 text-sm text-muted">Local employee directory used for account lookup when HRIS is unavailable.</p>
                        </div>
                        <div className="w-full print:hidden lg:w-auto">
                            <button type="button" disabled={syncing} onClick={syncEmployees} className="dots-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto">
                                <RefreshCw size={16} aria-hidden="true" className={syncing ? 'animate-spin' : ''} />
                                {syncing ? 'Syncing...' : 'Sync from HRIS'}
                            </button>
                        </div>
                    </div>

                    {flash?.warning && <p role="alert" className="mt-4 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">{flash.warning}</p>}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg bg-background px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted">Local employees</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">{directoryCount.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg bg-background px-4 py-3">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted">Last successful sync</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{lastSuccessfulSync ? formatPhilippineDateTime(lastSuccessfulSync.finished_at) : 'Not synced yet'}</p>
                            {lastSuccessfulSync && <p className="mt-0.5 text-xs text-muted">{lastSuccessfulSync.records_received.toLocaleString()} employees received</p>}
                        </div>
                    </div>
                    {latestSync?.status === 'failed' && <p className="mt-3 text-sm text-warning">Last sync attempt failed. The previous employee copy is still available.</p>}
                </section>

                <section className="overflow-hidden rounded-xl border border-border bg-surface">
                    <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="font-semibold text-foreground">Employee directory</h3>
                            <p className="mt-1 text-sm text-muted">Search by name, employee code, username, division, or position.</p>
                        </div>
                        <form onSubmit={submitSearch} className="grid grid-cols-1 gap-2 print:hidden sm:flex">
                            <label className="relative min-w-0 flex-1 sm:w-80">
                                <span className="sr-only">Search HRIS employees</span>
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search employees" className="h-11 w-full rounded-lg border-border pl-9 text-sm" />
                            </label>
                            <button type="submit" className="dots-button-secondary w-full sm:w-auto">Search</button>
                        </form>
                    </div>

                    <div className="overflow-x-auto" role="region" aria-label="HRIS employee register" tabIndex={0}>
                        <table className="dots-responsive-table w-full min-w-[900px] text-left text-sm">
                            <thead className="bg-background text-xs uppercase tracking-wide text-muted">
                                <tr>
                                    <th className="px-4 py-3 font-semibold">Employee code</th>
                                    <th className="px-4 py-3 font-semibold">Employee name</th>
                                    <th className="px-4 py-3 font-semibold">Username</th>
                                    <th className="px-4 py-3 font-semibold">Division</th>
                                    <th className="px-4 py-3 font-semibold">Position</th>
                                    <th className="px-4 py-3 font-semibold">Employment status</th>
                                    <th className="px-4 py-3 font-semibold">Last synced</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.data.length === 0 ? (
                                    <tr><td colSpan={7} className="dots-responsive-empty px-4 py-10 text-center text-muted">{directoryCount === 0 ? 'No local employee copy yet. Use Sync from HRIS to import the roster.' : 'No employees match this search.'}</td></tr>
                                ) : employees.data.map((employee) => (
                                    <tr key={employee.employee_code} className="border-t border-border hover:bg-background">
                                        <td data-label="Employee code" className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{employee.employee_code}</td>
                                        <td data-label="Employee name" className="px-4 py-3 text-foreground">{displayName(employee) || '—'}</td>
                                        <td data-label="Username" className="px-4 py-3 text-muted">{employee.username || '—'}</td>
                                        <td data-label="Division" className="px-4 py-3 text-muted">{employee.division || '—'}</td>
                                        <td data-label="Position" className="px-4 py-3 text-muted">{employee.position || '—'}</td>
                                        <td data-label="Employment status" className="px-4 py-3 text-muted">{employee.employment_status || '—'}</td>
                                        <td data-label="Last synced" className="whitespace-nowrap px-4 py-3 text-muted">{formatPhilippineDateTime(employee.last_synced_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                        <span className="text-sm text-muted">{employees.from == null ? '0 employees' : `${employees.from}–${employees.to} of ${employees.total} employees`}</span>
                        <div className="flex items-center gap-2">
                            <button type="button" disabled={employees.current_page <= 1} onClick={() => changePage(employees.current_page - 1)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                            <span className="text-sm text-muted">Page {employees.current_page} of {Math.max(1, employees.last_page)}</span>
                            <button type="button" disabled={employees.current_page >= employees.last_page} onClick={() => changePage(employees.current_page + 1)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                        </div>
                    </div>
                </section>
            </div>
            <WorkspaceBusyOverlay open={syncing} message="Syncing the HRIS employee directory…" />
            {syncAlert && <WorkspaceAlert {...syncAlert} busy={syncing} onClose={() => setSyncAlert(null)} />}
        </LibraryLayout>
    );
}
