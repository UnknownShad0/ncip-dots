import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import SearchableSelect, { type SearchableSelectOption } from '@/Components/SearchableSelect';
import { formatPhilippineDateTime } from '@/lib/dateTime';
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
    automated_emails: 'Email delivery',
};

const actionLabels: Record<string, string> = {
    'document.approval.submitted': 'Document submitted for approval',
    'document.approval.approved': 'Document approved',
    'document.approval.rejected': 'Document rejected',
    'document.approval.revision_requested': 'Changes requested for document',
    'user.bureau_transferred': 'User moved to another bureau',
    'login.succeeded': 'Signed in',
    'login.failed': 'Sign in failed',
    'login.locked': 'Account locked after repeated sign in failures',
    'logout.succeeded': 'Signed out',
    'email_notifications.enabled': 'Email delivery enabled',
    'email_notifications.paused': 'Email delivery paused',
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
            header={<h1 className="text-2xl font-semibold tracking-tight text-foreground">Audit trail</h1>}
        >
            <Head title="Audit trail" />

            <div aria-busy={updating} className="mx-auto max-w-[1440px] rounded-lg border border-border bg-surface p-4 sm:p-5">
                <div className="mb-5"><p className="mt-1 text-sm text-muted">Review recorded actions.</p></div>

                {scopeNotice && <p className="mb-4 rounded-lg bg-background p-3 text-sm text-muted">{scopeNotice}</p>}

                {canFilterBureaus && <div className="mb-5 max-w-xl">
                    <label htmlFor="audit-bureau" className="mb-1 block text-sm font-medium text-foreground">Bureau</label>
                    <SearchableSelect
                        id="audit-bureau"
                        ariaLabel="Filter audit trail by bureau"
                        value={filters.office_id ?? ''}
                        options={bureaus.map((bureau): SearchableSelectOption => ({ value: String(bureau.id), label: bureau.name, searchText: String(bureau.id) }))}
                        onChange={(officeId) => router.get('/audit-trail', officeId ? { office_id: officeId } : {}, { preserveState: true, preserveScroll: true, replace: true, onStart: () => setUpdating(true), onFinish: () => setUpdating(false) })}
                        placeholder="All bureaus"
                        emptyOptionLabel="All bureaus"
                        searchPlaceholder="Search bureau or office"
                        emptyMessage="No bureaus match your search."
                        className="w-full"
                    />
                    {/* <p className="mt-1 text-xs text-muted">Native entries use the bureau recorded at the time. Legacy entries without a bureau snapshot are matched using the actor's current bureau assignment.</p> */}
                </div>}

                {updating && <p role="status" className="mb-4 inline-flex items-center gap-2 text-xs text-muted"><LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Updating activity…</p>}

                <div className="divide-y divide-border" aria-busy={updating}>
                    {trail.length === 0 ? (
                        <p className="text-muted">{filters.office_id ? 'No activity found for this bureau.' : 'No activity recorded yet.'}</p>
                    ) : (
                        trail.map((entry) => {
                            const details = detailsByEntry.get(entry.id) ?? [];

                            return (
                                <div key={entry.id} className="py-4">
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-foreground">
                                                <span className="break-words">{actionLabel(entry.action)}</span>
                                                {entry.record_source === 'legacy_import' && <span className="rounded bg-background px-2 py-0.5 text-xs text-muted">Legacy</span>}
                                                {entry.result && <span className={`rounded px-2 py-0.5 text-xs ${entry.result === 'failure' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{entry.result}</span>}
                                            </div>
                                            {entry.legacy_module && <div className="mt-1 text-xs text-muted">{entry.legacy_module}</div>}
                                            <div className="text-sm text-muted">
                                                {entry.actor_name || (entry.user ? (entry.user.short_name || entry.user.name) : entry.action === 'login.failed' || entry.action === 'login.rate_limited' || entry.action === 'login.locked' || entry.action === 'password.reset_requested' ? 'Unauthenticated request' : entry.record_source === 'legacy_import' ? 'User not recorded or unavailable' : 'System')}
                                                {entry.actor_office_name && <span className="block text-xs">{entry.actor_office_name}</span>}
                                                {entry.bureau_filter_uses_current_assignment && <span className="block text-xs">Historical bureau unavailable; matched by current assignment</span>}
                                            </div>
                                            {details.length > 0 && <dl className="mt-2 space-y-1 text-xs text-muted">
                                                {details.map((detail, index) => <div key={`${detail.key}-${index}`} className="flex flex-wrap gap-x-2 gap-y-1">
                                                    <dt className="font-medium text-foreground"> {detail.label}:</dt>
                                                    <dd className="min-w-0 break-words">{detail.changed
                                                        ? <><span>{formatDetailValue(detail.before, detail.key)}</span><span className="mx-1">→</span><span className="font-medium text-foreground">{formatDetailValue(detail.value, detail.key)}</span></>
                                                        : <span className="font-medium text-foreground">{formatDetailValue(detail.value, detail.key)}</span>}</dd>
                                                </div>)}
                                            </dl>}
                                        </div>
                                        <div className="shrink-0 text-xs text-slate-400 sm:whitespace-nowrap">
                                            {formatPhilippineDateTime(entry.created_at, 'Date not recorded')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
                {pagination && (pagination.to ?? 0) > 0 && <nav aria-label="Audit trail pagination" className="mt-5 flex flex-col gap-3 border-t border-border pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-muted">{paginationLabel}</p>
                    <div className="flex w-full gap-2 sm:w-auto">
                        {pagination.prev_page_url ? <Link href={pagination.prev_page_url} onStart={() => setUpdating(true)} onFinish={() => setUpdating(false)} className="flex-1 rounded-lg border border-border px-3 py-2 text-center hover:bg-background sm:flex-none">Previous</Link> : <span aria-disabled="true" className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-slate-400 sm:flex-none">Previous</span>}
                        {pagination.next_page_url ? <Link href={pagination.next_page_url} onStart={() => setUpdating(true)} onFinish={() => setUpdating(false)} className="flex-1 rounded-lg border border-border px-3 py-2 text-center hover:bg-background sm:flex-none">Next</Link> : <span aria-disabled="true" className="flex-1 rounded-lg border border-border px-3 py-2 text-center text-slate-400 sm:flex-none">Next</span>}
                    </div>
                </nav>}
            </div>
        </AuthenticatedLayout>
    );
}
