import LibraryLayout from '@/Layouts/LibraryLayout';
import { Head } from '@inertiajs/react';

export default function SetupIndex() {
    return <LibraryLayout>
        <Head title="Libraries" />
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
            <h2 className="text-lg font-semibold text-foreground">Choose a library to manage</h2>
            <p className="mt-2 text-sm text-muted">Open a list above to search entries, add records, or update details.</p>
        </div>
    </LibraryLayout>;
}
