import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import WorkspaceAlert, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import WorkspaceBusyOverlay from '@/Components/WorkspaceBusyOverlay';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useEffect, useState } from 'react';
import { Save, Wrench } from 'lucide-react';

type MaintenanceSettings = {
    mode: 'off' | 'notice' | 'full';
    effectiveMode: 'notice' | 'full' | null;
    status: 'off' | 'scheduled' | 'active' | 'ended';
    message: string;
    startsAt: string | null;
    endsAt: string | null;
    startsAtLabel: string | null;
    endsAtLabel: string | null;
    updatedAtLabel: string | null;
    updatedBy: string | null;
};

const modes = [
    { value: 'off', label: 'Off', description: 'The system works normally.' },
    { value: 'notice', label: 'Notice only', description: 'Show a notice while everyone continues working.' },
    { value: 'full', label: 'Full maintenance', description: 'Block regular users from protected pages and actions.' },
] as const;

export default function SystemMaintenanceIndex({ settings, timezone }: { settings: MaintenanceSettings; timezone: string }) {
    const { flash } = usePage().props as any;
    const [feedback, setFeedback] = useState<{ title: string; message: string; variant: WorkspaceAlertVariant } | null>(null);
    const form = useForm({
        mode: settings.mode,
        message: settings.message,
        starts_at: settings.startsAt ?? '',
        ends_at: settings.endsAt ?? '',
        reason: '',
    });

    useEffect(() => {
        form.setData({
            mode: settings.mode,
            message: settings.message,
            starts_at: settings.startsAt ?? '',
            ends_at: settings.endsAt ?? '',
            reason: '',
        });
    }, [settings]);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (form.data.mode === 'full' && !window.confirm([
            'Enable full maintenance?',
            '',
            `Message: ${form.data.message}`,
            `Start: ${form.data.starts_at || 'Immediately'}`,
            `End: ${form.data.ends_at || 'Until manually turned off'}`,
            '',
            'Executive and Admin Staff will be sent to the maintenance page.',
        ].join('\n'))) return;

        form.put(route('system-maintenance.update'), {
            preserveScroll: true,
            onError: (errors) => setFeedback({ title: 'Maintenance settings could not be saved', message: Object.values(errors).join(' ') || 'Please review the settings and try again.', variant: 'error' }),
        });
    };

    useEffect(() => {
        if (flash?.success) setFeedback({ title: 'Maintenance settings saved', message: flash.success, variant: 'success' });
        else if (flash?.warning) setFeedback({ title: 'Maintenance settings need attention', message: flash.warning, variant: 'warning' });
    }, [flash?.success, flash?.warning]);

    const statusText = {
        off: 'Off',
        scheduled: 'Scheduled',
        active: settings.effectiveMode === 'full' ? 'Full maintenance is active' : 'Notice is active',
        ended: 'Schedule ended',
    }[settings.status];

    return (
        <AuthenticatedLayout header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">System Maintenance</h1>}>
            <Head title="System Maintenance" />
            <div className="mx-auto max-w-[1000px] space-y-5">
                <p className="max-w-3xl text-sm text-muted">Post a maintenance notice or temporarily restrict regular system access.</p>

                <WorkspaceBusyOverlay open={form.processing} message="Saving maintenance settings…" />
                {feedback && <WorkspaceAlert {...feedback} busy={form.processing} onClose={() => setFeedback(null)} />}

                <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${settings.status === 'active' ? 'bg-warning-soft text-warning' : settings.status === 'scheduled' ? 'bg-primary/10 text-primary' : 'bg-background text-muted'}`}><Wrench size={19} aria-hidden="true" /></span>
                        <div><p className="text-sm font-semibold">Current status</p><p className="text-sm text-muted">{statusText}</p></div>
                    </div>
                    <p className="text-xs text-muted">Times use {timezone}.</p>
                </section>

                <form onSubmit={submit} className="space-y-5">
                    <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                        <fieldset>
                            <legend className="text-base font-semibold">Mode</legend>
                            <p className="mb-4 mt-1 text-sm text-muted">Choose what users experience while maintenance is active.</p>
                            <div className="grid gap-3 md:grid-cols-3">
                                {modes.map((mode) => <label key={mode.value} className={`cursor-pointer rounded-xl border p-4 transition ${form.data.mode === mode.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-background'}`}>
                                    <span className="flex items-start gap-3">
                                        <input type="radio" name="mode" value={mode.value} checked={form.data.mode === mode.value} onChange={() => form.setData('mode', mode.value)} className="mt-1 h-4 w-4 border-border text-primary focus:ring-primary" />
                                        <span><span className="block font-semibold">{mode.label}</span><span className="mt-1 block text-sm text-muted">{mode.description}</span></span>
                                    </span>
                                </label>)}
                            </div>
                            {form.errors.mode && <p className="mt-2 text-sm text-danger">{form.errors.mode}</p>}
                        </fieldset>
                    </section>

                    <section className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
                        <div>
                            <label htmlFor="maintenance-message" className="block text-base font-semibold">Maintenance message</label>
                            <p className="mb-2 mt-1 text-sm text-muted">Shown in the notice banner or on the full maintenance page.</p>
                            <textarea id="maintenance-message" rows={3} maxLength={1000} required value={form.data.message} onChange={(event) => form.setData('message', event.target.value)} className="w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" />
                            {form.errors.message && <p className="mt-1 text-sm text-danger">{form.errors.message}</p>}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label htmlFor="maintenance-start" className="mb-1 block text-sm font-semibold">Start time <span className="font-normal text-muted">(optional)</span></label>
                                <input id="maintenance-start" type="datetime-local" value={form.data.starts_at} onChange={(event) => form.setData('starts_at', event.target.value)} className="w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" />
                                {form.errors.starts_at && <p className="mt-1 text-sm text-danger">{form.errors.starts_at}</p>}
                            </div>
                            <div>
                                <label htmlFor="maintenance-end" className="mb-1 block text-sm font-semibold">End time <span className="font-normal text-muted">(optional)</span></label>
                                <input id="maintenance-end" type="datetime-local" value={form.data.ends_at} onChange={(event) => form.setData('ends_at', event.target.value)} className="w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" />
                                {form.errors.ends_at && <p className="mt-1 text-sm text-danger">{form.errors.ends_at}</p>}
                            </div>
                        </div>
                        <p className="text-xs text-muted">When an end time passes, the notice or access restriction ends automatically.</p>
                    </section>

                    <section className="space-y-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
                        <div>
                            <label htmlFor="maintenance-reason" className="block text-sm font-semibold">Change reason <span className="font-normal text-muted">(optional, recorded in Audit Trails)</span></label>
                            <input id="maintenance-reason" type="text" maxLength={300} value={form.data.reason} onChange={(event) => form.setData('reason', event.target.value)} className="mt-2 w-full rounded-lg border-border bg-background text-sm focus:border-primary focus:ring-primary" />
                        </div>
                        {settings.updatedAtLabel && <p className="text-xs text-muted">Last changed {settings.updatedAtLabel}{settings.updatedBy ? ` by ${settings.updatedBy}` : ''}.</p>}
                        <div className="flex justify-end border-t border-border pt-4">
                            <button type="submit" disabled={form.processing} className="dots-button-primary inline-flex items-center gap-2 disabled:opacity-50"><Save size={16} aria-hidden="true" />{form.processing ? 'Saving...' : 'Save changes'}</button>
                        </div>
                    </section>
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
