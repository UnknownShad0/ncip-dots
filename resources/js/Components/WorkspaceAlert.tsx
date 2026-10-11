import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import WorkspaceDialog from './WorkspaceDialog';

export default function WorkspaceAlert({ title, message, onClose, onConfirm, confirmLabel = 'Continue', isDestructive = false }: {
    title: string; message: string; onClose: () => void; onConfirm?: () => void; confirmLabel?: string; isDestructive?: boolean;
}) {
    return <WorkspaceDialog open onClose={onClose} labelledBy="workspace-alert-title" describedBy="workspace-alert-message" width="max-w-md">
        <div className="flex gap-4 p-6">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${onConfirm ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`} aria-hidden="true">{onConfirm ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}</div>
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
