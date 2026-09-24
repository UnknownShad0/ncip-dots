import { Link, usePage } from '@inertiajs/react';
import { PropsWithChildren, ReactNode, useState } from 'react';

type NavItem = {
    name: string;
    href: string;
    current: string;
    children?: never;
};

type NavDropdownItem = {
    name: string;
    children: {
        name: string;
        href: string;
        current: string;
    }[];
    href?: never;
    current?: never;
};

type NavigationItem = NavItem | NavDropdownItem;

const navigation: NavigationItem[] = [
    {
        name: 'Dashboard',
        href: 'dashboard',
        current: 'dashboard',
    },
    {
        name: 'Documents',
        children: [
            {
                name: 'Incoming Documents',
                href: 'documents.incoming',
                current: 'documents.incoming',
            },
            {
                name: 'Outgoing Documents',
                href: 'documents.outgoing',
                current: 'documents.outgoing',
            },
            {
                name: 'All Documents',
                href: 'documents.index',
                current: 'documents.index',
            },
        ],
    },
    {
        name: 'Other Information Systems',
        children: [
            {
                name: 'PDMIS',
                href: 'pdmis.index',
                current: 'pdmis.index',
            },
            {
                name: 'DRIP',
                href: 'drip.index',
                current: 'drip.index',
            },
            {
                name: 'iPLuma',
                href: 'ipluma.index',
                current: 'ipluma.index',
            },
        ],
    },
    {
        name: 'User Accounts',
        href: 'user-accounts.index',
        current: 'user-accounts.index',
    },
    {
        name: 'Libraries',
        children: [
            {
                name: 'Office',
                href: 'libraries.agencies',
                current: 'libraries.agencies',
            },
            {
                name: 'Range',
                href: 'libraries.offices',
                current: 'libraries.offices',
            },
            {
                name: 'Document Type',
                href: 'libraries.document-types',
                current: 'libraries.document-types',
            },
            {
                name: 'Purpose Type',
                href: 'purpose-types.index',
                current: 'purpose-types.index',
            },
            {
                name: 'Action Type',
                href: 'libraries.action-types',
                current: 'libraries.action-types',
            },
        ],
    },
    {
        name: 'Archives',
        children: [
            {
                name: 'Archived Documents',
                href: 'archives.index',
                current: 'archives.index',
            },
            {
                name: 'Archive Categories',
                href: 'archives.categories',
                current: 'archives.categories',
            },
        ],
    },
    {
        name: 'Audit Trail',
        href: 'audit-trail.index',
        current: 'audit-trail.index',
    },
];

function NavDropdown({
    item,
}: {
    item: NavDropdownItem;
}) {
    const active = item.children.some((child) =>
        route().current(child.current),
    );

    const [open, setOpen] = useState(active);

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={[
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition',
                    active
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                ].join(' ')}
            >
                <span>{item.name}</span>

                <svg
                    className={[
                        'h-4 w-4 transition-transform duration-200',
                        open ? 'rotate-180' : '',
                    ].join(' ')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                    />
                </svg>
            </button>

            {open && (
                <div className="mt-1 space-y-1 pl-4">
                    {item.children.map((child) => {
                        const childActive = route().current(
                            child.current,
                        );

                        return (
                            <Link
                                key={child.name}
                                href={route(child.href)}
                                className={[
                                    'block rounded-lg px-3 py-2 text-sm transition',
                                    childActive
                                        ? 'bg-slate-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                                ].join(' ')}
                            >
                                {child.name}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = (usePage().props as any).auth.user;

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="flex min-h-screen">
                {/* Sidebar */}
                <aside className="flex w-72 shrink-0 flex-col bg-slate-900 text-slate-100">
                    {/* Logo */}
                    <div className="flex h-16 shrink-0 items-center border-b border-slate-700 px-6">
                        <Link
                            href={route('dashboard')}
                            className="text-xl font-bold tracking-wide"
                        >
                            DOTS
                        </Link>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
                        {navigation.map((item) => {
                            if ('children' in item) {
                                return (
                                    <NavDropdown
                                        key={item.name}
                                        // item={item}
                                        item={item as NavDropdownItem}
                                    />
                                );
                            }

                            const active = route().current(
                                item.current,
                            );

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

                    {/* User */}
                    <div className="shrink-0 border-t border-slate-700 p-4">
                        <div className="mb-3">
                            <div className="text-sm font-medium text-slate-200">
                                {user.name}
                            </div>

                            <div className="mt-1 text-xs text-slate-400">
                                {user.email}
                            </div>
                        </div>

                        <Link
                            href={route('logout')}
                            method="post"
                            as="button"
                            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-700"
                        >
                            Log Out
                        </Link>
                    </div>
                </aside>

                {/* Main */}
                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div>{header}</div>

                            <div className="text-sm text-slate-500">
                                {user.role || 'User'}
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 p-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}