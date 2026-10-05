import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, useState } from 'react';

export default function ResetPassword({ token, email }: { token: string; email: string }) {
    const [showPassword, setShowPassword] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        token,
        email: email ?? '',
        password: '',
        password_confirmation: '',
    });
    const submit: FormEventHandler = (event) => {
        event.preventDefault();
        post(route('password.store'), { onFinish: () => reset('password', 'password_confirmation') });
    };

    return (
        <GuestLayout>
            <Head title="Choose a new password" />
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
            <p className="mt-2 text-sm text-slate-600">Your password must be at least 8 characters long.</p>
            <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                    <InputLabel htmlFor="email" value="Email address" />
                    <TextInput id="email" type="email" name="email" value={data.email} className="mt-1.5 block w-full rounded-lg border-slate-300 py-3 focus:border-teal-700 focus:ring-teal-700" autoComplete="email" required onChange={(event) => setData('email', event.target.value)} />
                    <InputError message={errors.email} className="mt-2" />
                </div>
                <div>
                    <InputLabel htmlFor="password" value="New password" />
                    <div className="relative mt-1.5">
                        <TextInput id="password" type={showPassword ? 'text' : 'password'} name="password" value={data.password} minLength={8} required className="block w-full rounded-lg border-slate-300 py-3 pr-12 focus:border-teal-700 focus:ring-teal-700" autoComplete="new-password" isFocused onChange={(event) => setData('password', event.target.value)} />
                        <button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-700">
                            {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                        </button>
                    </div>
                    <InputError message={errors.password} className="mt-2" />
                </div>
                <div>
                    <InputLabel htmlFor="password_confirmation" value="Confirm new password" />
                    <TextInput id="password_confirmation" type={showPassword ? 'text' : 'password'} name="password_confirmation" value={data.password_confirmation} minLength={8} required className="mt-1.5 block w-full rounded-lg border-slate-300 py-3 focus:border-teal-700 focus:ring-teal-700" autoComplete="new-password" onChange={(event) => setData('password_confirmation', event.target.value)} />
                    <InputError message={errors.password_confirmation} className="mt-2" />
                </div>
                <PrimaryButton type="submit" disabled={processing} className="flex w-full justify-center rounded-lg bg-sky-600 py-3 text-sm tracking-normal hover:bg-sky-700 focus:bg-sky-700 disabled:opacity-60">
                    {processing && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                    {processing ? 'Updating…' : 'Update password'}
                </PrimaryButton>
            </form>
        </GuestLayout>
    );
}
