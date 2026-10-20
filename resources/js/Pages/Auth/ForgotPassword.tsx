import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({ username: '' });
    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Forgot password" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reset your password</h1>
            <p className="mt-2 text-sm leading-6 text-muted">Enter your username. If it matches an account, we will send a reset link.</p>
            {status && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-900">{status}</div>}
            <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                    <InputLabel htmlFor="username" value="Username" />
                    <TextInput id="username" type="text" name="username" value={data.username} className="mt-1.5 block w-full rounded-lg border-border py-3 focus:border-primary focus:ring-primary" autoComplete="username" autoCapitalize="none" required isFocused onChange={(event) => setData('username', event.target.value)} />
                    <InputError message={errors.username} className="mt-2" />
                </div>
                <PrimaryButton type="submit" disabled={processing} className="flex w-full justify-center rounded-lg py-3 text-sm tracking-normal !bg-accent !text-accent-foreground hover:!bg-accent-hover focus:!bg-accent-hover disabled:opacity-60">
                    {processing && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                    {processing ? 'Sending...' : 'Send reset link'}
                </PrimaryButton>
            </form>
            <Link href={route('login')} className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Back to sign in</Link>
        </GuestLayout>
    );
}
