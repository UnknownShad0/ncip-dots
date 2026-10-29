import { createPortal } from 'react-dom';

export default function WorkspaceBusyOverlay({ open, message = 'Please wait…' }: { open: boolean; message?: string }) {
    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/40 p-6 backdrop-blur-[2px]" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/90 px-6 py-5 text-center shadow-lg ring-1 ring-black/5">
                <div className="relative h-10 w-10" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                    <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary motion-reduce:animate-pulse" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{message}</span>
            </div>
        </div>,
        document.body,
    );
}
