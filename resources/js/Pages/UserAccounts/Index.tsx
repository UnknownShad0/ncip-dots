import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

type UserRow = {
    id: string;
    name: string;
    email: string;
    username: string;
    firstname: string;
    middlename: string;
    lastname: string;
    extensionname: string;
    agency_employee_no: string;
    role_id: string;
    role: string;
    office_id: number | null;
    office_name: string;
    is_active: boolean;
    is_locked: boolean;
    logged_in_status: string;
    last_login_at: string | null;
    source: string;
};
type RoleOption = { id: number; name: string };
type FormState = {
    agency_employee_no: string;
    firstname: string;
    middlename: string;
    lastname: string;
    extensionname: string;
    username: string;
    email: string;
    role_id: string;
    officeId: string;
    status: string;
    isLocked: string;
};
type EmployeeLookup = {
    employee: {
        employee_id: string | number;
        employee_code: string;
        username: string;
        email_address: string;
        first_name: string;
        middle_name: string;
        last_name: string;
        ext_name: string;
        agency_employee_no: string;
        division_code: string;
        division: string;
    };
    offices: { region_code: string; region_name: string; office_code: string; office_name: string; office_id: number | null }[];
};
type SortKey = 'name' | 'email' | 'role' | 'office_name' | 'is_active';

const emptyForm: FormState = {
    agency_employee_no: '', firstname: '', middlename: '', lastname: '', extensionname: '', username: '', email: '', role_id: '', officeId: '',
    status: '1', isLocked: 'N',
};

export default function UserAccountsIndex({
    users = [], roles = [],
}: { users?: UserRow[]; roles?: RoleOption[] }) {
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
    const [employeeLookup, setEmployeeLookup] = useState<EmployeeLookup | null>(null);
    const [lookupError, setLookupError] = useState('');
    const [lookupProcessing, setLookupProcessing] = useState(false);

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
    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm(emptyForm);
        setErrors({});
        setEmployeeLookup(null);
        setLookupError('');
    };

    const openEdit = (user: UserRow) => {
        setEditingRow(user);
        setForm({
            agency_employee_no: user.agency_employee_no ?? '',
            firstname: user.firstname ?? '', middlename: user.middlename ?? '',
            lastname: user.lastname ?? '', extensionname: user.extensionname ?? '',
            username: user.username ?? '', email: user.email ?? '', role_id: user.role_id ?? '',
            officeId: user.office_id == null ? '' : String(user.office_id),
            status: user.is_active ? '1' : '0', isLocked: user.is_locked ? 'Y' : 'N',
        });
        setIsCreateOpen(false);
        setErrors({});
        setEmployeeLookup(null);
        setLookupError('');
    };

    const lookupEmployee = async () => {
        const employeeNumber = form.agency_employee_no.trim();
        if (!employeeNumber) {
            setLookupError('Enter an Agency Employee Number first.');
            return;
        }

        setLookupProcessing(true);
        setLookupError('');
        setEmployeeLookup(null);
        setErrors({});

        try {
            const params = new URLSearchParams({ agency_employee_no: employeeNumber });
            const response = await fetch(`${route('user-accounts.employee-lookup')}?${params}`, {
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message ?? 'Employee lookup failed.');

            const details = result as EmployeeLookup;
            const matchedOffice = details.offices.find((office) => office.office_id !== null);
            setEmployeeLookup(details);
            setForm((current) => ({
                ...current,
                agency_employee_no: details.employee.agency_employee_no || employeeNumber,
                firstname: details.employee.first_name || '',
                middlename: details.employee.middle_name || '',
                lastname: details.employee.last_name || '',
                extensionname: details.employee.ext_name || '',
                username: details.employee.username || '',
                email: details.employee.email_address || '',
                officeId: matchedOffice ? String(matchedOffice.office_id) : '',
            }));
        } catch (error) {
            setLookupError(error instanceof Error ? error.message : 'Employee lookup failed.');
        } finally {
            setLookupProcessing(false);
        }
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        const payload = {
            ...form,
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
        <button type="button" onClick={() => toggleSort(key)} className="font-semibold hover:text-sky-700">
            {label}{sortKey === key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}
        </button>
    );

    return (
        <AuthenticatedLayout header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Administration</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">User Accounts</h1></div>}>
            <Head title="User Accounts" />
            <div className="mx-auto max-w-[1440px] space-y-5 rounded-2xl border border-[#e2e2df] bg-white p-5 shadow-sm print:border-0 print:shadow-none sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight text-[#171717]">System users</h2>
                        <p className="mt-1 text-sm text-[#73736e]">Manage access, office assignments, and account status.</p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <button type="button" onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Print</button>
                        <button type="button" onClick={() => { closeModal(); setIsCreateOpen(true); }} className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700">New User</button>
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

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-[#e8e8e4] text-left text-sm">
                        <thead className="bg-[#f7f8fa] text-[#555752]"><tr>
                            <th className="px-4 py-3">{sortButton('Name', 'name')}</th>
                            <th className="px-4 py-3">{sortButton('Email', 'email')}</th>
                            <th className="px-4 py-3">{sortButton('Office', 'office_name')}</th>
                            <th className="px-4 py-3">{sortButton('Status', 'is_active')}</th>
                            <th className="px-4 py-3 print:hidden">Action</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {pageUsers.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr> : pageUsers.map((user) => (
                                <tr key={`${user.source}:${user.id}`} className="transition-colors hover:bg-[#fafaf8]">
                                    <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.office_name || 'No office'}</td>
                                    <td className="px-4 py-3"><span className={user.is_active ? 'text-emerald-700' : 'text-slate-500'}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td className="px-4 py-3 print:hidden">
                                        {user.source === 'Legacy DB' ? (
                                            <button type="button" disabled title="Legacy accounts are read-only" className="cursor-not-allowed rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500">Read-only</button>
                                        ) : (
                                            <button type="button" onClick={() => openEdit(user)} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700">Edit</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-600 print:hidden">
                    <span>{visibleUsers.length === 0 ? '0 users' : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, visibleUsers.length)} of ${visibleUsers.length} users`}</span>
                    <div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div>
                </div>
            </div>

            {(isCreateOpen || editingRow) && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 p-4 print:hidden" role="dialog" aria-modal="true" aria-labelledby="user-account-modal-title">
                <form onSubmit={submit} className="my-8 max-h-[calc(100vh-2rem)] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-[#e2e2df] bg-white p-6 shadow-2xl">
                    <div className="flex items-center justify-between"><h3 id="user-account-modal-title" className="text-lg font-semibold text-slate-800">{editingRow ? 'Edit User Account' : 'New User Account'}</h3><button type="button" onClick={closeModal} className="text-slate-500">Close</button></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {!editingRow && <Field label="Agency Employee Number (ID No.)" error={errors.agency_employee_no}><div className="flex gap-2"><input required maxLength={100} value={form.agency_employee_no} onChange={(e) => { setForm({ ...form, agency_employee_no: e.target.value }); setEmployeeLookup(null); setLookupError(''); }} className="min-w-0 flex-1 rounded-md border-slate-300" /><button type="button" onClick={lookupEmployee} disabled={lookupProcessing} className="shrink-0 rounded-md bg-sky-600 px-3 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50">{lookupProcessing ? 'Looking up…' : 'Lookup'}</button></div>{lookupError && <span className="block text-xs text-red-600">{lookupError}</span>}</Field>}
                        {editingRow && <Field label="Agency Employee Number (ID No.)"><input readOnly value={form.agency_employee_no} className="w-full rounded-md border-slate-300 bg-slate-100" /></Field>}
                        <Field label="First Name" error={errors.firstname}><input required readOnly value={form.firstname} className="w-full rounded-md border-slate-300 read-only:bg-slate-100" /></Field>
                        <Field label="Middle Name" error={errors.middlename}><input readOnly value={form.middlename} className="w-full rounded-md border-slate-300 read-only:bg-slate-100" /></Field>
                        <Field label="Last Name" error={errors.lastname}><input required readOnly value={form.lastname} className="w-full rounded-md border-slate-300 read-only:bg-slate-100" /></Field>
                        <Field label="Extension Name" error={errors.extensionname}><input readOnly value={form.extensionname} className="w-full rounded-md border-slate-300 read-only:bg-slate-100" /></Field>
                        <Field label="Username" error={errors.username}><input required maxLength={50} readOnly value={form.username} className="w-full rounded-md border-slate-300 read-only:bg-slate-100" /></Field>
                        <Field label="Email" error={errors.email}><input required type="email" maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Role" error={errors.role_id}><select required value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="w-full rounded-md border-slate-300"><option value="">Select role</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></Field>
                        <div className="sm:col-span-2"><p className="text-sm text-slate-700">Office</p><p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">{editingRow?.office_name || employeeLookup?.offices.find((office) => office.office_id !== null)?.office_name || employeeLookup?.offices[0]?.office_name || (employeeLookup ? 'No office returned by the employee directory' : 'Look up the employee to assign an office')}</p>{errors.officeId && <p className="mt-1 text-xs text-red-600">{errors.officeId}</p>}</div>
                        {editingRow && <Field label="Account Status" error={errors.status}><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border-slate-300"><option value="1">Active</option><option value="0">Inactive</option></select></Field>}
                        {editingRow && <Field label="Login Status" error={errors.isLocked}><select value={form.isLocked} onChange={(e) => setForm({ ...form, isLocked: e.target.value })} className="w-full rounded-md border-slate-300"><option value="N">Unlocked</option><option value="Y">Locked</option></select></Field>}
                    </div>
                    {employeeLookup && <section className="rounded-xl border border-sky-100 bg-sky-50/70 p-4" aria-label="Employee directory details">
                        <h4 className="mb-3 text-sm font-semibold text-sky-900">Employee directory details</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                            <LookupDetail label="Employee ID" value={employeeLookup.employee.employee_id} />
                            <LookupDetail label="Employee Code" value={employeeLookup.employee.employee_code} />
                            <LookupDetail label="Agency Employee No." value={employeeLookup.employee.agency_employee_no} />
                            <LookupDetail label="Division Code" value={employeeLookup.employee.division_code} />
                            <LookupDetail label="Division" value={employeeLookup.employee.division} />
                        </div>
                        {employeeLookup.offices.map((office, index) => <div key={`${office.office_code}-${index}`} className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-sky-100 pt-3 text-sm sm:grid-cols-4">
                            <LookupDetail label="Region Code" value={office.region_code} />
                            <LookupDetail label="Region" value={office.region_name} />
                            <LookupDetail label="Office Code" value={office.office_code} />
                            <LookupDetail label="Office" value={office.office_name} />
                        </div>)}
                    </section>}
                    {errors.user && <p className="text-sm text-red-600">{errors.user}</p>}
                    <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={closeModal} className="rounded-md border px-4 py-2 text-sm">Cancel</button><button disabled={processing} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{processing ? 'Saving...' : 'Save account'}</button></div>
                </form>
            </div>}
        </AuthenticatedLayout>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return <label className="space-y-1 text-sm text-slate-700"><span className="block">{label}</span>{children}{error && <span className="block text-xs text-red-600">{error}</span>}</label>;
}

function LookupDetail({ label, value }: { label: string; value: string | number | null | undefined }) {
    return <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className="truncate font-medium text-slate-800">{value || '—'}</p></div>;
}
