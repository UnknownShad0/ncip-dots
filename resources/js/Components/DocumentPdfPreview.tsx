import axios from 'axios';
import { useEffect, useState } from 'react';

export default function DocumentPdfPreview({ payload, draftId, fileName = 'document.pdf' }: { payload?: Record<string, unknown>; draftId?: number; fileName?: string }) {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const serialized = JSON.stringify(payload);
    useEffect(() => {
        const controller = new AbortController();
        let objectUrl = '';
        setUrl('');
        setError('');
        const request = draftId
            ? axios.get(`/document-creation/${draftId}/preview`, { responseType: 'blob', signal: controller.signal })
            : axios.post('/document-creation/preview', JSON.parse(serialized || '{}'), { responseType: 'blob', signal: controller.signal });
        request.then(response => {
            if (controller.signal.aborted) return;
            objectUrl = URL.createObjectURL(response.data);
            setUrl(objectUrl);
        }).catch(async failure => {
            if (controller.signal.aborted) return;
            let message = 'Could not generate the PDF. Please try again.';
            if (failure.response?.data instanceof Blob) {
                try {
                    const data = JSON.parse(await failure.response.data.text());
                    message = data.errors ? Object.values(data.errors).flat().join(' ') : data.message || message;
                } catch { /* Use the readable fallback for HTML errors. */ }
            }
            if (!controller.signal.aborted) setError(message);
        });
        return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [serialized, draftId]);
    if (error) return <p role="alert" className="rounded-lg bg-danger-soft p-4 text-sm text-danger">{error}</p>;
    if (!url) return <p role="status" className="p-8 text-center text-sm text-muted">Preparing PDF preview…</p>;
    return <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <a href={url} target="_blank" rel="noopener noreferrer" className="dots-button-secondary w-full sm:w-auto">Open PDF / Print</a>
            <a href={url} download={fileName} className="dots-button-primary w-full sm:w-auto">Download PDF</a>
        </div>
        <iframe title="Document PDF preview" src={url} className="h-[70vh] w-full rounded-lg border border-border bg-white" />
        <p className="text-xs text-muted">This PDF uses the same layout as the generated attachment. If the preview is unavailable, use Open PDF / Print.</p>
    </div>;
}
