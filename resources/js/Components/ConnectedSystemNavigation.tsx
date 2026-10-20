import { Link } from '@inertiajs/react';
import { ChevronRight, Database, FileSignature, Share2 } from 'lucide-react';

export const connectedSystems = [
    { name: 'PDMIS', href: 'pdmis.index', description: 'Shared documents and signing details.', icon: Database },
    { name: 'DRIP', href: 'drip.index', description: 'Shared records and document status.', icon: Share2 },
    { name: 'iPluma', href: 'ipluma.index', description: 'Signature progress and signer activity.', icon: FileSignature },
];

export default function ConnectedSystemNavigation() {
    const isDirectory = !connectedSystems.some(({ href }) => route().current(href));
    return <nav aria-label="Connected systems" className={isDirectory ? 'no-print divide-y divide-border rounded-lg border border-border bg-surface' : 'no-print mb-5 flex flex-wrap gap-1 border-b border-border pb-3'}>
        {connectedSystems.map(({name, href, description, icon: Icon}) => {
            const active = route().current(href);
            return <Link key={href} href={route(href)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-md transition-colors ${isDirectory ? 'p-5 hover:bg-background' : `px-3 py-2 text-sm ${active ? 'bg-secondary font-semibold text-primary' : 'text-muted hover:bg-surface hover:text-foreground'}`}`}>
                {isDirectory && <Icon size={20} className="shrink-0 text-primary" aria-hidden="true" />}
                <span className="min-w-0 flex-1"><span className={isDirectory ? 'block font-semibold text-foreground' : ''}>{name}</span>{isDirectory && <span className="mt-1 block text-sm text-muted">{description}</span>}</span>
                {isDirectory && <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />}
            </Link>;
        })}
    </nav>;
}
