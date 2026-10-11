import { Link } from '@inertiajs/react';
import { ArrowUpRight, Database, FileSignature, Share2 } from 'lucide-react';

export const connectedSystems = [
    { name: 'PDMIS', href: 'pdmis.index', description: 'Shared documents and signing details.', icon: Database },
    { name: 'DRIP', href: 'drip.index', description: 'Shared records and document status.', icon: Share2 },
    { name: 'iPluma', href: 'ipluma.index', description: 'Signature progress and signer activity.', icon: FileSignature },
];

export default function ConnectedSystemNavigation() {
    return <nav aria-label="Connected systems" className="no-print mb-6 grid gap-3 sm:grid-cols-3">
        {connectedSystems.map(({name, href, description, icon: Icon}) => {
            const active = route().current(href);
            return <Link key={href} href={route(href)} aria-current={active ? 'page' : undefined} className={`rounded-lg border p-4 transition-colors ${active ? 'border-primary bg-secondary' : 'border-border bg-surface hover:bg-secondary/40 hover:border-primary/40'}`}>
                <div className="flex items-center justify-between text-primary"><Icon size={18} aria-hidden="true" />{active ? <span className="text-xs">Viewing</span> : <ArrowUpRight size={14} aria-hidden="true" />}</div>
                <span className="mt-3 block font-semibold text-foreground">{name}</span><span className="mt-1 block text-xs text-muted">{description}</span>
            </Link>;
        })}
    </nav>;
}
