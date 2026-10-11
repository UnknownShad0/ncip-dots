import { PropsWithChildren } from 'react';
import AuthenticatedLayout from './AuthenticatedLayout';
import ConnectedSystemNavigation from '@/Components/ConnectedSystemNavigation';
import InfoTip from '@/Components/InfoTip';

export default function ConnectedSystemsLayout({children}: PropsWithChildren) {
    return <AuthenticatedLayout header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Connected systems</h1>}>
        <div className="mx-auto max-w-[1440px]">
            <div className="no-print mb-4 flex items-center gap-2"><p className="text-sm text-muted">Documents shared by external systems.</p><InfoTip label="About connected systems">These are read-only summaries. Changes and signing actions are managed in the source system. An empty list can mean no shared records or an unavailable connection; connection status is not reported here.</InfoTip></div>
            <ConnectedSystemNavigation />{children}
        </div>
    </AuthenticatedLayout>;
}
