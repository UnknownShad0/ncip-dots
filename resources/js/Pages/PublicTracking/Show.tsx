import { Head } from '@inertiajs/react';

type Trail = {
    action?: string | null;
    status?: string | null;
    from_office?: string | null;
    to_office?: string | null;
    holder?: string | null;
    created_at?: string | null;
};

type TrackedFile = {
    name: string;
    type: string;
    mime_type?: string | null;
    url?: string | null;
};

type TrackedDocument = {
    tracking_number: string;
    title?: string | null;
    status?: string | null;
    document_type?: string | null;
    purpose?: string | null;
    office_name?: string | null;
    created_at?: string | null;
    trails: Trail[];
    files: TrackedFile[];
};

export default function Show({ document }: { document: TrackedDocument }) {
    return (
        <>
            <Head title={`Track ${document.tracking_number}`} />
            <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
                <div className="mx-auto max-w-3xl">
                    <header className="mb-6 text-center">
                        <img src="/images/logo/ncip-logo.png" alt="NCIP logo" className="mx-auto mb-3 h-16 w-16 object-contain" />
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">Document Tracking System</p>
                        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Public document tracking</h1>
                        <p className="mt-2 text-sm text-slate-600">Current routing information for this tracking number.</p>
                    </header>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="document-summary-title">
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                            <div className="min-w-0">
                                <h2 id="document-summary-title" className="break-words text-xl font-semibold">{document.title || 'Untitled document'}</h2>
                                <p className="mt-1 break-all font-mono text-sm text-slate-600">{document.tracking_number}</p>
                            </div>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium capitalize text-blue-800">{document.status || 'Status unavailable'}</span>
                        </div>

                        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                            <Detail label="Document type" value={document.document_type} />
                            <Detail label="Purpose" value={document.purpose} />
                            <Detail label="Originating office" value={document.office_name} />
                            <Detail label="Date created" value={document.created_at} />
                        </dl>
                    </section>

                    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="routing-history-title">
                        <h2 id="routing-history-title" className="text-lg font-semibold">Routing history</h2>
                        {document.trails.length ? <ol className="mt-5 space-y-4">
                            {document.trails.map((trail, index) => <li key={`${trail.created_at ?? 'trail'}-${index}`} className="relative border-l-2 border-blue-200 pb-1 pl-5 last:border-transparent">
                                <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 ring-1 ring-blue-200" />
                                <p className="font-medium">{trail.action || trail.status || 'Document activity'}</p>
                                {(trail.from_office || trail.to_office || trail.holder) && <p className="mt-1 text-sm text-slate-600">
                                    {trail.from_office && <>From {trail.from_office}</>}
                                    {trail.to_office && <>{trail.from_office ? ' · ' : ''}To {trail.to_office}</>}
                                    {!trail.from_office && !trail.to_office && trail.holder && <>At {trail.holder}</>}
                                </p>}
                                {trail.created_at && <p className="mt-1 text-xs text-slate-500">{trail.created_at}</p>}
                            </li>)}
                        </ol> : <p className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No routing activity is available yet.</p>}
                    </section>

                    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="file-information-title">
                        <h2 id="file-information-title" className="text-lg font-semibold">File information</h2>
                        {document.files.length ? <ul className="mt-3 divide-y divide-slate-100">
                            {document.files.map((file, index) => <li key={`${file.name}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                                <div className="min-w-0"><span className="block break-all font-medium text-slate-800">{file.name}</span><span className="mt-1 inline-block rounded bg-slate-100 px-2 py-1 text-xs uppercase text-slate-600">{file.type}</span></div>
                                {file.url && <div className="flex shrink-0 gap-3"><a href={file.url} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">View</a><a href={file.url} download={file.name} className="font-medium text-blue-700 underline">Download</a></div>}
                            </li>)}
                        </ul> : <p className="mt-3 text-sm text-slate-600">No file information is available.</p>}
                        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">These file links are available to anyone with this public tracking URL.</p>
                    </section>
                    <p className="mt-6 text-center text-xs text-slate-500">National Commission on Indigenous Peoples · Document Tracking System</p>
                </div>
            </main>
        </>
    );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    return <div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm text-slate-800">{value || '—'}</dd></div>;
}
