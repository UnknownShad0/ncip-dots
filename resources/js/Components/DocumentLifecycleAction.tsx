import WorkspaceDialog from '@/Components/WorkspaceDialog';
import { router } from '@inertiajs/react';
import { Archive, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function DocumentLifecycleAction({ action, url, title, iconOnly = false }: {
    action: 'delete' | 'archive' | 'restore'; url: string; title: string; iconOnly?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const label = action === 'delete' ? 'Delete draft' : action === 'archive' ? 'Archive document' : 'Restore document';
    const Icon = action === 'delete' ? Trash2 : action === 'archive' ? Archive : RotateCcw;
    const confirm = () => {
        setError('');
        router.visit(url, {
            method: action === 'delete' ? 'delete' : 'post', preserveScroll: true,
            onStart: () => setBusy(true), onFinish: () => setBusy(false),
            onSuccess: () => setOpen(false),
            onError: () => setError('The action could not be completed. Please try again.'),
        });
    };
    return <>
        <button type="button" title={label} aria-label={`${label}: ${title}`} onClick={() => setOpen(true)} className={`inline-flex items-center gap-2 rounded-lg border border-border p-2.5 text-sm font-semibold hover:bg-background ${action === 'delete' ? 'text-danger' : action === 'archive' ? 'text-warning' : 'text-primary'}`}>
            <Icon size={16} aria-hidden="true" />{!iconOnly && (action === 'archive' ? 'Archive' : action === 'restore' ? 'Restore' : 'Delete')}
        </button>
        <WorkspaceDialog open={open} onClose={() => setOpen(false)} labelledBy={`lifecycle-${action}-${url.replace(/\W/g, '')}`} width="max-w-md" busy={busy}>
            <div className="space-y-4 p-6">
                <h2 id={`lifecycle-${action}-${url.replace(/\W/g, '')}`} className="text-lg font-semibold">{label}?</h2>
                <p className="break-words text-sm text-muted">{title || 'Untitled document'}</p>
                <p className="text-sm text-muted">{action === 'delete' ? 'This draft will be removed from your drafts list.' : action === 'archive' ? 'This document will move to Archives. Its contents and history will be preserved.' : 'This document will return to its active workflow.'}</p>
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <button type="button" className="dots-button-secondary w-full sm:w-auto" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
                    <button type="button" className="dots-button-primary w-full sm:w-auto" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : label}</button>
                </div>
            </div>
        </WorkspaceDialog>
    </>;
}
