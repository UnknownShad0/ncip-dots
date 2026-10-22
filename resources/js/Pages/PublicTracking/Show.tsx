import { Head } from '@inertiajs/react';

type Trail = {
    action?: string | null;
    status?: string | null;
    from_office?: string | null;
    to_office?: string | null;
    holder?: string | null;
    created_at?: string | null;
};

type PublicRouteStep = {
    id: number;
    office?: string | null;
    position: number;
    status: string;
    child_routes?: PublicRoute[];
};

type PublicRoute = {
    id: number;
    mode: 'sequential' | 'parallel';
    status: string;
    from_office?: string | null;
    steps: PublicRouteStep[];
};

type TrackedDocument = {
    tracking_number: string;
    title?: string | null;
    status?: string | null;
    document_type?: string | null;
    purpose?: string | null;
    office_name?: string | null;
    created_at?: string | null;
    route_mode?: 'sequential' | 'parallel' | null;
    route_status?: string | null;
    route_from_office?: string | null;
    route_steps?: Array<{ office?: string | null; position: number; status: string }>;
    route_tree?: PublicRoute[];
    trails: Trail[];
};

const routeStepLabels: Record<string, string> = {
    waiting: 'Waiting',
    available: 'Waiting to receive',
    in_progress: 'In progress',
    waiting_on_branch: 'Waiting on branch',
    approved: 'Approved',
    changes_requested: 'Changes requested',
    rejected: 'Rejected',
    paused: 'Paused',
};

const routeStepLabel = (status: string) => routeStepLabels[status] ?? status.replaceAll('_', ' ');

export default function Show({ document }: { document: TrackedDocument }) {
    return (
        <>
            <Head title={`Track ${document.tracking_number}`} />
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
                <div className="mx-auto max-w-3xl">
                    <header className="mb-6 text-center">
                        <img src="/images/logo/ncip-logo.png" alt="NCIP logo" className="mx-auto mb-3 h-16 w-16 object-contain" />
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Document Tracking System</p>
                        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Public document tracking</h1>
                        <p className="mt-2 text-sm text-slate-600">Current routing information for this tracking number.</p>
                    </header>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="document-summary-title">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                            <div className="min-w-0">
                                <h2 id="document-summary-title" className="break-words text-xl font-semibold">{document.title || 'Untitled document'}</h2>
                                <p className="mt-1 break-all font-mono text-sm text-slate-600">{document.tracking_number}</p>
                            </div>
                            <span className="rounded-full bg-secondary px-3 py-1 text-sm font-medium capitalize text-primary">{document.status || 'Status unavailable'}</span>
                        </div>

                        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Detail label="Document type" value={document.document_type} />
                            <Detail label="Purpose" value={document.purpose} />
                            <Detail label="Originating office" value={document.office_name} />
                            <Detail label="Date created" value={document.created_at} />
                        </dl>
                    </section>

                    {document.route_tree?.length || document.route_steps?.length ? <RouteBranchMap document={document} /> : null}

                    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="routing-history-title">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <h2 id="routing-history-title" className="text-lg font-semibold">Activity timeline</h2>
                                <p className="mt-1 text-sm text-slate-600">Latest activity first.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{document.trails.length} events</span>
                        </div>
                        {document.trails.length ? <ol className="relative mt-5 space-y-3" aria-label="Routing activity, latest first">
                            {document.trails.map((trail, index) => <li key={`${trail.created_at ?? 'trail'}-${index}`} className="relative pl-7">
                                {index < document.trails.length - 1 && <span className="absolute bottom-[-14px] left-[9px] top-3 w-0.5 bg-gradient-to-b from-blue-300 to-slate-200" aria-hidden="true" />}
                                <span className={`absolute left-0 top-3 h-[19px] w-[19px] rounded-full border-[5px] border-white ring-1 ring-slate-200 ${trail.status === 'approved' ? 'bg-emerald-500' : ['rejected', 'changes_requested'].includes(trail.status || '') ? 'bg-rose-500' : 'bg-blue-600'}`} aria-hidden="true" />
                                <article className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="break-words text-sm font-semibold text-slate-900">{trail.action || trail.status || 'Document activity'}</h3>
                                            {trail.status && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${publicStatusClass(trail.status)}`}>{trail.status.replaceAll('_', ' ')}</span>}
                                        </div>
                                        {trail.created_at && <time className="shrink-0 text-xs text-slate-500">{trail.created_at}</time>}
                                    </div>
                                    {(trail.from_office || trail.to_office || trail.holder) && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                        {trail.from_office && <span className="font-medium text-slate-800"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{trail.from_office === trail.to_office ? 'At' : 'From'}</span>{trail.from_office}</span>}
                                        {trail.from_office && trail.to_office && trail.from_office !== trail.to_office && <span className="text-blue-700" aria-label="to">→</span>}
                                        {trail.to_office && trail.from_office !== trail.to_office && <span className="font-medium text-slate-800"><span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</span>{trail.to_office}</span>}
                                        {!trail.from_office && !trail.to_office && trail.holder && <span className="text-slate-600">Current holder: <strong className="font-medium text-slate-900">{trail.holder}</strong></span>}
                                    </div>}
                                </article>
                            </li>)}
                        </ol> : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No routing activity is available yet.</p>}
                    </section>

                    <p className="mt-6 text-center text-xs text-slate-500">National Commission on Indigenous Peoples · Document Tracking System</p>
                </div>
            </main>
        </>
    );
}

function RouteBranchMap({ document }: { document: TrackedDocument }) {
    const routes: PublicRoute[] = document.route_tree?.length
        ? document.route_tree
        : document.route_steps?.length
            ? [{
                id: 0,
                mode: document.route_mode || 'sequential',
                status: document.route_status || 'pending',
                from_office: document.route_from_office,
                steps: document.route_steps.map((step, index) => ({ ...step, id: index + 1, child_routes: [] })),
            }]
            : [];
    const allSteps = routes.flatMap((route) => route.steps.flatMap((step) => [
        step,
        ...(step.child_routes ?? []).flatMap((child) => collectPublicRouteSteps(child)),
    ]));
    const approvedCount = allSteps.filter((step) => step.status === 'approved').length;
    const routeStatus = routes.some((route) => route.status === 'pending') ? 'pending' : (document.status || document.route_status || 'pending');
    const originOffice = document.route_from_office || routes[routes.length - 1]?.from_office || document.office_name || 'Originating office';

    return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="office-route-title">
        <div className="border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Route map</p>
                    <h2 id="office-route-title" className="mt-1 text-lg font-semibold text-slate-900">Office approval route</h2>
                    <p className="mt-1 text-sm text-slate-600">Every listed office must approve. Forwarded offices appear as smaller branches, and the parent office still makes its own decision.</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${publicStatusClass(routeStatus)}`}>{routeStatus.replaceAll('_', ' ')}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                <span><strong className="text-slate-900">{allSteps.length}</strong> {allSteps.length === 1 ? 'office' : 'offices'}</span>
                <span><strong className="text-emerald-700">{approvedCount}</strong> approved</span>
                <span><strong className="text-slate-900">{allSteps.length - approvedCount}</strong> remaining</span>
            </div>
        </div>

        <div className="p-5 sm:p-7">
            <div className="relative rounded-xl border border-blue-100 bg-slate-50 p-3.5 sm:p-4">
                <span className="absolute -bottom-5 left-[7px] h-5 w-px bg-blue-300" aria-hidden="true" />
                <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">S</span>
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Route started from</p>
                        <p className="break-words text-sm font-semibold text-slate-900">{originOffice}</p>
                        <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{document.tracking_number}</p>
                    </div>
                    <span className="ml-auto hidden rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-800 ring-1 ring-blue-100 sm:inline-flex">{routes.length} {routes.length === 1 ? 'route' : 'routes'}</span>
                </div>
            </div>

            <div className="mt-6 space-y-4">
                {routes.map((route, index) => <PublicRouteGroup key={route.id} route={route} depth={0} round={index + 1} />)}
            </div>
        </div>
    </section>;
}

function collectPublicRouteSteps(route: PublicRoute): PublicRouteStep[] {
    return route.steps.flatMap((step) => [step, ...(step.child_routes ?? []).flatMap((child) => collectPublicRouteSteps(child))]);
}

function PublicRouteGroup({ route, depth, round }: { route: PublicRoute; depth: number; round?: number }) {
    const isParallel = route.mode === 'parallel';

    return <section className={depth > 0 ? 'rounded-xl border border-slate-200 bg-white p-3 sm:p-4' : ''} aria-label={depth > 0 ? `Forwarded route from ${route.from_office || 'office'}` : `Route round ${round}`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="text-xs font-semibold text-slate-900">{depth > 0 ? `${isParallel ? 'Parallel branch' : 'Step by step branch'}` : `Route ${round}`}</p>
                <p className="text-[11px] text-slate-500">{isParallel ? 'Parallel · offices can act independently' : 'Step by step · next office waits for approval'}</p>
            </div>
            <RouteStepStatus status={route.status} />
        </div>
        <ol className={`relative space-y-3 pl-7 ${depth > 0 ? '-ml-[38px] sm:-ml-[46px]' : ''}`} aria-label={isParallel ? 'Parallel office branches' : 'Sequential office steps'}>
            {depth === 0 && route.steps.length > 1 && <span className="absolute bottom-5 left-[7px] top-5 w-px bg-gradient-to-b from-blue-300 via-slate-200 to-slate-200" aria-hidden="true" />}
            {route.steps.map((step) => {
                const active = ['in_progress', 'available', 'waiting_on_branch'].includes(step.status);
                const branchComplete = step.child_routes?.some((child) => child.status === 'approved');

                return <li key={step.id} className="relative">
                    <span className={`absolute -left-[28px] top-5 z-[1] h-3.5 w-3.5 rounded-full border-2 ${publicMarkerClass(step.status)}`} aria-hidden="true" />
                    <span className={`absolute -left-[21px] top-[26px] border-t border-slate-200 ${depth > 0 ? 'w-[59px] sm:w-[67px]' : 'w-[21px]'}`} aria-hidden="true" />
                    <div className={depth > 0 ? 'ml-[38px] sm:ml-[46px]' : ''}>
                    <article className={`rounded-xl border ${depth > 0 ? 'p-3' : 'p-3.5 sm:p-4'} ${active ? 'border-blue-200 bg-blue-50/60' : step.status === 'approved' ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                                <span className={`grid shrink-0 place-items-center rounded-lg font-bold ${depth > 0 ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-xs'} ${step.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : active ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{step.position}</span>
                                <div className="min-w-0">
                                    <p className={`break-words font-semibold text-slate-900 ${depth > 0 ? 'text-xs' : 'text-sm'}`}>{step.office || 'Office unavailable'}</p>
                                    <p className="mt-0.5 text-xs text-slate-500">{isParallel ? `Branch ${step.position}` : `Step ${step.position}`}</p>
                                </div>
                            </div>
                            <RouteStepStatus status={step.status} compact={depth > 0} />
                        </div>
                        {step.status === 'waiting_on_branch' && <p className="mt-3 text-xs text-slate-600">This office is waiting for its forwarded offices to finish.</p>}
                        {branchComplete && step.status === 'in_progress' && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">Forwarded branch complete. This office still needs to approve.</p>}
                    </article>
                    </div>
                    {step.child_routes?.length ? <div className="relative ml-5 mt-3 border-l-2 border-blue-500 pl-4 sm:ml-6 sm:pl-5">
                        <span className="absolute -left-[2px] -top-3 h-3 border-l-2 border-blue-500" aria-hidden="true" />
                        <span className="absolute -left-[41px] top-0 w-[41px] border-t-2 border-blue-500 sm:-left-[45px] sm:w-[45px]" aria-hidden="true" />
                        <p className="mb-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">Forwarded by {step.office}</p>
                        <div className="space-y-3">{step.child_routes.map((child) => <PublicRouteGroup key={child.id} route={child} depth={depth + 1} />)}</div>
                    </div> : null}
                </li>;
            })}
        </ol>
    </section>;
}

function RouteStepStatus({ status, compact = false }: { status: string; compact?: boolean }) {
    return <span className={`shrink-0 rounded-full font-semibold capitalize ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'} ${publicStatusClass(status)}`}>{routeStepLabel(status)}</span>;
}

function publicStatusClass(status: string) {
    if (['approved', 'completed', 'released', 'processed', 'done'].includes(status)) return 'bg-emerald-100 text-emerald-800';
    if (['rejected', 'changes_requested'].includes(status)) return 'bg-rose-100 text-rose-800';
    if (['pending', 'ongoing', 'available', 'waiting', 'in_progress', 'waiting_on_branch', 'paused'].includes(status)) return 'bg-amber-100 text-amber-900';
    return 'bg-slate-100 text-slate-700';
}

function publicMarkerClass(status: string) {
    if (status === 'approved') return 'border-emerald-500 bg-emerald-500';
    if (['rejected', 'changes_requested'].includes(status)) return 'border-rose-500 bg-rose-500';
    if (['available', 'in_progress', 'waiting_on_branch'].includes(status)) return 'border-blue-600 bg-blue-600 ring-4 ring-blue-100';
    return 'border-slate-300 bg-white';
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value || '—'}</dd></div>;
}
