import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode } from 'react';

const navigation = [
    { name: 'Dashboard', href: 'dashboard', current: 'dashboard' },
    { name: 'Documents', href: 'documents.index', current: 'documents.index' },
    { name: 'Archives', href: 'archives.index', current: 'archives.index' },
    { name: 'Audit Trail', href: 'audit-trail.index', current: 'audit-trail.index' },
    { name: 'Setup', href: 'setup.index', current: 'setup.index' },
    { name: 'Users', href: 'user-accounts.index', current: 'user-accounts.index' },
];

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = (usePage().props as any).auth.user;

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="flex min-h-screen">
                <aside className="w-72 shrink-0 bg-slate-900 text-slate-100">
                    <div className="flex h-16 items-center border-b border-slate-700 px-6">
                        <Link href={route('dashboard')} className="text-xl font-bold tracking-wide">
                            DOTS
                        </Link>
                    </div>

                    <nav className="space-y-2 px-4 py-6">
                        {navigation.map((item) => {
                            const active = route().current(item.current);

                            return (
                                <Link
                                    key={item.name}
                                    href={route(item.href)}
                                    className={[
                                        'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition',
                                        active
                                            ? 'bg-slate-700 text-white'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                                    ].join(' ')}
                                >
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="mt-auto border-t border-slate-700 p-4">
                        <div className="mb-3 text-sm font-medium text-slate-300">{user.name}</div>
                        <div className="mb-4 text-xs text-slate-400">{user.email}</div>
                        <Link
                            href={route('logout')}
                            method="post"
                            as="button"
                            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-700"
                        >
                            Log Out
                        </Link>
                    </div>
                </aside>

                <div className="flex-1">
                    <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>{header}</div>
                            <div className="text-sm text-slate-500">{user.role || 'User'}</div>
                        </div>
                    </header>

                    <main className="p-6">{children}</main>
                </div>
            </div>
        </div>
    );
}
