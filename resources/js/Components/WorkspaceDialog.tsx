import { Dialog, DialogPanel } from '@headlessui/react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { PropsWithChildren } from 'react';

export default function WorkspaceDialog({ open, onClose, labelledBy, describedBy, children, width = 'max-w-2xl', busy = false, busyMessage }: PropsWithChildren<{
    open: boolean; onClose: () => void; labelledBy: string; describedBy?: string; width?: string; busy?: boolean; busyMessage?: string;
}>) {
    const reduced = useReducedMotion();
    const busyOverlay = busy && busyMessage && typeof document !== 'undefined'
        ? createPortal(<div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/40 p-6 backdrop-blur-[2px]" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/90 px-6 py-5 text-center shadow-lg ring-1 ring-black/5">
                <div className="relative h-10 w-10" aria-hidden="true">
                    <span className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                    <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary motion-reduce:animate-pulse" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{busyMessage}</span>
            </div>
        </div>, document.body)
        : null;
    return <MotionConfig transition={{duration: reduced ? 0 : .18}}><AnimatePresence>{open && <Dialog static open={open} onClose={() => { if (!busy) onClose(); }} aria-labelledby={labelledBy} aria-describedby={describedBy} className="relative z-[60]">
        <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: reduced ? 0 : .16}} className="fixed inset-0 bg-foreground/40" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6"><div className="flex min-h-full items-center justify-center">
            <DialogPanel as={motion.div} initial={{opacity: 0, y: reduced ? 0 : 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: reduced ? 0 : 8}} className={`dots-dialog w-full ${width} max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-xl border border-border bg-surface text-foreground shadow-xl`}>
                {children}
            </DialogPanel>
        </div></div>
    </Dialog>}</AnimatePresence>{open && busyOverlay}</MotionConfig>;
}
