export const PHILIPPINE_TIME_ZONE = 'Asia/Manila';

function parseBackendDateTime(value: string | Date): Date {
    if (value instanceof Date) return value;

    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
        ? `${value.replace(' ', 'T')}Z`
        : value;

    return new Date(normalized);
}

export function formatPhilippineDateTime(value: string | Date | null | undefined, fallback = '—'): string {
    if (!value) return fallback;

    const date = parseBackendDateTime(value);
    if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : fallback;

    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: PHILIPPINE_TIME_ZONE,
    }).format(date);
}

export function formatPhilippineDate(value: string | Date | null | undefined, fallback = '—'): string {
    if (!value) return fallback;

    const date = parseBackendDateTime(value);
    if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : fallback;

    return new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeZone: PHILIPPINE_TIME_ZONE,
    }).format(date);
}
