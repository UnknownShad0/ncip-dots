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
                className="w-full max-w-md rounded-2xl border border-[#e2e2df] bg-white p-6 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${isConfirmation ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                        {isConfirmation ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                            <h2 id="crud-alert-title" className="text-lg font-semibold text-[#171717]">{title}</h2>
                            <button type="button" onClick={onClose} aria-label="Close alert" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                                <X size={18} />
                            </button>
                        </div>
                        <p id="crud-alert-message" className="mt-2 text-sm leading-6 text-[#666660]">{message}</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                    {isConfirmation && <button type="button" onClick={onClose} className="rounded-lg border border-[#deded9] px-4 py-2 text-sm font-medium text-[#444] hover:bg-[#f6f6f3]">Cancel</button>}
                    <button
                        type="button"
                        onClick={isConfirmation ? onConfirm : onClose}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${isDestructive ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isConfirmation ? confirmLabel : 'Done'}
                    </button>
                </div>
            </div>
        </div>
    );
}