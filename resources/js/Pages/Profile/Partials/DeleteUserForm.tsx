import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import WorkspaceAlert, { type WorkspaceAlertVariant } from '@/Components/WorkspaceAlert';
import WorkspaceDialog from '@/Components/WorkspaceDialog';
import { useForm } from '@inertiajs/react';
import { AlertTriangle, LoaderCircle, ShieldAlert, Trash2 } from 'lucide-react';
import { FormEventHandler, useRef, useState } from 'react';

export default function DeleteUserForm({
    className = '',
}: {
    className?: string;
}) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const [feedback, setFeedback] = useState<{ title: string; message: string; variant: WorkspaceAlertVariant } | null>(null);
    const passwordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route('profile.destroy'), {
            preserveScroll: true,
            onSuccess: () => {
                closeModal();
                setFeedback({ title: 'Account deleted', message: 'Your account was deleted successfully.', variant: 'success' });
            },
            onError: (errors) => {
                passwordInput.current?.focus();
                setFeedback({ title: 'Account could not be deleted', message: Object.values(errors).join(' ') || 'Check your password and try again.', variant: 'error' });
            },
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>
            <section className="overflow-hidden rounded-2xl border border-danger/25 bg-gradient-to-br from-danger-soft/70 via-surface to-surface shadow-sm">
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger ring-1 ring-danger/15">
                            <ShieldAlert size={23} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-foreground">Delete account</h2>
                                <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-danger">Permanent</span>
                            </div>
                            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
                                Deleting your account permanently removes its resources and data. Download anything you want to keep before continuing.
                            </p>
                        </div>
                    </div>
                    <DangerButton onClick={confirmUserDeletion} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 shadow-sm transition hover:-translate-y-0.5">
                        <Trash2 size={16} aria-hidden="true" /> Delete account
                    </DangerButton>
                </div>
            </section>

            <WorkspaceDialog
                open={confirmingUserDeletion}
                onClose={closeModal}
                labelledBy="delete-account-title"
                describedBy="delete-account-description"
                width="max-w-lg"
                busy={processing}
                busyMessage="Deleting your account…"
            >
                <form onSubmit={deleteUser}>
                    <div className="border-b border-danger/15 bg-danger-soft/40 px-5 py-5 sm:px-6">
                        <div className="flex items-start gap-4">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                                <AlertTriangle size={22} aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">Account deletion</p>
                                <h2 id="delete-account-title" className="mt-1 text-xl font-semibold text-foreground">This action can’t be undone</h2>
                                <p id="delete-account-description" className="mt-2 text-sm leading-6 text-muted">
                                    Your account and associated data will be permanently removed. Enter your password to confirm.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 px-5 py-5 sm:px-6">
                        <InputLabel htmlFor="password" value="Current password" />
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(event) => setData('password', event.target.value)}
                            className="block w-full"
                            isFocused
                            autoComplete="current-password"
                            placeholder="Enter your password"
                            disabled={processing}
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 border-t border-border bg-background px-5 py-4 sm:px-6">
                        <SecondaryButton type="button" onClick={closeModal} disabled={processing} className="min-h-11 justify-center rounded-xl">
                            Keep account
                        </SecondaryButton>
                        <DangerButton type="submit" disabled={processing} aria-busy={processing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl">
                            {processing ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
                            {processing ? 'Deleting…' : 'Delete permanently'}
                        </DangerButton>
                    </div>
                </form>
            </WorkspaceDialog>
            {feedback && <WorkspaceAlert {...feedback} busy={processing} onClose={() => setFeedback(null)} />}
        </section>
    );
}
