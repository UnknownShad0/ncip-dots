/** Match the server's legacy ISO-date presentation without changing free text. */
export function displayDocumentDate(value: string): string {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!parts) return value;
    const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return value;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[month - 1]} ${parts[3]}, ${parts[1]}`;
}
