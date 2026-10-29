import { Dialog, DialogPanel } from '@headlessui/react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { PropsWithChildren } from 'react';
import WorkspaceBusyOverlay from './WorkspaceBusyOverlay';

export default function WorkspaceDialog({ open, onClose, labelledBy, describedBy, children, width = 'max-w-2xl', busy = false, busyMessage }: PropsWithChildren<{
    open: boolean; onClose: () => void; labelledBy: string; describedBy?: string; width?: string; busy?: boolean; busyMessage?: string;
}>) {
    const reduced = useReducedMotion();
    return <MotionConfig transition={{duration: reduced ? 0 : .18}}><AnimatePresence>{open && <Dialog static open={open} onClose={() => { if (!busy) onClose(); }} aria-labelledby={labelledBy} aria-describedby={describedBy} className="relative z-[60]">
        <motion.div initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: reduced ? 0 : .16}} className="fixed inset-0 bg-foreground/40" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6"><div className="flex min-h-full items-center justify-center">
            <DialogPanel as={motion.div} initial={{opacity: 0, y: reduced ? 0 : 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: reduced ? 0 : 8}} className={`dots-dialog w-full ${width} max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-xl border border-border bg-surface text-foreground shadow-xl`}>
                {children}
            </DialogPanel>
        </div></div>
    </Dialog>}</AnimatePresence>{open && <WorkspaceBusyOverlay open={busy} message={busyMessage} />}</MotionConfig>;
}
