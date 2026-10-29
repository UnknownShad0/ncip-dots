import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import WorkspaceAlert, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import WorkspaceBusyOverlay from '@/Components/WorkspaceBusyOverlay';
import { Head, router } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';

type NavigationItem = { key: string; name: string };
type NavigationGroup = { label: string; items: NavigationItem[] };
type ManagedRole = {
    id: number;
    name: string;
    defaults: Record<string, boolean>;
    visibility: Record<string, boolean>;
};
type Visibility = Record<string, Record<string, boolean>>;

export default function NavigationAccessIndex({ groups, roles }: { groups: NavigationGroup[]; roles: ManagedRole[] }) {
    const savedVisibility = useMemo<Visibility>(
        () => Object.fromEntries(roles.map((role) => [String(role.id), role.visibility])),
        [roles],
    );
    const [visibility, setVisibility] = useState<Visibility>(savedVisibility);
    const [processing, setProcessing] = useState(false);
    const [feedback, setFeedback] = useState<{ title: string; message: string; variant: WorkspaceAlertVariant } | null>(null);

    useEffect(() => setVisibility(savedVisibility), [savedVisibility]);

    const hasChanges = roles.some((role) => Object.keys(role.visibility).some((key) => (
        visibility[String(role.id)]?.[key] !== role.visibility[key]
    )));

    const setItemVisibility = (roleId: number, key: string, isVisible: boolean) => {
        setVisibility((current) => ({
            ...current,
            [String(roleId)]: {
                ...current[String(roleId)],
                [key]: isVisible,
            },
        }));
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.put(route('navigation-access.update'), { visibility }, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onSuccess: (page) => {
                const resultFlash = (page.props as any).flash ?? {};
                if (resultFlash.success) setFeedback({ title: 'Navigation access updated', message: resultFlash.success, variant: 'success' });
                else if (resultFlash.warning) setFeedback({ title: 'Navigation access needs attention', message: resultFlash.warning, variant: 'warning' });
            },
            onError: (errors) => setFeedback({ title: 'Navigation access could not be saved', message: Object.values(errors).join(' ') || 'Please try again.', variant: 'error' }),
            onFinish: () => setProcessing(false),
        });
    };

    return (
        <AuthenticatedLayout header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Navigation Access Management</h1>}>
            <Head title="Navigation Access Management" />
            <div className="mx-auto max-w-[1200px] space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <p className="max-w-3xl text-sm text-muted">Choose which sections Executive and Admin Staff can access.</p>
                    <button type="button" onClick={() => setVisibility(savedVisibility)} disabled={!hasChanges || processing} className="dots-button-secondary inline-flex items-center gap-2 disabled:opacity-50">
                        <RotateCcw size={16} aria-hidden="true" />Reset changes
                    </button>
                </div>

                <WorkspaceBusyOverlay open={processing} message="Saving navigation access…" />
                {feedback && <WorkspaceAlert {...feedback} busy={processing} onClose={() => setFeedback(null)} />}

                <form onSubmit={submit}>
                    <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                        <p className="border-b border-border bg-background px-5 py-2 text-xs text-muted md:hidden">Swipe horizontally to review every role.</p>
                        <div className="overflow-x-auto" role="region" aria-label="Navigation visibility by role" tabIndex={0}>
                            <table className="min-w-[720px] text-left text-sm">
                                <thead className="bg-background text-muted">
                                    <tr>
                                        <th scope="col" className="sticky left-0 z-10 bg-background px-5 py-3 font-semibold">Navigation item</th>
                                        {roles.map((role) => <th key={role.id} scope="col" className="w-40 px-5 py-3 text-center font-semibold">{role.name}</th>)}
                                    </tr>
                                </thead>
                                {groups.map((group, groupIndex) => (
                                    <tbody key={group.label || `group-${groupIndex}`} className="divide-y divide-border">
                                        {group.label && <tr><th colSpan={roles.length + 1} className="bg-background/70 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted">{group.label}</th></tr>}
                                        {group.items.map((item) => (
                                            <tr key={item.key} className="hover:bg-background/60">
                                                <th scope="row" className="sticky left-0 z-[1] bg-surface px-5 py-3 font-medium text-foreground">{item.name}</th>
                                                {roles.map((role) => {
                                                    const checked = visibility[String(role.id)]?.[item.key] ?? false;
                                                    return <td key={role.id} className="px-5 py-3 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={(event) => setItemVisibility(role.id, item.key, event.target.checked)}
                                                            aria-label={`${item.name} visible to ${role.name}`}
                                                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                                        />
                                                    </td>;
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-5 py-4">
                            <p className="text-sm text-muted">Super Admin always sees the full navigation.</p>
                            <button type="submit" disabled={!hasChanges || processing} className="dots-button-primary inline-flex items-center gap-2 disabled:opacity-50">
                                <Save size={16} aria-hidden="true" />{processing ? 'Saving...' : 'Save changes'}
                            </button>
                        </div>
                    </section>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
