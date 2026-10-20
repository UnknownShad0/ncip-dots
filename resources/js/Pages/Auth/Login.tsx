import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import GuestLayout from '@/Layouts/GuestLayout';
import { Head, Link, useForm } from '@inertiajs/react';
import { Eye, EyeOff } from 'lucide-react';
import { FormEventHandler, useEffect, useRef, useState } from 'react';

type RecaptchaApi = {
    ready: (callback: () => void) => void;
    execute: (siteKey: string, options: { action: string }) => Promise<string>;
    render: (
        container: HTMLElement,
        options: {
            sitekey: string;
            size?: 'invisible' | 'normal' | 'compact';
            callback?: (token: string) => void;
            'expired-callback'?: () => void;
            'error-callback'?: () => void;
        },
    ) => number;
    reset: (widgetId?: number) => void;
};

type LoginValidationErrors = Partial<Record<'recaptcha' | 'recaptcha_v2', string>>;

declare global {
    interface Window {
        grecaptcha?: RecaptchaApi;
    }
}

let recaptchaApiPromise: Promise<RecaptchaApi> | null = null;

function loadRecaptchaApi(siteKey: string): Promise<RecaptchaApi> {
    const waitUntilReady = (api: RecaptchaApi) =>
        new Promise<RecaptchaApi>((resolve) => api.ready(() => resolve(api)));

    if (window.grecaptcha) {
        return waitUntilReady(window.grecaptcha);
    }

    if (!recaptchaApiPromise) {
        recaptchaApiPromise = new Promise<RecaptchaApi>((resolve, reject) => {
            let script = document.querySelector<HTMLScriptElement>('script[data-recaptcha-v3]');

            const handleLoad = () => {
                if (script) script.dataset.loaded = 'true';
                if (window.grecaptcha) {
                    resolve(window.grecaptcha);
                } else {
                    reject(new Error('Google reCAPTCHA did not initialize.'));
                }
            };
            const handleError = () => {
                script?.remove();
                reject(new Error('Google reCAPTCHA could not be loaded.'));
            };

            if (script?.dataset.loaded === 'true' && window.grecaptcha) {
                resolve(window.grecaptcha);
                return;
            }

            if (!script) {
                script = document.createElement('script');
                script.dataset.recaptchaV3 = 'true';
                script.async = true;
                script.defer = true;
                script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
            }

            script.addEventListener('load', handleLoad, { once: true });
            script.addEventListener('error', handleError, { once: true });
            if (!script.isConnected) document.head.appendChild(script);
        })
            .then(waitUntilReady)
            .catch((error: unknown) => {
                recaptchaApiPromise = null;
                throw error;
            });
    }

    return recaptchaApiPromise;
}

export default function Login({
    status,
    canResetPassword,
    recaptcha,
}: {
    status?: string;
    canResetPassword: boolean;
    recaptcha: {
        enabled: boolean;
        v3SiteKey: string;
        v2SiteKey: string;
    };
}) {
    const [showPassword, setShowPassword] = useState(false);
    const [challengeToken, setChallengeToken] = useState<string | null>(null);
    const [recaptchaLoadError, setRecaptchaLoadError] = useState('');
    const [cooldownSeconds, setCooldownSeconds] = useState<number | null>(null);
    const challengeContainer = useRef<HTMLDivElement>(null);
    const challengeWidgetId = useRef<number | null>(null);
    const challengeRequested = useRef(false);
    const { data, setData, post, transform, processing, errors, reset, clearErrors } = useForm({
        username: '',
        password: '',
        remember: false as boolean,
        recaptcha_v3_token: '',
        recaptcha_v2_token: '',
    });
    const recaptchaErrors = errors as typeof errors & LoginValidationErrors;
    const cooldownError = errors.username?.match(/^Too many failed login attempts\. Try again in (\d+) seconds\.$/);
    const cooldownDuration = cooldownError ? Number(cooldownError[1]) : null;
    const cooldownActive = Boolean(cooldownError) && (cooldownSeconds === null || cooldownSeconds > 0);
    const usernameError = cooldownError
        ? cooldownSeconds === 0
            ? 'Cooldown ended. You can try signing in again.'
            : `Too many failed login attempts. Try again in ${cooldownSeconds ?? cooldownError[1]} seconds.`
        : errors.username;

    useEffect(() => {
        if (cooldownDuration === null) {
            setCooldownSeconds(null);
            return;
        }

        const deadline = Date.now() + cooldownDuration * 1000;
        const updateCountdown = () => {
            const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            setCooldownSeconds(remaining);
            if (remaining === 0 && timer !== undefined) window.clearInterval(timer);
        };
        let timer: number | undefined;
        updateCountdown();
        timer = window.setInterval(updateCountdown, 1000);

        return () => {
            if (timer !== undefined) window.clearInterval(timer);
        };
    }, [cooldownDuration]);

    useEffect(() => {
        if (!recaptcha.enabled || !recaptcha.v3SiteKey) return;

        let active = true;
        loadRecaptchaApi(recaptcha.v3SiteKey).catch(() => {
            if (active) setRecaptchaLoadError('Security verification could not load. Check your connection and try again.');
        });

        return () => {
            active = false;
        };
    }, [recaptcha.enabled, recaptcha.v3SiteKey]);

    useEffect(() => {
        if (!recaptcha.enabled || !recaptchaErrors.recaptcha_v2 || !recaptcha.v2SiteKey || !recaptcha.v3SiteKey) return;

        let active = true;
        loadRecaptchaApi(recaptcha.v3SiteKey)
            .then((api) => {
                if (!active || !challengeContainer.current || challengeWidgetId.current !== null) return;

                challengeWidgetId.current = api.render(challengeContainer.current, {
                    sitekey: recaptcha.v2SiteKey,
                    callback: (token) => {
                        setChallengeToken(token);
                        setRecaptchaLoadError('');
                    },
                    'expired-callback': () => setChallengeToken(null),
                    'error-callback': () => setChallengeToken(null),
                });
            })
            .catch(() => {
                if (active) setRecaptchaLoadError('The checkbox could not load. Check your connection and try again.');
            });

        return () => {
            active = false;
        };
    }, [recaptchaErrors.recaptcha_v2, recaptcha.enabled, recaptcha.v2SiteKey, recaptcha.v3SiteKey]);

    const submit: FormEventHandler = async (event) => {
        event.preventDefault();

        if (recaptcha.enabled && (!recaptcha.v3SiteKey || (recaptchaErrors.recaptcha_v2 && !challengeToken))) {
            setRecaptchaLoadError(
                recaptchaErrors.recaptcha_v2
                    ? 'Complete the checkbox before signing in.'
                    : 'Security verification is not configured. Contact your administrator.',
            );
            return;
        }

        setRecaptchaLoadError('');

        try {
            const usingV2 = recaptcha.enabled && Boolean(challengeToken);
            let v3Token = '';

            if (recaptcha.enabled && !usingV2) {
                const api = await loadRecaptchaApi(recaptcha.v3SiteKey);
                v3Token = await api.execute(recaptcha.v3SiteKey, { action: 'login' });
            }

            challengeRequested.current = false;
            transform((form) => ({
                ...form,
                recaptcha_v3_token: v3Token,
                recaptcha_v2_token: usingV2 ? challengeToken : '',
            }));
            post(route('login'), {
                onError: (responseErrors) => {
                    challengeRequested.current = Boolean((responseErrors as typeof errors & LoginValidationErrors).recaptcha_v2);
                },
                onFinish: () => {
                    const keepPassword = challengeRequested.current;
                    challengeRequested.current = false;
                    if (!keepPassword) reset('password');

                    if (usingV2) {
                        setChallengeToken(null);
                        if (challengeWidgetId.current !== null) {
                            window.grecaptcha?.reset(challengeWidgetId.current);
                        }
                    }
                },
            });
        } catch {
            setRecaptchaLoadError('Security verification could not run. Check your connection and try again.');
        }
    };

    return (
        <GuestLayout>
            <Head title="Login" />
            <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">Good day. Please sign in.</h1>

            {status && <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{status}</div>}

            <form onSubmit={submit} className="mt-7 space-y-5">
                <div>
                    <InputLabel htmlFor="username" value="Username" />
                    <TextInput
                        id="username"
                        type="text"
                        name="username"
                        value={data.username}
                        className="mt-1.5 block w-full rounded-lg border-slate-300 py-3 focus:border-teal-700 focus:ring-teal-700"
                        autoComplete="username"
                        autoCapitalize="none"
                        isFocused
                        required
                        onChange={(event) => {
                            clearErrors('username');
                            setCooldownSeconds(null);
                            setData('username', event.target.value);
                        }}
                    />
                    <InputError message={usernameError} className="mt-2" />
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

                {recaptcha.enabled && (
                    <div className="space-y-2" aria-live="polite">
                        <InputError message={recaptchaErrors.recaptcha} />
                        <div
                            className={recaptchaErrors.recaptcha_v2 ? 'rounded-lg border border-slate-200 bg-slate-50 p-4' : 'hidden'}
                            aria-hidden={!recaptchaErrors.recaptcha_v2}
                        >
                            {recaptchaErrors.recaptcha_v2 && <p className="mb-3 text-sm text-slate-700">{recaptchaErrors.recaptcha_v2}</p>}
                            <div ref={challengeContainer} />
                        </div>
                        {recaptchaLoadError && <p role="alert" className="text-sm text-red-700">{recaptchaLoadError}</p>}
                    </div>
                )}

                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={data.remember} onChange={(event) => setData('remember', event.target.checked)} className="rounded border-slate-300 text-teal-700 shadow-sm focus:ring-teal-700" />
                    Remember me
                </label>

                <PrimaryButton type="submit" disabled={processing || cooldownActive} className="!mt-2 flex w-full justify-center rounded-lg bg-sky-600 py-3 text-sm tracking-normal hover:bg-sky-700 focus:bg-sky-700 active:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {processing && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                    {processing ? 'Signing in…' : 'Sign in'}
                </PrimaryButton>
            </form>
        </GuestLayout>
    );
}
