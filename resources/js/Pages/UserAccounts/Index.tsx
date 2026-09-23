import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';

export default function UserAccountsIndex({ users = [] }: { users?: any[] }) {
    return (
        <AuthenticatedLayout
            header={<h2 className="text-xl font-semibold text-slate-800">User Accounts</h2>}
        >
            <Head title="User Accounts" />

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-slate-800">System Users</h3>

                <div className="space-y-3">
                    {users.length === 0 ? (
                        <p className="text-slate-500">No users found.</p>
                    ) : (
                        users.map((user) => (
                            <div key={user.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-4">
                                <div>
                                    <div className="font-medium text-slate-800">{user.name}</div>
                                    <div className="text-sm text-slate-500">{user.email}</div>
                                </div>
                                <div className="text-right text-sm text-slate-600">
                                    <div>{user.role || 'user'}</div>
                                    <div>{user.office?.name || 'No office'}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
