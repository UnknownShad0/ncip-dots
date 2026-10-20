import { PropsWithChildren } from 'react';

export default function GuestLayout({ children }: PropsWithChildren) {
    return (
        <main className="dots-guest min-h-[100dvh] px-4 py-10 sm:px-8">
            <div className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-7xl items-center justify-center">
                <section className="w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-6 shadow-2xl shadow-blue-950/20 backdrop-blur-sm sm:p-9">
                    <a href="/" className="mb-7 flex flex-col items-center text-center text-sm font-semibold tracking-[0.16em] text-primary">
                        <img src="/images/logo/ncip-logo.png" alt="National Commission on Indigenous Peoples logo" className="mb-4 h-24 w-24 object-contain" />
                        <span>DOCUMENT TRACKING SYSTEM</span>
                    </a>
                    {children}
                    <p className="mt-8 text-center border-t border-border pt-4 text-xs leading-5 text-muted">
                        National Commission on Indigenous Peoples <br/>
                       <span>Document Tracking System</span>
                    </p>
                </section>
            </div>
        </main>
    );
}
