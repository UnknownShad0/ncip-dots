import { Link, usePage } from '@inertiajs/react';
import { Menu as DropdownMenu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
    Archive, Building2, ChevronDown, Clock3, Database, FileClock,
    FileText, Folder, History, LayoutGrid, LogOut,
    Map, Menu, Target, UserRound, X, Zap,
} from 'lucide-react';
import { PropsWithChildren, ReactNode, useState } from 'react';

const groups = [
    { label: '', items: [{ name: 'Dashboard', href: 'dashboard', icon: LayoutGrid }] },
        { label: 'Documents', items: [
        { name: 'Latest documents', href: 'documents.latest', icon: Clock3 },
        { name: 'All documents', href: 'documents.index', icon: Folder },
        { name: 'Generate Document', href: 'document-creation.index', icon: FileText },
        { name: 'Approved Documents', href: 'approved-documents.index', icon: FileClock },
    ] },
    { label: 'Other information systems', items: [
        { name: 'PDMIS', href: 'pdmis.index', icon: Database },
        { name: 'DRIP', href: 'drip.index', icon: Database },
        { name: 'iPluma', href: 'ipluma.index', icon: Database },
    ] },
    { label: 'Libraries', items: [
        { name: 'Office', href: 'offices.index', icon: Building2 },
        { name: 'Range', href: 'ranges.index', icon: Map },
        { name: 'Document type', href: 'document-types.index', icon: FileText },
        { name: 'Purpose type', href: 'purpose-types.index', icon: Target },
        { name: 'Action type', href: 'action-types.index', icon: Zap },
        { name: 'User account', href: 'user-accounts.index', icon: UserRound },
    ] },
    { label: 'Archives', items: [
        { name: 'Archived documents', href: 'archives.index', icon: Archive },
    ] },
    { label: '', items: [{ name: 'Audit trails', href: 'audit-trail.index', icon: History }] },
];

export default function AuthenticatedLayout({
    header,
    children,
}: PropsWithChildren<{ header?: ReactNode }>) {
    const user = (usePage().props as any).auth.user;
    const canManageLibraries = (usePage().props as any).canManageLibraries === true;
    const [mobileOpen, setMobileOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
        Object.fromEntries(groups.filter((group) => group.label).map((group) => [
            group.label,
            group.items.some((item) => route().current(item.href)),
        ])),
    );

    return (
        <div className="min-h-screen bg-[#eef3f9] p-2.5 text-[#171717]">
            <div className="flex min-h-[calc(100vh-20px)] overflow-hidden rounded-[20px] border border-[#dce5f0] bg-[#f8fafd] shadow-sm">
                {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/30 lg:hidden" />}
                <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col border-r border-[#e2e2df] bg-white transition-transform lg:static lg:w-[320px] lg:translate-x-0`}>
                    <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-[#e2e8f0] border-b-2 border-b-[#eabf45] bg-[#f8fafd] px-6">
                        <Link href={route('dashboard')} className="flex items-center gap-3 text-[21px] font-semibold tracking-tight text-[#164f98]">
                            <img src="/images/logo/ncip-logo.png" alt="NCIP logo" className="h-12 w-12 object-contain" />
                            <span>DOTS</span>
                        </Link>
                        <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
                    </div>
                    <nav className="flex-1 overflow-y-auto py-3">
                        {groups.filter((group) => group.label !== 'Libraries' || canManageLibraries).map((group, index) => (
                            <section key={`${group.label}-${index}`} className={`${group.label ? 'px-5 pb-2 pt-3' : 'border-b border-[#e2e2df] px-0 pb-2'}`}>
                                {group.label && <button type="button" aria-expanded={Boolean(openGroups[group.label])} onClick={() => setOpenGroups((current) => ({ ...current, [group.label]: !current[group.label] }))} className="mb-1 flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[14px] font-medium text-[#898984] hover:text-[#555752]">
                                    {group.label}
                                    <ChevronDown size={16} className={`transition-transform duration-200 ${openGroups[group.label] ? 'rotate-0' : '-rotate-90'}`} />
                                </button>}
                                {(!group.label || openGroups[group.label]) && group.items.map(({ name, href, icon: Icon }) => {
                                    const active = route().current(href);
                                    return <Link key={name} href={route(href)} onClick={() => setMobileOpen(false)} className={`relative flex h-[48px] items-center gap-4 px-6 text-[16px] font-medium transition-colors ${active ? 'bg-[#e8eef7] text-[#164f98]' : 'text-[#181818] hover:bg-[#f3f4f5]'}`}>
                                        {active && <span className="absolute inset-y-0 left-0 w-1 bg-blue-600" />}
                                        <Icon size={21} strokeWidth={active ? 2.3 : 2} className={active ? 'text-[#164f98]' : 'text-[#555752]'} />
                                        <span>{name}</span>
                                    </Link>;
                                })}
                            </section>
                        ))}
                    </nav>
                    <div className="shrink-0 border-t border-[#e2e2df] p-4">
                        <div className="mb-3 flex items-center gap-3 px-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8eef7] text-sm font-semibold text-[#164f98]">{String(user.name ?? 'U').charAt(0).toUpperCase()}</span>
                            <div className="min-w-0"><div className="truncate text-sm font-semibold">{user.name}</div><div className="truncate text-xs text-[#898984]">{user.email}</div></div>
                        </div>
                        <Link href={route('logout')} method="post" as="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#555752] hover:bg-[#f3f4f5]"><LogOut size={17} />Log out</Link>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex min-h-[92px] items-center gap-4 border-b border-[#e5ebf3] bg-white/70 px-5 mb-5 lg:mb-10 sm:px-8 lg:px-10">
                        <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
                        <div className="min-w-0 flex-1">{header}</div>
                        <div className="hidden max-w-[640px] items-center gap-3 rounded-xl border border-[#e0e0dc] bg-white px-4 py-3 text-sm text-[#555752] sm:flex">
                            <Building2 size={20} className="shrink-0 text-[#898984]" aria-hidden="true" />
                            <span className="max-w-[180px] truncate" title={user.division || undefined}>{user.division || 'Division not assigned'}</span>
                            <span className="h-5 border-l border-[#e0e0dc]" aria-hidden="true" />
                            <UserRound size={18} className="shrink-0 text-[#898984]" aria-hidden="true" />
                            <span className="max-w-[140px] truncate" title={user.role || undefined}>{user.role || 'Role not assigned'}</span>
                            <span className="h-5 border-l border-[#e0e0dc]" aria-hidden="true" />
                            <Map size={18} className="shrink-0 text-[#898984]" aria-hidden="true" />
                            <span className="max-w-[160px] truncate" title={user.range || undefined}>{user.range || 'Range not assigned'}</span>
                        </div>
                        <DropdownMenu as="div" className="relative hidden sm:block">
                            <MenuButton className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-[#555752] outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-300">
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e8eef7] text-xs font-semibold text-[#164f98]">{String(user.name ?? 'U').charAt(0).toUpperCase()}</span>
                                <span className="max-w-32 truncate">{user.name}</span>
                                <ChevronDown size={16} />
                            </MenuButton>
                            <MenuItems transition anchor="bottom end" className="z-50 mt-2 w-60 origin-top-right rounded-xl border border-[#e2e2df] bg-white p-1.5 shadow-lg outline-none transition duration-100 data-[closed]:scale-95 data-[closed]:opacity-0">
                                <div className="border-b border-[#eeeeeb] px-3 py-2.5">
                                    <p className="truncate text-sm font-semibold text-[#171717]">{user.name}</p>
                                    <p className="truncate text-xs text-[#898984]">{user.email}</p>
                                </div>
                                <MenuItem>
                                    <Link href={route('profile.edit')} className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#333] data-[focus]:bg-[#f3f5f8]">
                                        <UserRound size={17} className="text-[#73736e]" />My profile
                                    </Link>
                                </MenuItem>
                                <MenuItem>
                                    <Link href={route('logout')} method="post" as="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#333] data-[focus]:bg-[#f3f5f8]">
                                        <LogOut size={17} className="text-[#73736e]" />Log out
                                    </Link>
                                </MenuItem>
                            </MenuItems>
                        </DropdownMenu>
                    </header>
                    <main className="flex-1 px-5 pb-8 sm:px-8 lg:px-10">{children}</main>
                </div>
            </div>
        </div>
    );
}
