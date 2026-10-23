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

// Git-graph geometry shared by the route map and the activity timeline:
//   - rail at x = 7px (`left-[6px]` + 2px border)
//   - dot is 14px (h-3.5 w-3.5) at top-4, so its center is y = 23px
//   - cards start at x = 32px (pl-8)
//   - a forwarded branch is rendered INSIDE its parent step's <li>, right under the parent card,
//     indented 32px (ml-8). Its header is 8px top padding + 24px label row + 8px gap = 40px,
//     and a connector drops from the parent card's bottom edge into the child lane.
//   - the terminal card (if any) sits right below the last route with 12px top padding;
//     its dot center is at y = 12 + 23 = 35px, and the last route's main rail continues
//     (`continues`) all the way down to it.
// Rows are separated with padding (never margin) so rails stay continuous.
// One color per depth, like colored git lanes. Full class names so Tailwind can see them.
const LANE_BORDER = ['border-blue-500/60', 'border-sky-500/70', 'border-violet-500/70', 'border-amber-500/70'];
const LANE_TEXT = ['text-blue-800', 'text-sky-800', 'text-violet-800', 'text-amber-800'];
const LANE_BG = ['bg-blue-50', 'bg-sky-50', 'bg-violet-50', 'bg-amber-50'];

const findTerminalTrail = (trails: Trail[]) => trails.find((trail) => trail.status?.toLowerCase() === 'terminal');

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

                    {document.route_tree?.length || document.route_steps?.length || findTerminalTrail(document.trails) ? <RouteBranchMap document={document} /> : null}

                    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="routing-history-title">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <div>
                                <h2 id="routing-history-title" className="text-lg font-semibold">Activity timeline</h2>
                                <p className="mt-1 text-sm text-slate-600">Latest activity first.</p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{document.trails.length} events</span>
                        </div>
                        {document.trails.length ? <ol className="relative mt-5" aria-label="Routing activity, latest first">
                            {document.trails.map((trail, index) => {
                                const isFirst = index === 0;
                                const isLast = index === document.trails.length - 1;
                                // Rail starts at the first dot, ends at the last dot, and runs through everything in between.
                                const railClass = isFirst && isLast
                                    ? null
                                    : `${isFirst ? 'top-[23px]' : 'top-0'} ${isLast ? 'h-[23px]' : 'bottom-0'}`;
                                const dotClass = trail.status === 'approved'
                                    ? 'border-emerald-500 bg-emerald-500'
                                    : ['rejected', 'changes_requested'].includes(trail.status || '')
                                        ? 'border-rose-500 bg-rose-500'
                                        : 'border-blue-600 bg-blue-600';

                                return <li key={`${trail.created_at ?? 'trail'}-${index}`} className={`relative pl-8 ${isLast ? '' : 'pb-3'}`}>
                                    {railClass && <span className={`absolute left-[6px] w-0 border-l-2 border-solid border-blue-500/60 ${railClass}`} aria-hidden="true" />}
                                    <span className={`absolute left-0 top-4 z-[1] h-3.5 w-3.5 rounded-full border-2 ${dotClass} ${isFirst ? 'ring-4 ring-blue-100' : ''}`} aria-hidden="true" />
                                    <span className="absolute left-3.5 top-[22px] h-0.5 w-[18px] bg-slate-200" aria-hidden="true" />
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
                                </li>;
                            })}
                        </ol> : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No routing activity is available yet.</p>}
                    </section>

                    <p className="mt-6 text-center text-xs text-slate-500">National Commission on Indigenous Peoples · Document Tracking System</p>
                </div>
            </main>
        </>
    );
}

function RouteBranchMap({ document }: { document: TrackedDocument }) {
    // Always show routes oldest to newest (Route 1 first), whatever order the backend sends them in.
    const routes: PublicRoute[] = document.route_tree?.length
        ? [...document.route_tree].sort((a, b) => a.id - b.id)
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
    // The earliest route is where the document started.
    const originOffice = document.route_from_office || routes[0]?.from_office || document.office_name || 'Originating office';
    // Trails are latest first, so find() returns the most recent terminal entry.
    const terminalTrail = findTerminalTrail(document.trails);
    // With routes above it, the last route's rail must run straight down into the terminal dot.
    const terminalConnected = Boolean(terminalTrail) && routes.length > 0;

    return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="office-route-title">
        <div className="border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Route map</p>
                    <h2 id="office-route-title" className="mt-1 text-lg font-semibold text-slate-900">Office approval route</h2>
                    <p className="mt-1 text-sm text-slate-600">Every listed office must approve. Forwarded offices branch off to the side, and the parent office still makes its own decision.</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${publicStatusClass(routeStatus)}`}>{routeStatus.replaceAll('_', ' ')}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-600">
                <span><strong className="text-slate-900">{allSteps.length}</strong> {allSteps.length === 1 ? 'office' : 'offices'}</span>
                <span><strong className="text-emerald-700">{approvedCount}</strong> approved</span>
                <span><strong className="text-slate-900">{allSteps.length - approvedCount}</strong> remaining</span>
            </div>
            {/* Small legend so the lines are easy to read */}
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-600" aria-label="Legend">
                <span className="inline-flex items-center gap-2"><span className="h-4 w-0 border-l-2 border-solid border-blue-500/60" aria-hidden="true" />Sequential approval</span>
                <span className="inline-flex items-center gap-2"><span className="h-4 w-0 border-l-2 border-dashed border-blue-500/60" aria-hidden="true" />Parallel approval</span>
                <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-blue-600 bg-blue-600 ring-4 ring-blue-100" aria-hidden="true" />Current</span>
                <span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-emerald-500" aria-hidden="true" />Approved</span>
            </div>
        </div>

        <div className="p-5 sm:p-7">
            <div className="rounded-xl border border-blue-100 bg-slate-50 p-3.5 sm:p-4">
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

            <div className="mt-5">
                {routes.length > 0 && <div className="space-y-6">
                    {routes.map((route, index) => <PublicRouteGroup key={route.id} route={route} depth={0} round={index + 1} continues={terminalConnected && index === routes.length - 1} />)}
                </div>}
                {terminalTrail && <ol className="relative" aria-label="Terminal transaction">
                    <li className={`relative pl-8 ${terminalConnected ? 'pt-3' : ''}`}>
                        {/* Rail from the previous step straight into the terminal dot (12px padding + 23px dot center = 35px) */}
                        {terminalConnected && <span className="absolute left-[6px] top-0 h-[35px] w-0 border-l-2 border-solid border-blue-500/60" aria-hidden="true" />}
                        <span className={`absolute left-0 z-[1] h-3.5 w-3.5 rounded-full border-2 border-slate-700 bg-slate-700 ring-4 ring-slate-200 ${terminalConnected ? 'top-7' : 'top-4'}`} aria-hidden="true" />
                        <span className={`absolute left-3.5 h-0.5 w-[18px] bg-slate-200 ${terminalConnected ? 'top-[34px]' : 'top-[22px]'}`} aria-hidden="true" />
                        <article className="rounded-xl border border-slate-300 bg-slate-50 p-3.5 sm:p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-700 text-xs font-bold text-white">{allSteps.length + 1}</span>
                                    <div className="min-w-0">
                                        <p className="break-words text-sm font-semibold text-slate-900">{terminalTrail.from_office || terminalTrail.holder || terminalTrail.to_office || originOffice}</p>
                                        <p className="mt-0.5 text-xs text-slate-500">{terminalTrail.action || 'Tagged as Terminal'}</p>
                                    </div>
                                </div>
                                <RouteStepStatus status="terminal" />
                            </div>
                            {terminalTrail.created_at && <p className="mt-3 border-t border-slate-200 pt-2.5 text-xs text-slate-500">Recorded {terminalTrail.created_at}</p>}
                        </article>
                    </li>
                </ol>}
            </div>
        </div>
    </section>;
}

function collectPublicRouteSteps(route: PublicRoute): PublicRouteStep[] {
    return route.steps.flatMap((step) => [step, ...(step.child_routes ?? []).flatMap((child) => collectPublicRouteSteps(child))]);
}

function PublicRouteGroup({ route, depth, round, continues = false }: { route: PublicRoute; depth: number; round?: number; continues?: boolean }) {
    const isParallel = route.mode === 'parallel';
    const lane = depth % 4;
    const childLane = (depth + 1) % 4;

    return <section aria-label={depth > 0 ? `Forwarded route from ${route.from_office || 'office'}` : `Route round ${round}`}>
        {depth === 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
                <p className="text-xs font-semibold text-slate-900">Route {round}</p>
                <p className="text-[11px] text-slate-500">{isParallel ? 'Parallel approval · offices can act independently' : 'Sequential approval · next office waits for approval'}</p>
            </div>
            <RouteStepStatus status={route.status} />
        </div>}

        <ol className="relative" aria-label={isParallel ? 'Parallel office branches' : 'Sequential office steps'}>
            {route.steps.map((step, index) => {
                const isFirst = index === 0;
                const isLast = index === route.steps.length - 1;
                const startsAtDot = isFirst && depth === 0;
                // The last step keeps its rail going to the bottom when something (the terminal card) follows this route.
                const runsThrough = isLast && continues;

                // Rail segment for this step. Solid = step by step, dashed = parallel.
                // On the last step the rail ends at the dot, even if the step has children,
                // because the children hang off their own (indented) lane.
                const start = startsAtDot ? 'top-[23px]' : 'top-0';
                const end = isLast && !runsThrough ? 'h-[23px]' : 'bottom-0';
                const rail = startsAtDot && isLast && !runsThrough ? null : <span
                    className={`absolute left-[6px] w-0 border-l-2 ${LANE_BORDER[lane]} ${isParallel ? 'border-dashed' : 'border-solid'} ${start} ${end}`}
                    aria-hidden="true"
                />;

                const active = ['in_progress', 'available', 'waiting_on_branch'].includes(step.status);
                const branchComplete = step.child_routes?.some((child) => child.status === 'approved');
                const children = step.child_routes ?? [];

                return <li key={step.id} className={`relative pl-8 ${isLast ? '' : 'pb-3'}`}>
                    {rail}
                    <span className={`absolute left-0 top-4 z-[1] h-3.5 w-3.5 rounded-full border-2 ${publicMarkerClass(step.status)}`} aria-hidden="true" />
                    <span className="absolute left-3.5 top-[22px] h-0.5 w-[18px] bg-slate-200" aria-hidden="true" />
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

                    {/* Forwarded routes: nested under the parent card so they visibly branch from it */}
                    {children.map((child) => {
                        const childParallel = child.mode === 'parallel';
                        const childStyle = `${LANE_BORDER[childLane]} ${childParallel ? 'border-dashed' : 'border-solid'}`;

                        return <div key={child.id} className="relative ml-8 pt-2">
                            {/* Connector: drops from the parent card's bottom edge into the child lane (8 + 24 + 8 = 40px) */}
                            <span className={`absolute left-[6px] top-0 h-10 w-0 border-l-2 ${childStyle}`} aria-hidden="true" />
                            {/* Elbow into the label pill, at the pill's vertical center (8 + 12 = 20px) */}
                            <span className={`absolute left-[7px] top-[19px] w-[25px] border-t-2 ${childStyle}`} aria-hidden="true" />
                            <div className="flex h-8 items-center gap-2 overflow-hidden pb-2 pl-8">
                                <span className={`min-w-0 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${LANE_BG[childLane]} ${LANE_TEXT[childLane]}`}>
                                    Forwarded by {step.office} · {childParallel ? 'Parallel approval' : 'Sequential approval'}
                                </span>
                                <RouteStepStatus status={child.status} compact />
                            </div>
                            <PublicRouteGroup route={child} depth={depth + 1} />
                        </div>;
                    })}
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