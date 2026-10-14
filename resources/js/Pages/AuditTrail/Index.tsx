import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

type Pagination = { current_page: number; last_page: number | null; total: number | null; from: number | null; to: number | null; prev_page_url: string | null; next_page_url: string | null };
type DetailRecord = Record<string, unknown>;
type DetailLine = { key: string; label: string; before?: unknown; value: unknown; changed: boolean };

const detailLabels: Record<string, string> = {
    tracking_number: 'Document number',
    title: 'Title',
    name: 'Name',
    firstname: 'First name',
    lastname: 'Last name',
    email: 'Email',
    role: 'Role',
    office_name: 'Bureau',
    bureau_name: 'Bureau',
    is_active: 'Account status',
    is_locked: 'Account access',
    credentials_changed: 'Password changed',
    status: 'Status',
    version: 'Version',
    remarks: 'Notes',
    reason: 'Reason',
    method: 'Method',
    identifier: 'Account',
    file_name: 'File',
    type: 'Type',
    source: 'Source',
    target: 'Destination',
    import: 'Import',
    result: 'Result',
    mode: 'Mode',
};

const actionLabels: Record<string, string> = {
    'document.approval.submitted': 'Document submitted for approval',
    'document.approval.approved': 'Document approved',
    'document.approval.rejected': 'Document rejected',
    'document.approval.revision_requested': 'Changes requested for document',
    'user.bureau_transferred': 'User moved to another bureau',
    'login.succeeded': 'Signed in',
    'login.failed': 'Sign in failed',
    'logout.succeeded': 'Signed out',
};

function isRecord(value: unknown): value is DetailRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTechnicalField(key: string): boolean {
    return key === 'id' || key.endsWith('_id') || ['ip_address', 'user_agent', 'model_type', 'model_id', 'stack', 'trace'].includes(key);
}

function humanize(value: string): string {
    const words = value.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Details';
}

function detailLabel(key: string): string {
    return detailLabels[key] ?? humanize(key);
}

function actionLabel(action: unknown): string {
    if (typeof action !== 'string' || !action.trim()) return 'Unspecified action';
    const value = action.trim();
    if (actionLabels[value]) return actionLabels[value];

    const readable = value.startsWith('library.') ? value.slice('library.'.length) : value;
    return /[._]/.test(readable) ? humanize(readable) : readable;
}

function formatDetailValue(value: unknown, key = ''): string {
    if (value === null || value === undefined || value === '') return 'Not set';
    if (typeof value === 'boolean') {
        if (key === 'is_active') return value ? 'Active' : 'Inactive';
        if (key === 'is_locked') return value ? 'Locked' : 'Not locked';
        return value ? 'Yes' : 'No';
    }
    if (typeof value === 'string') {
        return value.includes('_') && /^[a-z0-9_]+$/i.test(value) ? humanize(value) : value;
    }
    if (typeof value === 'number') return value.toLocaleString();
    if (Array.isArray(value)) {
        const shown = value.slice(0, 5).map((item) => formatDetailValue(item));
        return `${shown.join(', ') || 'None'}${value.length > shown.length ? `, and ${value.length - shown.length} more` : ''}`;
    }
    if (isRecord(value)) {
        const fields = Object.entries(value).filter(([nestedKey]) => !isTechnicalField(nestedKey));
        const shown = fields.slice(0, 5).map(([nestedKey, nestedValue]) => `${detailLabel(nestedKey)}: ${formatDetailValue(nestedValue, nestedKey)}`);
        return `${shown.join('; ') || 'Additional details'}${fields.length > shown.length ? `; and ${fields.length - shown.length} more` : ''}`;
    }
    return String(value);
}

function parseDetails(value: unknown): unknown {
    if (typeof value !== 'string') return value ?? null;
    if (!value.trim()) return null;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function detailLines(value: unknown): DetailLine[] {
    const details = parseDetails(value);
    if (!isRecord(details)) {
        return details === null ? [] : [{ key: 'details', label: 'Details', value: details, changed: false }];
    }

    const lines: DetailLine[] = [];
    const consumed = new Set<string>();

    if (isRecord(details.changes)) {
        consumed.add('changes');
        Object.entries(details.changes).forEach(([key, change]) => {
            if (isTechnicalField(key)) return;
            if (isRecord(change) && ('before' in change || 'after' in change)) {
                if (JSON.stringify(change.before) === JSON.stringify(change.after)) return;
                lines.push({ key, label: detailLabel(key), before: change.before, value: change.after, changed: true });
            } else {
                lines.push({ key, label: detailLabel(key), value: change, changed: false });
            }
        });
    }

    const before = details.before;
    const after = details.after;
    if (isRecord(before) && isRecord(after)) {
        consumed.add('before');
        consumed.add('after');
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        keys.forEach((key) => {
            if (isTechnicalField(key) || JSON.stringify(before[key]) === JSON.stringify(after[key])) return;
            lines.push({ key, label: detailLabel(key), before: before[key], value: after[key], changed: true });
        });
    }

    Object.entries(details).forEach(([key, fieldValue]) => {
        if (consumed.has(key) || ['before', 'after', 'changes'].includes(key) || isTechnicalField(key)) return;
        lines.push({ key, label: detailLabel(key), value: fieldValue, changed: false });
    });

    return lines;
}

export default function AuditTrailIndex({ trail = [], pagination, canFilterBureaus = false, bureaus = [], filters = { office_id: null }, scopeNotice }: { trail?: any[]; pagination?: Pagination; scopeNotice?: string | null; canFilterBureaus?: boolean; bureaus?: Array<{ id: number; name: string }>; filters?: { office_id: number | null } }) {
    const [updating, setUpdating] = useState(false);
    const detailsByEntry = useMemo(() => new Map(trail.map((entry) => [entry.id, detailLines(entry.details)])), [trail]);
    const paginationLabel = pagination?.total !== null && pagination?.total !== undefined
        ? `${pagination.from ?? 0}–${pagination.to ?? 0} of ${pagination.total.toLocaleString()} entries · Page ${pagination.current_page} of ${pagination.last_page ?? 1}`
        : `Showing ${pagination?.from ?? 0}–${pagination?.to ?? 0} entries`;

    return (
        <AuthenticatedLayout
            header={<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">System activity</p><h1 className="text-2xl font-bold tracking-tight text-[#171717] sm:text-3xl">Audit Trail</h1></div>}
        >
            <Head title="Audit Trail" />

            <div aria-busy={updating} className="mx-auto max-w-[1440px] rounded-2xl border border-[#e2e2df] bg-white p-3 shadow-sm sm:p-5 md:p-6">
                <div className="mb-5"><h2 className="text-lg font-semibold tracking-tight text-[#171717] sm:text-xl">System activity history</h2><p className="mt-1 text-sm text-[#73736e]">Review recorded actions, including imported legacy activity.</p></div>

                {scopeNotice && <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{scopeNotice}</p>}

                {canFilterBureaus && <div className="mb-5 max-w-xl">
                    <label htmlFor="audit-bureau" className="mb-1 block text-sm font-medium text-slate-700">Bureau</label>
                    <select id="audit-bureau" value={filters.office_id ?? ''} onChange={(event) => router.get('/audit-trail', event.target.value ? { office_id: event.target.value } : {}, { preserveState: true, preserveScroll: true, replace: true, onStart: () => setUpdating(true), onFinish: () => setUpdating(false) })} className="w-full rounded-lg border-slate-300 text-sm">
                        <option value="">All bureaus</option>
                        {bureaus.map((bureau) => <option key={bureau.id} value={bureau.id}>{bureau.name}</option>)}
                    </select>
                    <p className="mt-1 text-xs text-slate-500">Native entries use the bureau recorded at the time. Legacy entries without a bureau snapshot are matched using the actor's current bureau assignment.</p>
                </div>}

                {updating && <p role="status" className="mb-4 inline-flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Updating activity…</p>}

                <div className="space-y-3" aria-busy={updating}>
                    {trail.length === 0 ? (
                        <p className="text-slate-500">{filters.office_id ? 'No activity found for this bureau.' : 'No activity recorded yet.'}</p>
                    ) : (
                        trail.map((entry) => {
                            const details = detailsByEntry.get(entry.id) ?? [];

                            return (
                                <div key={entry.id} className="rounded-lg border border-slate-200 p-3 sm:p-4">
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-800">
                                                <span className="break-words">{actionLabel(entry.action)}</span>
                                                {entry.record_source === 'legacy_import' && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Legacy</span>}
                                                {entry.result && <span className={`rounded px-2 py-0.5 text-xs ${entry.result === 'failure' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{entry.result}</span>}
                                            </div>
                                            {entry.legacy_module && <div className="mt-1 text-xs text-slate-500">{entry.legacy_module}</div>}
                                            <div className="text-sm text-slate-500">
                                                {entry.actor_name || (entry.user ? (entry.user.short_name || entry.user.name) : entry.action === 'login.failed' || entry.action === 'login.rate_limited' || entry.action === 'password.reset_requested' ? 'Unauthenticated request' : entry.record_source === 'legacy_import' ? 'User not recorded or unavailable' : 'System')}
                                                {entry.actor_office_name && <span className="block text-xs">{entry.actor_office_name}</span>}
                                                {entry.bureau_filter_uses_current_assignment && <span className="block text-xs">Historical bureau unavailable; matched by current assignment</span>}
                                            </div>
                                            {details.length > 0 && <dl className="mt-2 space-y-1 text-xs text-slate-600">
                                                {details.map((detail, index) => <div key={`${detail.key}-${index}`} className="flex flex-wrap gap-x-2 gap-y-1">
                                                    <dt className="font-medium text-slate-700"> {detail.label}:</dt>
                                                    <dd className="min-w-0 break-words">{detail.changed
                                                        ? <><span>{formatDetailValue(detail.before, detail.key)}</span><span className="mx-1">→</span><span className="font-medium text-slate-800">{formatDetailValue(detail.value, detail.key)}</span></>
                                                        : <span className="font-medium text-slate-800">{formatDetailValue(detail.value, detail.key)}</span>}</dd>
                                                </div>)}
                                            </dl>}
                                        </div>
                                        <div className="shrink-0 text-xs text-slate-400 sm:whitespace-nowrap">
                                            {entry.created_at ? new Date(entry.created_at).toLocaleString() : 'Date not recorded'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {pagination && (pagination.to ?? 0) > 0 && <nav aria-label="Audit trail pagination" className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-slate-600">{paginationLabel}</p>
                    <div className="flex w-full gap-2 sm:w-auto">
                        {pagination.prev_page_url ? <Link href={pagination.prev_page_url} onStart={() => setUpdating(true)} onFinish={() => setUpdating(false)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center hover:bg-slate-50 sm:flex-none">Previous</Link> : <span aria-disabled="true" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-center text-slate-400 sm:flex-none">Previous</span>}
                        {pagination.next_page_url ? <Link href={pagination.next_page_url} onStart={() => setUpdating(true)} onFinish={() => setUpdating(false)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center hover:bg-slate-50 sm:flex-none">Next</Link> : <span aria-disabled="true" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-center text-slate-400 sm:flex-none">Next</span>}
                    </div>
                </nav>}
            </div>
        </AuthenticatedLayout>
    );
}
