import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import WorkspaceDialog from './WorkspaceDialog';

export type WorkspaceAlertVariant = 'success' | 'error' | 'warning' | 'info' | 'confirmation';

type Props = {
    title: string; message: string; onClose: () => void; onConfirm?: () => void; confirmLabel?: string; isDestructive?: boolean; variant?: WorkspaceAlertVariant; toast?: boolean; centered?: boolean; busy?: boolean;
};

const appearances = {
    success: { icon: CheckCircle2, color: 'text-success', tint: 'from-success/15', blob: 'bg-success/20', badge: 'bg-success/10 ring-success/25', bar: 'bg-success', motion: '' },
    error: { icon: AlertCircle, color: 'text-danger', tint: 'from-danger/15', blob: 'bg-danger/20', badge: 'bg-danger/10 ring-danger/25', bar: 'bg-danger', motion: 'wa-shake' },
    warning: { icon: AlertTriangle, color: 'text-warning', tint: 'from-warning/15', blob: 'bg-warning/20', badge: 'bg-warning/10 ring-warning/25', bar: 'bg-warning', motion: 'wa-float' },
    info: { icon: Info, color: 'text-primary', tint: 'from-primary/15', blob: 'bg-primary/20', badge: 'bg-primary/10 ring-primary/25', bar: 'bg-primary', motion: '' },
    confirmation: { icon: AlertTriangle, color: 'text-warning', tint: 'from-warning/15', blob: 'bg-warning/20', badge: 'bg-warning/10 ring-warning/25', bar: 'bg-warning', motion: 'wa-float' },
};

const confetti = Array.from({ length: 14 }, (_, i) => ({
    angle: i * (360 / 14),
    distance: 62 + (i % 3) * 18,
    color: ['bg-success', 'bg-primary', 'bg-warning'][i % 3],
    delay: (i % 4) * 30,
}));

// Motion only plays when an alert appears (a response to the person's action) and is disabled for reduced-motion users.
const css = `
@keyframes wa-in{from{opacity:0;transform:translateX(28px) scale(.96)}to{opacity:1;transform:none}}
@keyframes wa-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes wa-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.14)}100%{transform:scale(1);opacity:1}}
@keyframes wa-ring{0%{transform:scale(.85);opacity:.7}100%{transform:scale(2);opacity:0}}
@keyframes wa-draw{to{stroke-dashoffset:0}}
@keyframes wa-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
@keyframes wa-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
@keyframes wa-burst{0%{transform:rotate(var(--a)) translateY(0) scale(1);opacity:1}100%{transform:rotate(var(--a)) translateY(calc(var(--d) * -1)) scale(.3);opacity:0}}
@keyframes wa-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.wa-toast{animation:wa-in .35s cubic-bezier(.2,.9,.3,1.2) both}
.wa-rise{animation:wa-rise .4s .12s ease-out both}
.wa-pop{animation:wa-pop .55s .08s cubic-bezier(.2,.9,.3,1.3) both}
.wa-ring{animation:wa-ring 1.1s .2s ease-out 2 both}
.wa-draw{stroke-dasharray:32;stroke-dashoffset:32;animation:wa-draw .45s .35s ease-out forwards}
.wa-shake{animation:wa-shake .5s .4s ease-in-out both}
.wa-float{animation:wa-float 2.4s 1s ease-in-out infinite}
.wa-burst{animation:wa-burst .9s cubic-bezier(.1,.7,.3,1) both}
.wa-bar{transform-origin:left;animation:wa-bar 5s linear forwards}
@media (prefers-reduced-motion:reduce){
  .wa-toast,.wa-rise,.wa-pop,.wa-ring,.wa-shake,.wa-float,.wa-burst,.wa-bar{animation:none!important}
  .wa-draw{animation:none!important;stroke-dashoffset:0}
  .wa-ring,.wa-burst{display:none}
}`;

export default function WorkspaceAlert({ title, message, onClose, onConfirm, confirmLabel = 'Continue', isDestructive = false, variant = onConfirm ? 'confirmation' : 'success', toast = false, centered = false, busy = false }: Props) {
    const { icon: Icon, color, tint, blob, badge, bar, motion } = appearances[variant];
    const [fading, setFading] = useState(false);
    const [paused, setPaused] = useState(false);
    const closeHandler = useRef(onClose);

    useEffect(() => {
        closeHandler.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (busy || !toast || centered || onConfirm || paused) return;

        setFading(false);
        const fadeTimer = window.setTimeout(() => setFading(true), 5000);
        const dismissTimer = window.setTimeout(() => closeHandler.current(), 5300);

        return () => {
            window.clearTimeout(fadeTimer);
            window.clearTimeout(dismissTimer);
        };
    }, [title, message, variant, onConfirm, toast, centered, busy, paused]);

    // Toast placement is opt-in; CRUD results stay centered until dismissed.
    if (busy) return null;
    if (toast && !centered && !onConfirm) {
        return <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className={`dots-dialog wa-toast fixed right-4 top-4 z-[70] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-xl border border-border bg-surface text-foreground shadow-xl transition-opacity duration-300 ${fading ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
            <style>{css}</style>
            <div className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden="true" />
            <div className="flex items-start gap-3 p-4 pl-5">
                <span className={`relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${badge} ${color}`}>
                    <Icon size={20} className="wa-pop" aria-hidden="true" />
                </span>
                <div role={variant === 'error' ? 'alert' : 'status'} aria-atomic="true" className="min-w-0 flex-1 pt-0.5">
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-muted">{message}</p>
                </div>
                <button type="button" onClick={onClose} aria-label="Dismiss notification" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-secondary"><X size={18} /></button>
            </div>
            <div key={String(paused)} className={`wa-bar absolute bottom-0 left-0 h-0.5 w-full ${bar} opacity-60`} style={paused ? { animationPlayState: 'paused', transform: 'scaleX(1)' } : undefined} aria-hidden="true" />
        </div>;
    }

    const isSuccess = variant === 'success' && !onConfirm;

    return <WorkspaceDialog open onClose={onClose} labelledBy="workspace-alert-title" describedBy="workspace-alert-message" width="max-w-md">
        <style>{css}</style>
        <div className={`relative overflow-hidden bg-gradient-to-br ${tint} via-surface to-surface px-6 py-7 sm:px-7`}>
            <div className={`absolute -right-10 -top-12 h-40 w-40 rounded-full ${blob} blur-3xl`} aria-hidden="true" />
            <div className="relative">
                <span className={`relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 shadow-sm ${badge} ${color} ${motion}`}>
                    <span className={`wa-ring absolute inset-0 rounded-2xl ring-2 ring-current opacity-0`} aria-hidden="true" />
                    {isSuccess
                        ? <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9.5" className="wa-pop" style={{ transformOrigin: 'center' }} />
                            <path d="M7.5 12.5l3 3 6-6.5" className="wa-draw" />
                        </svg>
                        : <Icon size={28} className="wa-pop" aria-hidden="true" />}
                    {isSuccess && <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                        {confetti.map((c, i) => (
                            <i key={i} className={`wa-burst absolute h-1.5 w-1.5 rounded-full ${c.color}`} style={{ '--a': `${c.angle}deg`, '--d': `${c.distance}px`, animationDelay: `${0.3 + c.delay / 1000}s` } as CSSProperties} />
                        ))}
                    </span>}
                </span>
                <h2 id="workspace-alert-title" className="wa-rise text-xl font-semibold tracking-tight text-foreground">{title}</h2>
                <p id="workspace-alert-message" className="wa-rise mt-2 text-sm leading-6 text-muted" style={{ animationDelay: '.2s' }}>{message}</p>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border bg-background px-6 py-4 sm:flex sm:justify-end sm:px-7">
            {onConfirm && <button type="button" autoFocus onClick={onClose} className="dots-button-secondary w-full min-h-11 transition-transform active:scale-95 sm:w-auto">Cancel</button>}
            <button type="button" autoFocus={!onConfirm} onClick={onConfirm || onClose} className={`${onConfirm ? '' : 'col-span-2 '}min-h-11 w-full transition-transform hover:-translate-y-px active:scale-95 sm:w-auto ${isDestructive ? 'dots-button bg-danger text-white hover:bg-danger/90' : 'dots-button-primary'}`}>{onConfirm ? confirmLabel : 'Done'}</button>
        </div>
    </WorkspaceDialog>;
}