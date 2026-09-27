import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useMemo, useState } from 'react';

type UserRow = {
    id: number | string;
    name: string;
    email: string;
    role: string;
    office_id: number | null;
    office_name: string;
    division_id: number | null;
    division_name: string;
    is_active: boolean;
    last_login_at: string | null;
    source: string;
};
type Option = { id: number; name: string; office_id?: number };
type FormState = {
    name: string;
    email: string;
    role: string;
    office_id: string;
    division_id: string;
    is_active: boolean;
    password: string;
    password_confirmation: string;
};
type SortKey = 'name' | 'email' | 'role' | 'office_name' | 'division_name' | 'is_active';

const emptyForm: FormState = {
    name: '', email: '', role: 'user', office_id: '', division_id: '',
    is_active: true, password: '', password_confirmation: '',
};

export default function UserAccountsIndex({
    users = [], offices = [], divisions = [],
}: { users?: UserRow[]; offices?: Option[]; divisions?: Option[] }) {
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

    const visibleUsers = useMemo(() => {
        const term = search.toLowerCase();
        const filtered = users.filter((user) => [user.name, user.email, user.role, user.office_name, user.division_name]
            .join(' ').toLowerCase().includes(term));
        return [...filtered].sort((a, b) => {
            const left = String(a[sortKey] ?? '').toLowerCase();
            const right = String(b[sortKey] ?? '').toLowerCase();
            return left.localeCompare(right) * (sortDirection === 'asc' ? 1 : -1);
        });
    }, [users, search, sortKey, sortDirection]);

    const pageCount = Math.max(1, Math.ceil(visibleUsers.length / perPage));
    const pageUsers = visibleUsers.slice((page - 1) * perPage, page * perPage);
    const availableDivisions = divisions.filter((division) => !form.office_id || String(division.office_id) === form.office_id);

    const closeModal = () => {
        setEditingRow(null);
        setIsCreateOpen(false);
        setForm(emptyForm);
        setErrors({});
    };

    const openEdit = (user: UserRow) => {
        if (user.source === 'Old DB') return;
        setEditingRow(user);
        setForm({
            name: user.name ?? '', email: user.email ?? '', role: user.role ?? 'user',
            office_id: user.office_id ? String(user.office_id) : '',
            division_id: user.division_id ? String(user.division_id) : '',
            is_active: user.is_active, password: '', password_confirmation: '',
        });
        setIsCreateOpen(false);
        setErrors({});
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        setProcessing(true);
        const payload = {
            ...form,
            office_id: form.office_id || null,
            division_id: form.division_id || null,
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
        <AuthenticatedLayout header={<h2 className="text-xl font-semibold text-slate-800">User Accounts</h2>}>
            <Head title="User Accounts" />
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-0 print:shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800">System Users</h3>
                        <p className="text-sm text-slate-500">Manage user access and organizational assignments.</p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <button type="button" onClick={() => window.print()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">Print</button>
                        <button type="button" onClick={() => { closeModal(); setIsCreateOpen(true); }} className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">New User</button>
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
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-slate-600"><tr>
                            <th className="px-4 py-3">{sortButton('Name', 'name')}</th>
                            <th className="px-4 py-3">{sortButton('Email', 'email')}</th>
                            <th className="px-4 py-3">{sortButton('Role', 'role')}</th>
                            <th className="px-4 py-3">{sortButton('Office', 'office_name')}</th>
                            <th className="px-4 py-3">{sortButton('Division', 'division_name')}</th>
                            <th className="px-4 py-3">{sortButton('Status', 'is_active')}</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3 print:hidden">Action</th>
                        </tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {pageUsers.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No users found.</td></tr> : pageUsers.map((user) => (
                                <tr key={`${user.source}:${user.id}`}>
                                    <td className="px-4 py-3 font-medium text-slate-800">{user.name}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                                    <td className="px-4 py-3 capitalize text-slate-600">{user.role || 'user'}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.office_name || 'No office'}</td>
                                    <td className="px-4 py-3 text-slate-600">{user.division_name || 'No division'}</td>
                                    <td className="px-4 py-3"><span className={user.is_active ? 'text-emerald-700' : 'text-slate-500'}>{user.is_active ? 'Active' : 'Inactive'}</span></td>
                                    <td className="px-4 py-3 text-slate-600">{user.source}</td>
                                    <td className="px-4 py-3 print:hidden"><button type="button" onClick={() => openEdit(user)} disabled={user.source === 'Old DB'} className={`rounded-md px-3 py-1.5 text-xs font-medium ${user.source === 'Old DB' ? 'cursor-not-allowed bg-slate-300 text-slate-500' : 'bg-sky-600 text-white hover:bg-sky-700'}`}>Edit</button></td>
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

            {(isCreateOpen || editingRow) && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 print:hidden" role="dialog" aria-modal="true">
                <form onSubmit={submit} className="my-8 w-full max-w-2xl space-y-4 rounded-xl bg-white p-6 shadow-xl">
                    <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-800">{editingRow ? 'Edit User Account' : 'New User Account'}</h3><button type="button" onClick={closeModal} className="text-slate-500">Close</button></div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" error={errors.name}><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Email" error={errors.email}><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Role" error={errors.role}><input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Office" error={errors.office_id}><select value={form.office_id} onChange={(e) => setForm({ ...form, office_id: e.target.value, division_id: '' })} className="w-full rounded-md border-slate-300"><option value="">No office</option>{offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}</select></Field>
                        <Field label="Division" error={errors.division_id}><select value={form.division_id} onChange={(e) => setForm({ ...form, division_id: e.target.value })} className="w-full rounded-md border-slate-300"><option value="">No division</option>{availableDivisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></Field>
                        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active account</label>
                        <Field label={editingRow ? 'New password (optional)' : 'Password'} error={errors.password}><input required={!editingRow} type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                        <Field label="Confirm password" error={errors.password_confirmation}><input required={!editingRow && !!form.password} type="password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} className="w-full rounded-md border-slate-300" /></Field>
                    </div>
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
