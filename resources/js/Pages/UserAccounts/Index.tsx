import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

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
    account_status: 'Active' | 'Inactive' | 'Pending';
    is_locked: boolean;
    logged_in_status: string;
    last_login_at: string | null;
    source: string;
};
type OfficeOption = { id: number; name: string; email?: string };
type OfficeTableOption = { id: string; code: string | null; name: string; email?: string | null; range_name?: string | null; source?: string };
type RoleOption = { id: number; name: string };
type FormState = {
    employee_role: string;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
    role_id: string;
    officeId: string;
    status: string;
    isLocked: string;
    password: string;
    password_confirmation: string;
};
type EmployeeLookup = {
    employee: { employee_code: string; first_name: string; middle_name?: string; last_name: string; ext_name?: string; username: string; email_address?: string; division_code?: string; division?: string };
    offices: { office_code: string; office_name: string; region_code: string; region_name: string }[];
};
type SortKey = 'name' | 'username' | 'email' | 'role' | 'office_name' | 'account_status';

const emptyForm: FormState = {
    employee_role: '', firstname: '', lastname: '', username: '', email: '', role_id: '', officeId: '',
    status: '1', isLocked: 'N', password: '', password_confirmation: '',
};

export default function UserAccountsIndex({
    users = [], offices = [], officeTableOptions = [], roles = [], flash = {},
}: { users?: UserRow[]; offices?: OfficeOption[]; officeTableOptions?: OfficeTableOption[]; roles?: RoleOption[]; flash?: { success?: string; warning?: string } }) {
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
    const [lookup, setLookup] = useState<EmployeeLookup | null>(null);
    const [lookupOpen, setLookupOpen] = useState(false);
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupError, setLookupError] = useState('');
    const [officeCode, setOfficeCode] = useState('');
    const [officeTableId, setOfficeTableId] = useState('');
    const lookupVersion = useRef(0);

    const resetLookup = () => {
        lookupVersion.current++;
        setLookup(null); setLookupOpen(false); setLookupBusy(false);
        setLookupError(''); setEmployeeCode(''); setOfficeCode(''); setOfficeTableId('');
    };
    const selectType = (type: 'dots' | 'employee') => {
        resetLookup(); setAccountType(type); setForm(emptyForm); setErrors({});
    };
    const searchEmployee = async () => {
        const version = ++lookupVersion.current;
        setLookupBusy(true); setLookupError(''); setLookup(null); setForm(emptyForm); setOfficeCode(''); setOfficeTableId('');
        try {
            const response = await axios.post<EmployeeLookup>('/user-accounts/lookup-employee', { employee_code: employeeCode.trim() });
            if (version !== lookupVersion.current) return;
            const result = response.data;
            setLookup(result); setLookupOpen(false);
            setOfficeCode(result.offices[0]?.office_code ?? '');
            const divisionCode = result.employee.division_code?.trim().toLowerCase();
            const matchingOffice = divisionCode
                ? officeTableOptions.find((office) => office.code?.trim().toLowerCase() === divisionCode)
                : undefined;
            setOfficeTableId(matchingOffice?.id ?? '');
            setForm({ ...emptyForm, firstname: result.employee.first_name, lastname: result.employee.last_name,
                username: result.employee.username, email: '' });
        } catch (error) {
            if (version !== lookupVersion.current) return;
            setLookupError(axios.isAxiosError(error) ? error.response?.data?.errors?.employee_code?.[0] || error.response?.data?.message || 'Employee lookup failed. Please try again.' : 'Employee lookup failed. Please try again.');
        } finally {
            if (version === lookupVersion.current) setLookupBusy(false);
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
    const divisionCode = lookup?.employee.division_code?.trim().toLowerCase();
    const divisionOffice = divisionCode
        ? officeTableOptions.find((office) => office.code?.trim().toLowerCase() === divisionCode)
        : undefined;

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
            employee_role: ['super admin', 'executive', 'admin staff'].includes(user.role.toLowerCase()) ? user.role.toLowerCase() : '',
            firstname: user.firstname ?? '', lastname: user.lastname ?? '',
            username: user.username ?? '', email: user.email ?? '', role_id: user.role_id ?? '',
            officeId: user.office_id == null ? '' : String(user.office_id),
            status: user.is_active ? '1' : '0', isLocked: user.is_locked ? 'Y' : 'N',
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
            office_code: officeCode,
            office_table_id: officeTableId,
            operation: editingRow ? 'update' : 'create',
            status: editingRow ? form.status : undefined,
            isLocked: editingRow ? form.isLocked : undefined,
        };
        const options = {
            onSuccess: closeModal,
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
        <button type="button" onClick={() => toggleSort(key)} className="flex items-center gap-1 font-semibold hover:text-sky-700">
            {label}{sortKey === key ? (sortDirection === 'asc' ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5" />) : <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />}
        </button>
    );

    return (
        <AuthenticatedLayout header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Administration</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">User Accounts</h1></div>}>
            <Head title="User Accounts" />
            <div className="mx-auto max-w-[1440px] space-y-5 rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm print:border-0 print:shadow-none sm:p-6">
                {flash.success && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{flash.success}</p>}
                {flash.warning && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{flash.warning}</p>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-[#171717]">System users</h2>
                        <p className="mt-1 text-sm text-[#73736e]">Manage access, office assignments, and account status.</p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <button type="button" onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Print</button>
                        <button type="button" onClick={() => { closeModal(); setAccountType('employee'); setLookupOpen(true); setIsCreateOpen(true); }} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">New User</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search users..." className="w-full max-w-sm rounded-md border-slate-300 text-sm" />
                    <label className="text-sm text-slate-600">Rows per page{' '}
                        <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1); }} className="ml-2 rounded-md border-slate-300 text-sm">
                            {[10, 25, 50].map((count) => <option key={count} value={count}>{count}</option>)}
                        </select>
                    </label>
                </div>

                <section className="overflow-hidden rounded-2xl border border-[#e2e2df] bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#e8e8e4] bg-[#fafaf8] px-5 py-3 text-sm text-slate-600">
                        <span>{visibleUsers.length} {visibleUsers.length === 1 ? 'user' : 'users'}</span>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-[#f7f8fa] text-[#555752]"><tr>
                            <th className="px-4 py-3 font-semibold">{sortButton('Name', 'name')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Username', 'username')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Email', 'email')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Role', 'role')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Office', 'office_name')}</th>
                            <th className="px-4 py-3 font-semibold">{sortButton('Status', 'account_status')}</th>
                            <th className="px-4 py-3 font-semibold print:hidden">Actions</th>
                        </tr></thead>
                        <tbody>
                            {pageUsers.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr> : pageUsers.map((user) => (
                                <tr key={`${user.source}:${user.id}`} className="border-t border-[#eeeeeb] transition-colors hover:bg-[#fafaf8]">
                                    <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.username || '—'}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.role || '—'}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.office_name || 'No office'}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${user.account_status === 'Active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : user.account_status === 'Pending' ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200' : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'}`}>
                                            {user.account_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 print:hidden">
                                        <button type="button" onClick={() => openEdit(user)} disabled={user.source === 'Legacy DB'} title={user.source === 'Legacy DB' ? 'Legacy accounts are read-only' : undefined} className={`rounded-md px-3 py-1.5 text-xs font-medium ${user.source === 'Legacy DB' ? 'cursor-not-allowed bg-slate-300 text-slate-500' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                    <div className="flex flex-col gap-3 border-t border-[#e8e8e4] bg-[#fafaf8] px-5 py-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
                        <span className="text-sm text-slate-600">{visibleUsers.length === 0 ? '0 users' : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, visibleUsers.length)} of ${visibleUsers.length} users`}</span>
                        <div className="flex items-center gap-2">
                            <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
                            <span className="text-sm text-slate-600">Page {page} of {pageCount}</span>
                            <button type="button" disabled={page >= pageCount} onClick={() => setPage((prev) => Math.min(prev + 1, pageCount))} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
                        </div>
                    </div>
                </section>
            </div>

            {(isCreateOpen || editingRow) && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="user-account-modal-title">
                <form onSubmit={submit} className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white p-6 shadow-2xl">
                    <div className="flex items-center justify-between"><h3 id="user-account-modal-title" className="text-lg font-semibold text-slate-800">{editingRow ? 'Edit User Account' : 'New User Account'}</h3><button type="button" onClick={closeModal} className="text-slate-500">Close</button></div>
                    {!editingRow && accountType === 'employee' && <div className="space-y-4">
                        {(!lookup || lookupOpen) && <div className="space-y-3 rounded-xl border p-4">
                            <div className="flex items-end gap-2"><div className="flex-1"><Field label="Employee Code"><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (employeeCode.trim() && !lookupBusy) void searchEmployee(); } }} placeholder="Enter employee code" className="w-full rounded-md border-slate-300" /></Field></div>
                                <button type="button" disabled={lookupBusy || !employeeCode.trim()} onClick={() => void searchEmployee()} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{lookupBusy ? 'Searching...' : 'Search'}</button>
                            </div>
                            {lookupError && <p role="alert" className="text-sm text-red-600">{lookupError}</p>}
                        </div>}
                        {lookup && !lookupOpen && <>
                            <button type="button" disabled={processing || lookupBusy} onClick={() => { setLookupOpen(true); setLookupError(''); }} className="self-start rounded-lg border px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50">Search another employee</button>
                            <dl className="grid gap-3 rounded-xl bg-sky-50 p-4 text-sm sm:grid-cols-2">
                                {[
                                    ['Employee Code', lookup.employee.employee_code],
                                    ['First Name', lookup.employee.first_name], ['Middle Name', lookup.employee.middle_name],
                                    ['Last Name', lookup.employee.last_name], ['Extension Name', lookup.employee.ext_name],
                                    ['Username', lookup.employee.username],
                                ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-medium text-slate-800">{value || '—'}</dd></div>)}
                            </dl>
                            {divisionOffice ? <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Office"><input aria-label="Office" readOnly value={divisionOffice.name} className="w-full rounded-md border-slate-300 bg-slate-50 text-slate-700 read-only:cursor-default" /></Field>
                                <Field label="Range"><input aria-label="Range" readOnly value={divisionOffice.range_name || 'No range assigned'} className="w-full rounded-md border-slate-300 bg-slate-50 text-slate-700 read-only:cursor-default" /></Field>
                            </div> : <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                                <p className="whitespace-normal leading-6">No registered Office matches division <span className="font-semibold">{lookup.employee.division || '(unknown)'}</span>.
                                    Register the Office first in the <Link href="/offices" className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">Offices module</Link>, then search for this employee again.
                                </p>
                            </div>}
                            {errors.office_table_id && <p className="text-xs text-red-600">{errors.office_table_id}</p>}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Email" error={errors.email}><input required type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                                <Field label="Role" error={errors.employee_role}><select required value={form.employee_role} onChange={(e) => setForm({ ...form, employee_role: e.target.value })} className="w-full rounded-md border-slate-300"><option value="">Select role</option><option value="super admin">Super Admin</option><option value="executive">Executive</option><option value="admin staff">Admin Staff</option></select></Field>
                            </div>
                            {/* <p className="text-xs text-slate-500">Login details will be sent to this email.</p> */}
                        </>}
                    </div>}
                    {(editingRow || accountType === 'dots') && <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="First Name" error={errors.firstname}><input required value={form.firstname} onChange={(e) => setForm({ ...form, firstname: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Last Name" error={errors.lastname}><input required value={form.lastname} onChange={(e) => setForm({ ...form, lastname: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Username" error={errors.username}><input required maxLength={50} disabled={!!editingRow?.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full rounded-md border-slate-300 disabled:bg-slate-100" /></Field>
                        {editingRow && <Field label="Email" error={errors.email}><input required={!editingRow} type="email" maxLength={255} disabled={!!editingRow} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border-slate-300 disabled:bg-slate-100" /></Field>}
                        {editingRow?.employee_code ? <Field label="Role" error={errors.employee_role}><select required value={form.employee_role} onChange={(e) => setForm({ ...form, employee_role: e.target.value })} className="w-full rounded-md border-slate-300"><option value="">Select role</option><option value="super admin">Super Admin</option><option value="executive">Executive</option><option value="admin staff">Admin Staff</option></select></Field> : <Field label="Role" error={errors.role_id}><select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="w-full rounded-md border-slate-300"><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>}
                        <Field label="Office" error={errors.officeId}>{editingRow?.employee_code && !editingRow.office_id ? <p className="rounded-md border bg-slate-50 p-2">{editingRow.office_name}</p> : <select required value={form.officeId} onChange={(e) => { setErrors({}); setForm({ ...form, officeId: e.target.value, email: accountType === 'dots' ? offices.find((office) => String(office.id) === e.target.value)?.email ?? '' : form.email }); }} className="w-full rounded-md border-slate-300"><option value="">Select office</option>{officeOptions.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}</select>}</Field>
                        {!editingRow && accountType === 'dots' && form.officeId && <p className="text-sm text-slate-600 sm:col-span-2">{form.email ? <>Login details will be sent to <span className="font-medium">{form.email}</span>.</> : <span className="text-red-600">The selected office has no email address. Update the office email before creating an account.</span>}</p>}
                        {editingRow && <Field label="Account Status" error={errors.status}><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border-slate-300"><option value="1">Active</option><option value="0">Inactive</option></select></Field>}
                        {editingRow && <Field label="Login Status" error={errors.isLocked}><select value={form.isLocked} onChange={(e) => setForm({ ...form, isLocked: e.target.value })} className="w-full rounded-md border-slate-300"><option value="N">Unlocked</option><option value="Y">Locked</option></select></Field>}
                        {editingRow && <><Field label="New password (optional)" error={errors.password}><input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Confirm password" error={errors.password_confirmation}><input type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} className="w-full rounded-md border-slate-300" /></Field></>}
                    </div>}
                    {Object.entries(errors).filter(([key]) => !['firstname', 'lastname', 'role_id', 'officeId', 'office_table_id', 'password', 'password_confirmation', 'status', 'isLocked', 'user'].includes(key)).map(([key, message]) => <p key={key} className="text-sm text-red-600">{message}</p>)}
                    {errors.user && <p className="text-sm text-red-600">{errors.user}</p>}
                    <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={closeModal} className="rounded-md border px-4 py-2 text-sm">Cancel</button><button disabled={processing || (!editingRow && (!accountType || (accountType === 'dots' && !form.email) || (accountType === 'employee' && (!lookup || lookupOpen || lookupBusy || !officeCode || !officeTableId || !divisionOffice || !form.employee_role || !form.email))))} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{processing ? 'Saving...' : 'Save account'}</button></div>
                </form>
            </div>}
        </AuthenticatedLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <label className="space-y-1 text-sm text-slate-700"><span className="block">{label}</span>{children}{error && <span className="block text-xs text-red-600">{error}</span>}</label>;
}
