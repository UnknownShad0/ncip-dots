import { AlertTriangle, CheckCircle2, X } from 'lucide-react';

type CrudAlertModalProps = {
    title: string;
    message: string;
    onClose: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    isDestructive?: boolean;
};

export default function CrudAlertModal({
    title,
    message,
    onClose,
    onConfirm,
    confirmLabel = 'Continue',
    isDestructive = false,
}: CrudAlertModalProps) {
    const isConfirmation = Boolean(onConfirm);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="crud-alert-title"
                aria-describedby="crud-alert-message"
                className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isConfirmation ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
                        {isConfirmation ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="crud-alert-title" className="text-lg font-semibold text-foreground">{title}</h2>
                            <button type="button" onClick={onClose} aria-label="Close alert" className="rounded-md p-1 text-muted hover:bg-secondary hover:text-foreground">
                                <X size={18} />
                            </button>
                        </div>
                        <p id="crud-alert-message" className="mt-2 text-sm leading-6 text-muted">{message}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    {isConfirmation && <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-background">Cancel</button>}
                    <button
                        type="button"
                        onClick={isConfirmation ? onConfirm : onClose}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${isDestructive ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover'}`}
                    >
                        {isConfirmation ? confirmLabel : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    );
}
