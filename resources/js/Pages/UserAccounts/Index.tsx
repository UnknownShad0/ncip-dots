import axios from 'axios';
import WorkspaceAlert, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, Search } from 'lucide-react';

type UserRow = {
    id: string;
    name: string;
    email: string;
    username: string;
    firstname: string;
    lastname: string;
    employee_code?: string;
    role_id: string;
    role: string;
    office_id: number | null;
    office_name: string;
    is_active: boolean;
    account_status: 'Active' | 'Inactive' | 'Locked';
    password_setup_pending: boolean;
    is_locked: boolean;
    logged_in_status: string;
    last_login_at: string | null;
    source: string;
};
type OfficeOption = { id: number; name: string; email?: string };
type HrisOfficeOption = { division_code: string; division_name: string; parent_office_code?: string | null; parent_office_name?: string | null; region_code?: string | null; office_id: number; office_name: string; office_code?: string | null; range_name?: string | null };
type RoleOption = { id: number; name: string };
type FormState = {
    employee_role: string;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
    role_id: string;
    officeId: string;
    account_status: 'Active' | 'Inactive' | 'Locked';
    password: string;
    password_confirmation: string;
};
type EmployeeLookup = {
    employee: { employee_code: string; first_name: string; middle_name?: string; last_name: string; ext_name?: string; username: string; email_address?: string; division_code?: string; division?: string };
    offices: { office_code: string; office_name: string; region_code: string; region_name: string }[];
};
type EmployeeMatch = {
    employee_code: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    ext_name?: string;
    username?: string;
    division?: string;
    division_code?: string;
    position?: string;
    employment_status?: string;
};
type SortKey = 'name' | 'username' | 'email' | 'role' | 'office_name' | 'account_status';

const emptyForm: FormState = {
    employee_role: '', firstname: '', lastname: '', username: '', email: '', role_id: '', officeId: '',
    account_status: 'Active', password: '', password_confirmation: '',
};

export default function UserAccountsIndex({
    users = [], offices = [], hrisOfficeOptions = [], roles = [], usesRelaxedPasswordValidation = false, flash = {},
}: { users?: UserRow[]; offices?: OfficeOption[]; hrisOfficeOptions?: HrisOfficeOption[]; roles?: RoleOption[]; usesRelaxedPasswordValidation?: boolean; flash?: { success?: string; warning?: string } }) {
    const [search, setSearch] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [editingRow, setEditingRow] = useState<UserRow | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const [accountType, setAccountType] = useState<'dots' | 'employee' | null>(null);
    const [employeeCode, setEmployeeCode] = useState('');
    const [employeeMatches, setEmployeeMatches] = useState<EmployeeMatch[]>([]);
    const [lookup, setLookup] = useState<EmployeeLookup | null>(null);
    const [lookupOpen, setLookupOpen] = useState(false);
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupLoadingKind, setLookupLoadingKind] = useState<'search' | 'employee' | null>(null);
    const [lookupError, setLookupError] = useState('');
    const [officeDirectoryCode, setOfficeDirectoryCode] = useState('');
    const [toast, setToast] = useState<{ title: string; message: string; variant: WorkspaceAlertVariant } | null>(null);
    const lookupVersion = useRef(0);

    useEffect(() => {
        if (flash.warning) {
            setToast({ title: 'Account saved with a notice', message: flash.warning, variant: 'warning' });
        } else if (flash.success) {
            setToast({ title: 'Account saved', message: flash.success, variant: 'success' });
        }
    }, [flash.success, flash.warning]);

    const resetLookup = () => {
        lookupVersion.current++;
        setLookup(null); setLookupOpen(false); setLookupBusy(false);
        setLookupLoadingKind(null);
        setLookupError(''); setEmployeeCode(''); setEmployeeMatches([]); setOfficeDirectoryCode('');
    };
    const selectType = (type: 'dots' | 'employee') => {
        resetLookup(); setAccountType(type); setForm(emptyForm); setErrors({});
    };
    const searchEmployee = async () => {
        const version = ++lookupVersion.current;
        setLookupBusy(true); setLookupLoadingKind('search'); setLookupError(''); setLookup(null); setEmployeeMatches([]); setForm(emptyForm); setOfficeDirectoryCode('');
        try {
            const response = await axios.post<{ matches: EmployeeMatch[] }>('/user-accounts/search-employees', { query: employeeCode.trim() });
            if (version !== lookupVersion.current) return;
            setEmployeeMatches(response.data.matches);
            if (response.data.matches.length === 0) setLookupError('No matching employee found. Sync the HRIS directory or check the search text.');
        } catch (error) {
            if (version !== lookupVersion.current) return;
            setLookupError(axios.isAxiosError(error) ? error.response?.data?.errors?.query?.[0] || error.response?.data?.message || 'Employee lookup failed. Please try again.' : 'Employee lookup failed. Please try again.');
        } finally {
            if (version === lookupVersion.current) { setLookupBusy(false); setLookupLoadingKind(null); }
        }
    };

    const selectEmployee = async (employee: EmployeeMatch) => {
        const version = ++lookupVersion.current;
        setEmployeeCode(employee.employee_code);
        setEmployeeMatches([]);
        setLookupBusy(true);
        setLookupLoadingKind('employee');
        setLookupError('');
        try {
            const response = await axios.post<EmployeeLookup>('/user-accounts/lookup-employee', { employee_code: employee.employee_code });
            if (version !== lookupVersion.current) return;
            const result = response.data;
            setLookup(result); setLookupOpen(false);
            setOfficeDirectoryCode(hrisOfficeOptions.some((office) => office.division_code === result.employee.division_code)
                ? result.employee.division_code ?? ''
                : '');
            setForm({ ...emptyForm, firstname: result.employee.first_name, lastname: result.employee.last_name,
                username: result.employee.username, email: '' });
        } catch (error) {
            if (version !== lookupVersion.current) return;
            setLookupError(axios.isAxiosError(error) ? error.response?.data?.message || 'Employee lookup failed. Please try again.' : 'Employee lookup failed. Please try again.');
        } finally {
            if (version === lookupVersion.current) { setLookupBusy(false); setLookupLoadingKind(null); }
        }
    };

    const visibleUsers = useMemo(() => {
        const term = search.toLowerCase();
        const filtered = users.filter((user) => [user.name, user.email, user.username, user.role, user.office_name]
            .join(' ').toLowerCase().includes(term));
        return [...filtered].sort((a, b) => {
            const left = String(a[sortKey] ?? '').toLowerCase();
            const right = String(b[sortKey] ?? '').toLowerCase();
            return left.localeCompare(right) * (sortDirection === 'asc' ? 1 : -1);
        });
    }, [users, search, sortKey, sortDirection]);

    const pageCount = Math.max(1, Math.ceil(visibleUsers.length / perPage));
    const pageUsers = visibleUsers.slice((page - 1) * perPage, page * perPage);
    const officeOptions = editingRow?.office_id && !offices.some((office) => office.id === editingRow.office_id)
        ? [...offices, { id: editingRow.office_id, name: `${editingRow.office_name} (Inactive)` }]
        : offices;
    const selectedOffice = hrisOfficeOptions.find((office) => office.division_code === officeDirectoryCode);

    const closeModal = () => {
        resetLookup();
        setAccountType(null);
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm(emptyForm);
        setErrors({});
    };

    const openEdit = (user: UserRow) => {
        setEditingRow(user);
        setForm({
            employee_role: ['Super Admin', 'Executive', 'Admin Staff'].includes(user.role) ? user.role : '',
            firstname: user.firstname ?? '', lastname: user.lastname ?? '',
            username: user.username ?? '', email: user.email ?? '', role_id: user.role_id ?? '',
            officeId: user.office_id == null ? '' : String(user.office_id),
            account_status: user.account_status,
            password: '', password_confirmation: '',
        });
        setIsCreateOpen(false);
        setErrors({});
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        const payload = {
            ...form,
            account_type: accountType,
            employee_code: lookup?.employee.employee_code,
            office_directory_code: officeDirectoryCode,
            operation: editingRow ? 'update' : 'create',
        };
        const options = {
            onSuccess: () => closeModal(),
            onError: (validationErrors: Record<string, string>) => setErrors(validationErrors),
            onFinish: () => setProcessing(false),
        };
        if (editingRow) router.put(`/user-accounts/${editingRow.id}`, payload, options);
        else router.post('/user-accounts', payload, options);
    };

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDirection('asc'); }
    };

    const sortButton = (label: string, key: SortKey) => (
        <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 font-semibold text-muted hover:text-primary">
            {label}{sortKey === key ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-muted" />}
        </button>
    );

    return (
        <AuthenticatedLayout header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">User Accounts</h1>}>
            <Head title="User Accounts" />
            <div className="mx-auto max-w-[1440px] space-y-5 print:border-0 print:shadow-none">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm text-muted">Manage access, office assignments, and account status.</p>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 print:hidden sm:w-auto">
                        <button type="button" onClick={() => window.print()} className="dots-button-secondary w-full">Print</button>
                        <button type="button" onClick={() => { closeModal(); setAccountType('employee'); setLookupOpen(true); setIsCreateOpen(true); }} className="dots-button-primary w-full">New user</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search users..." aria-label="Search users" className="h-11 w-full rounded-lg border-border bg-surface text-sm sm:max-w-sm" />
                    <label className="flex w-full items-center justify-between text-sm text-muted sm:w-auto sm:justify-start">Rows per page{' '}
                        <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }} className="ml-2 h-11 rounded-lg border-border bg-surface text-sm">
                            {[10, 25, 50].map((count) => <option key={count} value={count}>{count}</option>)}
                        </select>
                    </label>
                </div>

                <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex items-center justify-between border-b border-border bg-background px-5 py-3 text-sm text-muted">
                        <span>{visibleUsers.length} {visibleUsers.length === 1 ? 'user' : 'users'}</span>
                    </div>
                    <div className="overflow-x-auto" role="region" aria-label="User accounts register" tabIndex={0}>
                    <table className="dots-responsive-table w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-background text-muted"><tr>
                            <th className="px-4 py-3 font-semibold">{sortButton('Name', 'name')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Username', 'username')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Email', 'email')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Role', 'role')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Office', 'office_name')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Status', 'account_status')}</th>
                            <th className="px-4 py-3 font-semibold print:hidden">Actions</th>
                        </tr></thead>
                        <tbody>
                            {pageUsers.length === 0 ? <tr><td colSpan={7} className="dots-responsive-empty px-4 py-8 text-center text-muted">No users found.</td></tr> : pageUsers.map((user) => (
                                <tr key={`${user.source}:${user.id}`} className="border-t border-border transition-colors hover:bg-background">
                                    <td data-label="Name" className="px-4 py-3 font-medium text-foreground">{user.name}</td>
                                    <td data-label="Username" className="px-4 py-3 text-muted">{user.username || '—'}</td>
                                    <td data-label="Email" className="px-4 py-3 text-muted">{user.email}</td>
                                    <td data-label="Role" className="px-4 py-3 text-muted">{user.role || '—'}</td>
                                    <td data-label="Office" className="px-4 py-3 text-muted">{user.office_name || 'No office'}</td>
                                    <td data-label="Status" className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${user.password_setup_pending && user.account_status === 'Active' ? 'bg-warning-soft text-warning' : user.account_status === 'Active' ? 'bg-success-soft text-success' : user.account_status === 'Locked' ? 'bg-danger-soft text-danger' : 'bg-secondary text-muted'}`}>
                                            {user.password_setup_pending && user.account_status === 'Active' ? 'Pending' : user.account_status}
                                        </span>
                                    </td>
                                    <td data-label="Actions" className="px-4 py-3 print:hidden">
                                        <button type="button" onClick={() => openEdit(user)} disabled={user.source === 'Legacy DB'} title={user.source === 'Legacy DB' ? 'Legacy accounts are read-only' : undefined} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${user.source === 'Legacy DB' ? 'cursor-not-allowed bg-secondary text-muted' : 'bg-primary text-primary-foreground hover:bg-primary-hover'}`}>Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                        <span className="text-sm text-muted">{visibleUsers.length === 0 ? '0 users' : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, visibleUsers.length)} of ${visibleUsers.length} users`}</span>
                        <div className="flex items-center gap-2">
                            <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                            <span className="text-sm text-muted">Page {page} of {pageCount}</span>
                            <button type="button" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                        </div>
                    </div>
                </section>
            </div>

            {(isCreateOpen || editingRow) && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="user-account-modal-title">
                <form onSubmit={submit} className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-2xl sm:p-6">
                    <div className="flex items-center justify-between border-b border-border pb-3"><h3 id="user-account-modal-title" className="text-lg font-semibold text-foreground">{editingRow ? 'Edit User Account' : 'New User Account'}</h3><button type="button" disabled={processing} onClick={closeModal} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-secondary hover:text-foreground disabled:opacity-50">Close</button></div>
                    {!editingRow && accountType === 'employee' && <div className="space-y-4">
                        {(!lookup || lookupOpen) && <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><div className="min-w-0"><Field label="Search employee by code or name"><input value={employeeCode} onChange={(e) => { lookupVersion.current++; setLookupBusy(false); setLookupLoadingKind(null); setEmployeeCode(e.target.value); setEmployeeMatches([]); setLookupError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (employeeCode.trim() && !lookupBusy) void searchEmployee(); } }} placeholder="Enter employee code or name" className="w-full rounded-lg border-border bg-surface" /></Field></div>
                                <button type="button" disabled={lookupBusy || !employeeCode.trim()} aria-busy={lookupBusy} onClick={() => void searchEmployee()} className="dots-button-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-50 sm:w-auto">{lookupBusy ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{lookupBusy ? 'Searching…' : 'Search'}</button>
                            </div>
                            {lookupError && <p role="alert" className="text-sm text-danger">{lookupError}</p>}
                            {employeeMatches.length > 0 && <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface" role="listbox" aria-label="Matching HRIS employees">
                                {employeeMatches.map((employee) => <button key={employee.employee_code} type="button" role="option" aria-selected="false" onClick={() => void selectEmployee(employee)} className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-background">
                                    <span className="block font-medium text-foreground">{[employee.first_name, employee.middle_name, employee.last_name, employee.ext_name].filter(Boolean).join(' ') || 'Unnamed employee'}</span>
                                    <span className="mt-0.5 block text-xs text-muted">{employee.employee_code}{employee.username ? ` · ${employee.username}` : ''}{employee.division ? ` · ${employee.division}` : employee.division_code ? ` · ${employee.division_code}` : ''}{employee.position ? ` · ${employee.position}` : ''}{employee.employment_status ? ` · ${employee.employment_status}` : ''}</span>
                                </button>)}
                            </div>}
                        </div>}
                        {lookupLoadingKind === 'employee' && <p role="status" className="inline-flex items-center gap-2 text-sm text-muted"><LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading employee details…</p>}
                        {lookup && !lookupOpen && <>
                            <button type="button" disabled={processing || lookupBusy} onClick={() => { setLookupOpen(true); setLookupError(''); }} className="self-start rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50">Search another employee</button>
                            <dl className="grid gap-3 rounded-xl bg-secondary p-4 text-sm sm:grid-cols-2">
                                {[
                                    ['Employee Code', lookup.employee.employee_code],
                                    ['First Name', lookup.employee.first_name], ['Middle Name', lookup.employee.middle_name],
                                    ['Last Name', lookup.employee.last_name], ['Extension Name', lookup.employee.ext_name],
                                    ['Username', lookup.employee.username],
                                ].map(([label, value]) => <div key={label}><dt className="text-muted">{label}</dt><dd className="mt-1 font-medium text-foreground">{value || '—'}</dd></div>)}
                            </dl>
                            <p className="text-sm text-muted">HRIS division: {lookup.employee.division || lookup.employee.division_code || 'Not provided'}. Select the current HRIS directory entry below; the saved assignment will use its mapped DOTS office ID.</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="HRIS directory entry" error={errors.office_directory_code}><select required aria-label="HRIS directory entry" value={officeDirectoryCode} onChange={(event) => setOfficeDirectoryCode(event.target.value)} className="w-full rounded-lg border-border bg-surface">
                                    <option value="">Select mapped HRIS division</option>
                                    {hrisOfficeOptions.length === 0 && <option value="" disabled>No current divisions with confirmed mappings and active ranges</option>}
                                    {hrisOfficeOptions.map((office) => <option key={office.division_code} value={office.division_code}>{office.division_name} ({office.division_code}) — {office.office_name}</option>)}
                                </select></Field>
                                <Field label="Range"><input aria-label="Range" readOnly value={selectedOffice ? selectedOffice.range_name || 'No range assigned' : ''} className="w-full rounded-lg border-border bg-background text-muted" /></Field>
                            </div>
                            {selectedOffice && <p className="text-xs text-muted">Assigned to DOTS office {selectedOffice.office_code ? `${selectedOffice.office_code} · ` : ''}{selectedOffice.office_name} (ID {selectedOffice.office_id}).</p>}
                            {!selectedOffice && lookup.employee.division_code && <p role="status" className="text-sm text-warning">The employee’s HRIS division has no confirmed office mapping. Select another mapped entry or ask an administrator to review it in Offices.</p>}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Email" error={errors.email}><input required type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border-border bg-surface" /></Field>
                                <Field label="Role" error={errors.employee_role}><select required value={form.employee_role} onChange={(e) => setForm({ ...form, employee_role: e.target.value })} className="w-full rounded-lg border-border bg-surface"><option value="">Select role</option><option value="Super Admin">Super Admin</option><option value="Executive">Executive</option><option value="Admin Staff">Admin Staff</option></select></Field>
                            </div>
                            {/* <p className="text-xs text-slate-500">Login details will be sent to this email.</p> */}
                        </>}
                    </div>}
                    {(editingRow || accountType === 'dots') && <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="First Name" error={errors.firstname}><input required value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} className="w-full rounded-lg border-border bg-surface" /></Field>
                        <Field label="Last Name" error={errors.lastname}><input required value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} className="w-full rounded-lg border-border bg-surface" /></Field>
                        <Field label="Username" error={errors.username}><input required maxLength={50} disabled={!!editingRow?.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-lg border-border bg-surface disabled:bg-background" /></Field>
                        {editingRow && <Field label="Email" error={errors.email}><input required={!editingRow} type="email" maxLength={255} disabled={!!editingRow} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border-border bg-surface disabled:bg-background" /></Field>}
                        {editingRow?.employee_code ? <Field label="Role" error={errors.employee_role}><select required value={form.employee_role} onChange={(e) => setForm({ ...form, employee_role: e.target.value })} className="w-full rounded-lg border-border bg-surface"><option value="">Select role</option><option value="Super Admin">Super Admin</option><option value="Executive">Executive</option><option value="Admin Staff">Admin Staff</option></select></Field> : <Field label="Role" error={errors.role_id}><select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="w-full rounded-lg border-border bg-surface"><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>}
                        <Field label="Office" error={errors.officeId}>{editingRow?.employee_code && !editingRow.office_id ? <p className="rounded-lg border border-border bg-background p-2">{editingRow.office_name}</p> : <select required value={form.officeId} onChange={(e) => { setErrors({}); setForm({ ...form, officeId: e.target.value, email: accountType === 'dots' ? offices.find((office) => String(office.id) === e.target.value)?.email ?? '' : form.email }); }} className="w-full rounded-lg border-border bg-surface"><option value="">Select office</option>{officeOptions.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}</select>}</Field>
                        {!editingRow && accountType === 'dots' && form.officeId && <p className="text-sm text-muted sm:col-span-2">{form.email ? <>Login details will be sent to <span className="font-medium text-foreground">{form.email}</span>.</> : <span className="text-danger">The selected office has no email address. Update the office email before creating an account.</span>}</p>}
                        {editingRow && <Field label="Account Status" error={errors.account_status}><select value={form.account_status} onChange={(e) => setForm({ ...form, account_status: e.target.value as FormState['account_status'] })} className="w-full rounded-lg border-border bg-surface"><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Locked">Locked</option></select></Field>}
                        {editingRow && <><Field label="New password (optional)" error={errors.password}><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border-border bg-surface" /></Field>
                        <Field label="Confirm password" error={errors.password_confirmation}><input type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} className="w-full rounded-lg border-border bg-surface" /></Field>
                        <p className="text-xs text-muted sm:col-span-2">{usesRelaxedPasswordValidation ? 'Use at least 8 characters.' : 'Use at least 8 characters, including uppercase and lowercase letters, a number, and a symbol.'}</p></>}
                    </div>}
                    {Object.entries(errors).filter(([key]) => !['firstname', 'lastname', 'role_id', 'officeId', 'office_directory_code', 'password', 'password_confirmation', 'account_status', 'user'].includes(key)).map(([key, message]) => <p key={key} className="text-sm text-danger">{message}</p>)}
                    {errors.user && <p className="text-sm text-danger">{errors.user}</p>}
                    <div className="grid grid-cols-2 gap-2 border-t border-border pt-4"><button type="button" disabled={processing} onClick={closeModal} className="dots-button-secondary w-full disabled:opacity-50">Cancel</button><button disabled={processing || (!editingRow && (!accountType || (accountType === 'dots' && !form.email) || (accountType === 'employee' && (!lookup || lookupOpen || lookupBusy || !selectedOffice?.range_name || !officeDirectoryCode || !form.employee_role || !form.email))))} aria-busy={processing} className="dots-button-primary inline-flex w-full items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50">{processing && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{processing ? 'Saving…' : 'Save account'}</button></div>
                </form>
            </div>}
            {toast && <WorkspaceAlert {...toast} toast onClose={() => setToast(null)} />}
        </AuthenticatedLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <label className="space-y-1.5 text-sm font-medium text-foreground"><span className="block">{label}</span>{children}{error && <span className="block text-xs font-normal text-danger">{error}</span>}</label>;
}
