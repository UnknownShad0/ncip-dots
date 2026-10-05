import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

export default function Login({
    status,
    canResetPassword,
}: {
    status?: string;
    canResetPassword: boolean;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false as boolean,
    });

    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        post(route('login'), { onFinish: () => reset('password') });
    };

    return (
        <GuestLayout>
            <Head title="Login" />
            <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Good day. Please sign in.</h1>
            {/* <p className="mt-2 text-sm text-slate-600">Use your DOTS username or registered email.</p> */}

            {status && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</div>}

            <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                    <InputLabel htmlFor="email" value="Username or email" />
                    <TextInput
                        id="email"
                        type="text"
                        name="email"
                        value={data.email}
                        className="mt-1.5 block w-full rounded-lg border-slate-300 py-3 focus:border-teal-700 focus:ring-teal-700"
                        autoComplete="username"
                        autoCapitalize="none"
                        isFocused
                        required
                        onChange={(event) => setData('email', event.target.value)}
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <InputLabel htmlFor="password" value="Password" />
                        {canResetPassword && <Link href={route('password.request')} className="text-sm font-medium text-teal-800 underline-offset-4 hover:underline">Forgot password?</Link>}
                    </div>
                    <div className="relative mt-1.5">
                        <TextInput
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            value={data.password}
                            className="block w-full rounded-lg border-slate-300 py-3 pr-12 focus:border-teal-700 focus:ring-teal-700"
                            autoComplete="current-password"
                            required
                            onChange={(event) => setData('password', event.target.value)}
                        />
                        <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-700">
                            {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                        </button>
                    </div>
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={data.remember} onChange={(event) => setData('remember', event.target.checked)} className="rounded border-slate-300 text-teal-700 shadow-sm focus:ring-teal-700" />
                    Remember me
                </label>

                <PrimaryButton type="submit" disabled={processing} className="!mt-2 flex w-full justify-center rounded-lg bg-sky-600 py-3 text-sm tracking-normal hover:bg-sky-700 focus:bg-sky-700 active:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {processing && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                    {processing ? 'Signing in…' : 'Sign in'}
                </PrimaryButton>
            </form>
        </GuestLayout>
    );
}
