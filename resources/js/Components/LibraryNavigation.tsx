import { Link } from '@inertiajs/react';
import { ChevronRight, Building2, FileText, Map, Target, Zap } from 'lucide-react';

export const libraryLinks = [
    { name: 'Offices', href: 'offices.index', description: 'Offices that send and receive documents.', icon: Building2 },
    { name: 'Ranges', href: 'ranges.index', description: 'Office groupings used for routing.', icon: Map },
    { name: 'Document types', href: 'document-types.index', description: 'Letters, reports, and other record types.', icon: FileText },
    { name: 'Purpose types', href: 'purpose-types.index', description: 'Why a document is being sent.', icon: Target },
    { name: 'Action types', href: 'action-types.index', description: 'Actions available during document routing.', icon: Zap },
];

export default function LibraryNavigation() {
    const isDirectory = !libraryLinks.some(({ href }) => route().current(href));
    return <nav aria-label="Library lists" className={isDirectory ? 'no-print divide-y divide-border rounded-lg border border-border bg-surface' : 'no-print mb-5 flex flex-wrap gap-1 border-b border-border pb-3'}>
        {libraryLinks.map(({ name, href, description, icon: Icon }) => {
            const active = route().current(href);
            return <Link key={href} href={route(href)} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-md transition-colors ${isDirectory ? 'p-5 hover:bg-background' : `px-3 py-2 text-sm ${active ? 'bg-secondary font-semibold text-primary' : 'text-muted hover:bg-surface hover:text-foreground'}`}`}>
                {isDirectory && <Icon size={20} className="shrink-0 text-primary" aria-hidden="true" />}
                <span className="min-w-0 flex-1"><span className={isDirectory ? 'block font-semibold text-foreground' : ''}>{name}</span>{isDirectory && <span className="mt-1 block text-sm text-muted">{description}</span>}</span>
                {isDirectory && <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />}
            </Link>;
        })}
    </nav>;
}
