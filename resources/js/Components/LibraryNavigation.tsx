import { Link } from '@inertiajs/react';
import { ArrowUpRight, Building2, FileText, Map, Target, Zap } from 'lucide-react';

export const libraryLinks = [
    { name: 'Offices', href: 'offices.index', description: 'Offices that send and receive documents.', icon: Building2 },
    { name: 'Ranges', href: 'ranges.index', description: 'Office groupings used for routing.', icon: Map },
    { name: 'Document types', href: 'document-types.index', description: 'Letters, reports, and other record types.', icon: FileText },
    { name: 'Purpose types', href: 'purpose-types.index', description: 'Why a document is being sent.', icon: Target },
    { name: 'Action types', href: 'action-types.index', description: 'Actions available during document routing.', icon: Zap },
];

export default function LibraryNavigation() {
    return <nav aria-label="Library lists" className="no-print mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {libraryLinks.map(({ name, href, description, icon: Icon }) => {
            const active = route().current(href);
            return <Link key={href} href={route(href)} aria-current={active ? 'page' : undefined} className={`flex flex-col rounded-lg border p-4 transition-colors ${active ? 'border-primary bg-secondary' : 'border-border bg-surface hover:border-primary/40 hover:bg-secondary/40'}`}>
                <div className="flex items-center justify-between gap-2"><Icon size={18} className="text-primary" aria-hidden="true" /><span className="text-xs text-primary">{active ? 'Viewing' : <ArrowUpRight size={14} aria-hidden="true" />}</span></div>
                <span className="mt-3 font-semibold text-foreground">{name}</span><span className="mt-1 text-xs leading-relaxed text-muted">{description}</span>
            </Link>;
        })}
    </nav>;
}
