import WorkspaceAlert, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { Mail, Power, Send, Server, ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';

type Props = {
    configured: boolean;
    automatedEnabled: boolean;
    mailer: string;
    host: string | null;
    port: number | string | null;
    sender: string | null;
    missingSettings: string[];
    testRecipient: string | null;
    statusMessage?: string | null;
    errorMessage?: string | null;
};

type AlertState = {
    title: string;
    message: string;
    variant: WorkspaceAlertVariant;
};

function alertFromResponse(statusMessage?: string | null, errorMessage?: string | null): AlertState | null {
    if (errorMessage) {
        return {
            title: errorMessage.toLowerCase().includes('paused') ? 'Email delivery is paused' : 'Test email not sent',
            message: errorMessage,
            variant: errorMessage.toLowerCase().includes('paused') ? 'info' : 'error',
        };
    }

    if (!statusMessage) return null;

    return {
        title: statusMessage.toLowerCase().includes('test email')
            ? 'Test email sent'
            : statusMessage.toLowerCase().includes('paused')
                ? 'Email delivery paused'
                : 'Email delivery updated',
        message: statusMessage,
        variant: 'success',
    };
}

export default function EmailIntegrationIndex({
    configured,
    automatedEnabled,
    mailer,
    host,
    port,
    sender,
    missingSettings,
    testRecipient,
    statusMessage,
    errorMessage,
}: Props) {
    const testForm = useForm({ recipient: testRecipient ?? '' });
    const automationForm = useForm({ enabled: automatedEnabled });
    const [alert, setAlert] = useState<AlertState | null>(() => alertFromResponse(statusMessage, errorMessage));

    const submitTest = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAlert(null);
        testForm.post(route('email-integration.test'), {
            preserveScroll: true,
            onSuccess: (page) => {
                const response = page.props as unknown as Props;
                setAlert(alertFromResponse(response.statusMessage, response.errorMessage));
            },
        });
    };

    const toggleAutomation = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAlert(null);
        automationForm.transform(() => ({ enabled: !automatedEnabled }));
        automationForm.patch(route('email-integration.automation.update'), {
            preserveScroll: true,
            onSuccess: (page) => {
                const response = page.props as unknown as Props;
                setAlert(alertFromResponse(response.statusMessage, response.errorMessage));
            },
        });
    };

    return (
        <AuthenticatedLayout header={
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Email notifications</h1>
                <span
                    role="status"
                    aria-live="polite"
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}
                >
                    <span className={`h-2.5 w-2.5 rounded-full ${configured ? 'bg-emerald-600' : 'bg-amber-600'}`} aria-hidden="true" />
                    {configured ? 'Configured' : 'Needs configuration'}
                </span>
            </div>
        }>
            <Head title="Email notifications" />
            <div className="mx-auto max-w-3xl space-y-5">
                <section className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex items-start gap-4">
                        <span className="rounded-xl bg-secondary p-3 text-primary"><Mail size={22} aria-hidden="true" /></span>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-semibold">Document notification emails</h2>
                            <p className="mt-2 text-sm leading-6 text-muted">
                                DOTS sends routing, approval, registration, and document status notifications through the SMTP account configured on the server.
                                Email messages contain document details and links, but do not attach the document itself.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Server size={17} className={configured ? 'text-emerald-700' : 'text-muted'} aria-hidden="true" />
                            SMTP delivery settings
                        </div>
                        <dl className="mt-3 grid gap-2 pl-6 text-sm sm:grid-cols-[8rem_1fr]">
                            <dt className="text-muted">Mailer</dt><dd className="break-all font-medium">{mailer || '—'}</dd>
                            <dt className="text-muted">Server</dt><dd className="break-all font-medium">{host || '—'}</dd>
                            <dt className="text-muted">Port</dt><dd className="font-medium">{port || '—'}</dd>
                            <dt className="text-muted">From address</dt><dd className="break-all font-medium">{sender || '—'}</dd>
                        </dl>
                        {missingSettings.length > 0 && (
                            <p className="mt-4 pl-6 text-sm text-amber-800">
                                Missing or invalid: <code>{missingSettings.join(', ')}</code>
                            </p>
                        )}
                    </div>

                    <div className="mt-5 rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <ShieldCheck size={17} className="text-primary" aria-hidden="true" />
                            Outlook / Microsoft 365 setup
                        </div>
                        <p className="mt-2 pl-6 text-sm leading-6 text-muted">
                            Set <code>MAIL_MAILER=smtp</code>, <code>MAIL_HOST=smtp.office365.com</code>, <code>MAIL_PORT=587</code>, and add the mailbox username, password, and from address in <code>.env</code>.
                            Then run <code>php artisan config:clear</code>. The mailbox must be allowed to use authenticated SMTP.
                        </p>
                    </div>
                </section>

                <section className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className={`rounded-xl p-3 ${automatedEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-secondary text-muted'}`}>
                                <Power size={20} aria-hidden="true" />
                            </span>
                            <div>
                                <h2 className="text-lg font-semibold">Email delivery</h2>
                                <p className="mt-1 text-sm leading-6 text-muted">
                                    Controls every outgoing email, including document workflows, account setup, verification, password reset, and test messages.
                                </p>
                            </div>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${automatedEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                            {automatedEnabled ? 'Enabled' : 'Paused'}
                        </span>
                    </div>
                    <p className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted">
                        While paused, all outgoing emails are blocked. Queued workflow jobs are safely skipped instead of accumulating for later delivery.
                    </p>
                    <form onSubmit={toggleAutomation} className="mt-4">
                        <button
                            type="submit"
                            disabled={automationForm.processing || (!configured && !automatedEnabled)}
                            className={automatedEnabled
                                ? 'rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50'
                                : 'rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'}
                        >
                            {automationForm.processing
                                ? 'Updating...'
                                : automatedEnabled ? 'Pause email delivery' : 'Enable email delivery'}
                        </button>
                        {!configured && !automatedEnabled && <p className="mt-2 text-sm text-amber-800">Complete the SMTP configuration before enabling email delivery.</p>}
                    </form>
                </section>

                <section className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex items-center gap-2">
                        <Send size={18} className="text-primary" aria-hidden="true" />
                        <h2 className="text-lg font-semibold">Send a test email</h2>
                    </div>
                    <p className="mt-2 text-sm text-muted">Verify the server credentials before relying on workflow notifications.</p>
                    <form onSubmit={submitTest} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                            <label htmlFor="test-recipient" className="sr-only">Test recipient</label>
                            <input
                                id="test-recipient"
                                type="email"
                                required
                                value={testForm.data.recipient}
                                onChange={(event) => testForm.setData('recipient', event.target.value)}
                                placeholder="recipient@example.com"
                                className="w-full rounded-lg border-border bg-background text-foreground focus:border-primary focus:ring-primary"
                            />
                            {testForm.errors.recipient && <p className="mt-1 text-sm text-red-700">{testForm.errors.recipient}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={testForm.processing}
                            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {testForm.processing ? 'Sending...' : 'Send test'}
                        </button>
                    </form>
                    {!automatedEnabled && (
                        <p className="mt-2 text-sm text-amber-800">
                            Email delivery is paused. You can still press Send test to confirm that DOTS blocks the message; no email will leave the system.
                        </p>
                    )}
                </section>
            </div>
            {alert && (
                <WorkspaceAlert
                    toast
                    title={alert.title}
                    message={alert.message}
                    variant={alert.variant}
                    onClose={() => setAlert(null)}
                />
            )}
        </AuthenticatedLayout>
    );
}
