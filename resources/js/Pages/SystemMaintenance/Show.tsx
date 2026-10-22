import { Head, Link } from '@inertiajs/react';
import { LogOut, Wrench } from 'lucide-react';

export default function SystemMaintenanceShow({ mode, message, endsAt, canManageSystemMaintenance }: {
    mode: 'full' | null;
    message: string;
    endsAt: string | null;
    canManageSystemMaintenance: boolean;
}) {
    const isActive = mode === 'full';

    return (
        <div className="dots-workspace flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
            <Head title={isActive ? 'System Maintenance' : 'Maintenance status'} />
            <main className="w-full max-w-xl rounded-2xl border border-border bg-surface p-8 shadow-lg sm:p-10">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning"><Wrench size={26} aria-hidden="true" /></div>
                <p className="text-sm font-semibold uppercase tracking-wider text-primary">DOTS</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">{isActive ? 'System maintenance' : 'Maintenance is not active'}</h1>
                <p className="mt-4 whitespace-pre-line text-base leading-7 text-muted">{isActive ? message : 'Maintenance is currently off. You can return to the application.'}</p>
                {isActive && endsAt && <p className="mt-5 rounded-lg bg-background p-3 text-sm">Expected to end <strong>{endsAt}</strong>.</p>}

                {canManageSystemMaintenance && <p className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground">Super Admin access remains available while maintenance is active.</p>}

                <div className="mt-8 flex flex-wrap gap-3">
                    {canManageSystemMaintenance
                        ? <Link href={route('system-maintenance.index')} className="dots-button-primary">Manage maintenance</Link>
                        : isActive
                            ? <Link href={route('logout')} method="post" as="button" className="dots-button-secondary inline-flex items-center gap-2"><LogOut size={16} aria-hidden="true" />Sign out</Link>
                            : <Link href={route('dashboard')} className="dots-button-primary">Return to the system</Link>}
                </div>
            </main>
        </div>
    );
}
