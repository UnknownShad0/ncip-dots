import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WorkspaceDialog from './WorkspaceDialog';

export type WorkspaceAlertVariant = 'success' | 'error' | 'info' | 'confirmation';

const appearances = {
    success: { icon: CheckCircle2, color: 'text-success' },
    error: { icon: AlertCircle, color: 'text-danger' },
    info: { icon: Info, color: 'text-primary' },
    confirmation: { icon: AlertTriangle, color: 'text-warning' },
};

export default function WorkspaceAlert({ title, message, onClose, onConfirm, confirmLabel = 'Continue', isDestructive = false, variant = onConfirm ? 'confirmation' : 'success', toast = false }: {
    title: string; message: string; onClose: () => void; onConfirm?: () => void; confirmLabel?: string; isDestructive?: boolean; variant?: WorkspaceAlertVariant; toast?: boolean;
}) {
    const { icon: Icon, color } = appearances[variant];
    const [fading, setFading] = useState(false);
    const closeHandler = useRef(onClose);

    useEffect(() => {
        closeHandler.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if ((!toast && variant !== 'success') || onConfirm) return;

        setFading(false);
        const fadeTimer = window.setTimeout(() => setFading(true), 5000);
        const dismissTimer = window.setTimeout(() => closeHandler.current(), 5300);

        return () => {
            window.clearTimeout(fadeTimer);
            window.clearTimeout(dismissTimer);
        };
    }, [title, message, variant, onConfirm, toast]);

    // Routine notices never take focus away from the next task.
    if ((toast || variant === 'success') && !onConfirm) {
        return <div className={`dots-dialog fixed right-4 top-4 z-[70] flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-lg border border-border bg-surface p-4 text-foreground shadow-lg transition-opacity duration-300 ${fading ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
            <Icon size={20} className={`mt-0.5 shrink-0 ${color}`} aria-hidden="true" />
            <div role={variant === 'error' ? 'alert' : 'status'} aria-atomic="true" className="min-w-0 flex-1">
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted">{message}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Dismiss notification" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-secondary"><X size={18} /></button>
        </div>;
    }

    return <WorkspaceDialog open onClose={onClose} labelledBy="workspace-alert-title" describedBy="workspace-alert-message" width="max-w-md">
        <div className="flex gap-4 p-6">
            <Icon size={22} className={`mt-1 shrink-0 ${color}`} aria-hidden="true" />
            <div className="min-w-0">
                <h2 id="workspace-alert-title" className="text-lg font-semibold text-foreground">{title}</h2>
                <p id="workspace-alert-message" className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
            </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-background px-6 py-4">
                {onConfirm && <button type="button" autoFocus onClick={onClose} className="dots-button-secondary">Cancel</button>}
                <button type="button" onClick={onConfirm || onClose} className={isDestructive ? 'dots-button bg-danger text-white hover:bg-danger/90' : 'dots-button-primary'}>{onConfirm ? confirmLabel : 'Done'}</button>
        </div>
    </WorkspaceDialog>;
}
