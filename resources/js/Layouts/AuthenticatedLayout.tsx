import { connectedSystems } from '@/Components/ConnectedSystemNavigation';
import { libraryLinks } from '@/Components/LibraryNavigation';
import { Head, Link, usePage } from '@inertiajs/react';
import { Dialog, DialogPanel, DialogTitle, Menu as DropdownMenu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { Archive, Building2, ChevronDown, Clock3, Database, FileClock, FileText, Folder, History, LayoutGrid, LogOut, Menu, UserRound, X, BookOpen, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const groups = [
    { label: '', items: [{ name: 'Dashboard', href: 'dashboard', icon: LayoutGrid }] },
        { label: 'Documents', items: [
        { name: 'Latest documents', href: 'documents.latest', icon: Clock3 },
        { name: 'All documents', href: 'documents.index', icon: Folder },
        { name: 'Generate Document', href: 'document-creation.index', icon: FileText },
        { name: 'Approved Documents', href: 'approved-documents.index', icon: FileClock },
    ] },
    { label: 'External API', items: [{ name: 'Connected systems', href: 'connected-systems.index', icon: Database }] },
    { label: 'Archives', items: [
        { name: 'Archived documents', href: 'archives.index', icon: Archive },
    ] },
    { label: 'Administration', items: [
        { name: 'User accounts', href: 'user-accounts.index', icon: UserRound },
        { name: 'Libraries', href: 'libraries.index', icon: BookOpen },
        { name: 'Audit trails', href: 'audit-trail.index', icon: History },
    ] },
];

export default function AuthenticatedLayout({ header, children }: PropsWithChildren<{ header?: ReactNode }>) {
    const { auth, canManageLibraries } = usePage().props as any;
    const user = auth.user;
    const displayName = user.short_name || user.name || 'User';
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const reduceMotion = useReducedMotion();
    useEffect(() => { try { setCollapsed(localStorage.getItem('dots.sidebar.collapsed') === 'true'); } catch {} }, []);
    const toggleSidebar = () => setCollapsed((value) => {
        try { localStorage.setItem('dots.sidebar.collapsed', String(!value)); } catch {}
        return !value;
    });
    const navigation = (compact = false) => <>
        <Link href={route('dashboard')} className="flex h-20 shrink-0 items-center gap-3 border-b border-border px-5" aria-label="DOTS home">
            <img src="/images/logo/ncip-logo.png" alt="" className="h-10 w-10 shrink-0 object-contain" />
            {!compact && <span><span className="block text-xl font-bold tracking-tight text-primary">DOTS<span className="text-tertiary">.</span></span><span className="block text-xs text-muted">Document Tracking System</span></span>}
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
            {groups.map((group, index) => <section key={index}>
                {group.label && (compact ? <div className="mx-3 mb-3 border-t border-border" /> : <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.label === 'Other information systems' ? 'Connected systems' : group.label}</h2>)}
                <div className="space-y-1">{group.items.filter((item) => !['libraries.index', 'user-accounts.index'].includes(item.href) || canManageLibraries === true).map(({name, href, icon: Icon}) => {
                    const active = href === 'libraries.index'
                        ? route().current('libraries.*') || route().current('setup.index') || libraryLinks.some((item) => route().current(item.href))
                        : href === 'connected-systems.index' ? route().current(href) || connectedSystems.some((item) => route().current(item.href)) : route().current(href);
                    return <Link key={href} href={route(href)} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} aria-label={name} title={compact ? name : undefined}
                        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${compact ? 'justify-center' : ''} ${active ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted hover:bg-secondary hover:text-foreground'}`}>
                        <Icon size={18} className="shrink-0" aria-hidden="true" />{!compact && <span>{name}</span>}
                    </Link>;
                })}</div>
            </section>)}
        </nav>
        <div className="border-t border-border p-3">
            <Link href={route('logout')} method="post" as="button" title={compact ? 'Sign out' : undefined} aria-label="Sign out" className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted hover:bg-secondary ${compact ? 'justify-center' : ''}`}><LogOut size={18} />{!compact && 'Sign out'}</Link>
        </div>
    </>;
    return <div className="dots-workspace min-h-screen bg-background text-sm text-foreground">
        <Head><link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" /><link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet" /></Head>
        <div className="flex min-h-screen">
            <motion.aside initial={false} animate={{width: collapsed ? 80 : 248}} transition={{duration: reduceMotion ? 0 : .2}} className="sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface lg:flex">{navigation(collapsed)}</motion.aside>
            <Dialog open={mobileOpen} onClose={setMobileOpen} className="relative z-50 lg:hidden">
                <div className="fixed inset-0 bg-foreground/40" aria-hidden="true" />
                <DialogPanel className="dots-workspace fixed inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-surface">
                    <DialogTitle className="sr-only">Navigation</DialogTitle>
                    <button onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="absolute right-2 top-2 rounded-lg p-2 text-muted"><X size={18} /></button>{navigation()}
                </DialogPanel>
            </Dialog>
            <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex min-h-20 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
                    <button type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} className="hidden rounded-lg p-2 text-muted hover:bg-secondary lg:block">{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>
                    <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-lg p-2 text-muted hover:bg-secondary lg:hidden"><Menu size={20} /></button>
                    <div className="min-w-0 flex-1 py-4">{header}</div>
                    <div className="hidden min-w-0 max-w-56 items-center gap-2 border-r border-border pr-4 text-muted xl:flex"><Building2 size={16} className="shrink-0" /><span className="truncate" title={[user.office_display_name, user.range].filter(Boolean).join(' · ')}>{user.office_display_name || 'Office not assigned'}</span></div>
                    <DropdownMenu as="div" className="relative shrink-0">
                        <MenuButton className="flex items-center gap-2 rounded-lg p-2 hover:bg-secondary" aria-label="Account menu">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-semibold text-primary">{String(displayName).charAt(0).toUpperCase()}</span>
                            <span className="hidden text-left leading-tight md:block"><span className="block max-w-32 truncate font-semibold">{displayName}</span><span className="text-xs text-muted">{user.role || 'Account'}</span></span><ChevronDown size={14} className="text-muted" />
                        </MenuButton>
                        <MenuItems anchor="bottom end" className="dots-workspace z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg">
                            <div className="border-b border-border px-3 py-2"><p className="truncate font-semibold">{displayName}</p><p className="truncate text-xs text-muted">{user.email}</p><p className="mt-1 text-xs text-muted">{[user.office_display_name, user.range].filter(Boolean).join(' · ')}</p></div>
                            <MenuItem><Link href={route('profile.edit')} className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm data-[focus]:bg-secondary"><UserRound size={16} />My profile</Link></MenuItem>
                            <MenuItem><Link href={route('logout')} method="post" as="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-sm data-[focus]:bg-secondary"><LogOut size={16} />Sign out</Link></MenuItem>
                        </MenuItems>
                    </DropdownMenu>
                </header>
                <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    </div>;
}
