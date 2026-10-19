import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm } from '@inertiajs/react';
import { Mail, ShieldCheck } from 'lucide-react';

type Props = {
    oauthConfigured: boolean;
    redirectUri: string;
    connected: boolean;
    connectedEmail: string | null;
    statusMessage?: string | null;
    errorMessage?: string | null;
};

export default function GmailIntegrationIndex({
    oauthConfigured,
    redirectUri,
    connected,
    connectedEmail,
    statusMessage,
    errorMessage,
}: Props) {
    const disconnectForm = useForm();

    return (
        <AuthenticatedLayout header={
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Gmail notifications</h1>
                <span
                    role="status"
                    aria-live="polite"
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}
                >
                    <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-600' : 'bg-amber-600'}`} aria-hidden="true" />
                    {connected ? `Connected${connectedEmail ? ` · ${connectedEmail}` : ''}` : 'Not connected'}
                </span>
            </div>
        }>
            <Head title="Gmail notifications" />
            <div className="mx-auto max-w-3xl space-y-5">
                {statusMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{statusMessage}</div>}
                {errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{errorMessage}</div>}

                <section className="rounded-xl border border-border bg-surface p-6">
                    <div className="flex items-start gap-4">
                        <span className="rounded-xl bg-secondary p-3 text-primary"><Mail size={22} aria-hidden="true" /></span>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-semibold">Document status emails</h2>
                            <p className="mt-2 text-sm leading-6 text-muted">
                                Send approval decisions and registration updates to the document creator’s email address in their user account.
                                Email contains the document title, status, remarks, and a link back to DOTS; it does not include document contents.
                            </p>
                            <p className="mt-2 text-sm leading-6 text-muted">
                                When a document is submitted, active approvers in its selected office receive an approval email.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 rounded-lg border border-border bg-background p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <ShieldCheck size={17} className={connected ? 'text-emerald-700' : 'text-muted'} aria-hidden="true" />
                            {connected ? 'Connected sender' : 'No Gmail sender connected'}
                        </div>
                        {connected && connectedEmail && <p className="mt-1 pl-6 text-sm text-muted">{connectedEmail}</p>}
                        {!oauthConfigured && (
                            <p className="mt-2 pl-6 text-sm text-muted">
                                Add <code>GMAIL_CLIENT_ID</code> and <code>GMAIL_CLIENT_SECRET</code> to your local <code>.env</code>, then run <code>php artisan config:clear</code>.
                            </p>
                        )}
                        <p className="mt-3 pl-6 text-sm text-muted">
                            In Google Cloud, enable the Gmail API and add this exact authorized redirect URI to a Web application OAuth client:
                        </p>
                        <code className="mt-1 block break-all pl-6 text-xs text-foreground">{redirectUri}</code>
                        <p className="mt-2 pl-6 text-sm text-muted">
                            Authorize the dedicated sender mailbox with <code>gmail.send</code> access. For an External app in Testing mode, add that mailbox as a test user.
                        </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                        {!connected && (oauthConfigured ? (
                            <a
                                href={route('gmail-integration.connect')}
                                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                            >
                                Connect Gmail sender
                            </a>
                        ) : (
                            <button type="button" disabled className="cursor-not-allowed rounded-lg bg-secondary px-4 py-2.5 text-sm font-semibold text-muted">
                                Configure Gmail OAuth first
                            </button>
                        ))}
                        {connected && (
                            <form onSubmit={(event) => {
                                event.preventDefault();
                                disconnectForm.post(route('gmail-integration.disconnect'));
                            }}>
                                <button
                                    type="submit"
                                    disabled={disconnectForm.processing}
                                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                                >
                                    {disconnectForm.processing ? 'Disconnecting...' : 'Disconnect sender'}
                                </button>
                            </form>
                        )}
                    </div>
                </section>
            </div>
        </AuthenticatedLayout>
    );
}
