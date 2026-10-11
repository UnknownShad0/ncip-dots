import { PropsWithChildren } from 'react';
import AuthenticatedLayout from './AuthenticatedLayout';
import LibraryNavigation from '@/Components/LibraryNavigation';
import InfoTip from '@/Components/InfoTip';

export default function LibraryLayout({ children }: PropsWithChildren) {
    return <AuthenticatedLayout header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Libraries</h1>}>
        <div className="mx-auto max-w-[1440px]">
            <div className="no-print mb-4 flex items-center gap-2"><p className="text-sm text-muted">Reference lists for document forms and routing.</p><InfoTip label="About library changes">Changes here affect choices in document forms. Existing records and read-only imported entries retain their current restrictions.</InfoTip></div>
            <LibraryNavigation />
            {children}
        </div>
    </AuthenticatedLayout>;
}
