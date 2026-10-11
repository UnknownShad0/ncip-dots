import ConnectedSystemsLayout from '@/Layouts/ConnectedSystemsLayout';
import { Head } from '@inertiajs/react';
export default function ConnectedSystemsIndex() {
    return <ConnectedSystemsLayout><Head title="Connected systems" /><section className="rounded-xl border border-dashed border-border bg-surface p-8 text-center"><h2 className="text-lg font-semibold">Choose a connected system</h2><p className="mt-2 text-sm text-muted">Open a system above to browse its shared documents and signing history.</p></section></ConnectedSystemsLayout>;
}
