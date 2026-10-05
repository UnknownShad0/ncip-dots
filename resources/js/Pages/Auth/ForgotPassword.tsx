import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { FormEventHandler } from 'react';

export default function ForgotPassword({ status }: { status?: string }) {
    const { data, setData, post, processing, errors } = useForm({ email: '' });
    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        post(route('password.email'));
    };

    return (
        <GuestLayout>
            <Head title="Forgot password" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reset your password</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enter the email address registered to your account. If it matches an account, we’ll send a reset link.</p>
            {status && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-5 text-emerald-900">{status}</div>}
            <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                    <InputLabel htmlFor="email" value="Registered email address" />
                    <TextInput id="email" type="email" name="email" value={data.email} className="mt-1.5 block w-full rounded-lg border-slate-300 py-3 focus:border-teal-700 focus:ring-teal-700" autoComplete="email" autoCapitalize="none" required isFocused onChange={(event) => setData('email', event.target.value)} />
                    <InputError message={errors.email} className="mt-2" />
                </div>
                <PrimaryButton type="submit" disabled={processing} className="flex w-full justify-center rounded-lg bg-sky-600 py-3 text-sm tracking-normal hover:bg-sky-700 focus:bg-sky-700 disabled:opacity-60">
                    {processing && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                    {processing ? 'Sending…' : 'Send reset link'}
                </PrimaryButton>
            </form>
            <Link href={route('login')} className="mt-5 inline-block text-sm font-medium text-teal-800 underline-offset-4 hover:underline">Back to sign in</Link>
        </GuestLayout>
    );
}
