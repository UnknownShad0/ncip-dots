import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

const SHOW_DELAY_MS = 250;

export default function PageNavigationLoader() {
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const targetUrlRef = useRef<string | null>(null);

    useEffect(() => {
        const clearPendingNavigation = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            targetUrlRef.current = null;
            setVisible(false);
        };

        const removeStartListener = router.on('start', (event) => {
            clearPendingNavigation();

            const { visit } = event.detail;
            if (visit.method !== 'get' || visit.url.pathname === window.location.pathname) {
                return;
            }

            targetUrlRef.current = visit.url.href;
            timeoutRef.current = setTimeout(() => {
                setVisible(true);
            }, SHOW_DELAY_MS);
        });

        const removeFinishListener = router.on('finish', (event) => {
            if (targetUrlRef.current !== event.detail.visit.url.href) {
                return;
            }

            clearPendingNavigation();
        });

        return () => {
            removeStartListener();
            removeFinishListener();
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    return (
<>
    <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-[2px] transition-opacity duration-200 ${
            visible ? 'opacity-100' : 'opacity-0'
        }`}
    >
        <div
            className={`flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/90 px-6 py-5 shadow-lg ring-1 ring-black/5 transition-all duration-200 ${
                visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
            }`}
        >
            <div className="relative h-10 w-10">
                {/* track */}
                <span className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                {/* spinning arc */}
                <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary motion-reduce:animate-pulse" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Loading…</span>
        </div>
    </div>

    <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {visible ? 'Loading page' : ''}
    </span>
</>
    );
}
