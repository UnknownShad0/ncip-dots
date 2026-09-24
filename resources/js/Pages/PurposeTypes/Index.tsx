import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';

type PurposeTypeRow = {
    id: number | string | null;
    name: string;
    description: string;
    is_active: number;
    source?: string;
};

export default function PurposeTypesIndex({
    purposeTypes = [],
}: {
    purposeTypes?: PurposeTypeRow[];
}) {
    const [editingRow, setEditingRow] = useState<PurposeTypeRow | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [form, setForm] = useState({
        name: '',
        description: '',
        is_active: true,
    });

    const openEdit = (row: PurposeTypeRow) => {
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

        router.post('/purpose-types', {
            ...form,
            is_active: form.is_active ? 1 : 0,
        });
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRow || editingRow.id == null) {
            return;
        }

        router.put(`/purpose-types/${editingRow.id}`, {
            ...form,
            is_active: form.is_active ? 1 : 0,
        });
    };

    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">Purpose Types</h2>}
        >
            <Head title="Purpose Types" />

            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4">
                    <h3 className="text-lg font-semibold text-slate-800">Purpose Type List</h3>

                    <button
                        type="button"
                        onClick={openCreate}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                        New Purpose Type
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Name</th>
                                <th className="px-4 py-3 font-semibold">Description</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {purposeTypes.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                                        No purpose types found.
                                    </td>
                                </tr>
                            ) : (
                                purposeTypes.map((row, index) => {
                                    const isLegacy = row.source === 'Old DB';

                                    return (
                                        <tr
                                            key={`${row.id ?? 'row'}-${index}`}
                                            className="border-t border-slate-200"
                                        >
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {row.name}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {row.description || '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                        Number(row.is_active) === 1
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-rose-100 text-rose-700'
                                                    }`}
                                                >
                                                    {Number(row.is_active) === 1 ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(row)}
                                                    disabled={isLegacy}
                                                    className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                                                        isLegacy
                                                            ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                                                            : 'bg-sky-600 text-white hover:bg-sky-700'
                                                    }`}
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
            </div>

            {(isCreateOpen || editingRow) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {editingRow ? 'Update Purpose Type' : 'Add Purpose Type'}
                            </h3>

                            <button
                                type="button"
                                onClick={() => {
                                    setEditingRow(null);
                                    setIsCreateOpen(false);
                                }}
                                className="text-sm text-slate-500 hover:text-slate-700"
                            >
                                Close
                            </button>
                        </div>

                        <form
                            onSubmit={editingRow ? handleUpdate : handleCreate}
                            className="space-y-4"
                        >
                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Name
                                </label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-slate-700">
                                    Description
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) =>
                                        setForm({ ...form, description: e.target.value })
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                                    rows={4}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    id="is_active"
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) =>
                                        setForm({ ...form, is_active: e.target.checked })
                                    }
                                    className="h-4 w-4 rounded border-slate-300 text-sky-600"
                                />
                                <label htmlFor="is_active" className="text-sm text-slate-700">
                                    Active
                                </label>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingRow(null);
                                        setIsCreateOpen(false);
                                    }}
                                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                                >
                                    {editingRow ? 'Save Changes' : 'Add Purpose Type'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
