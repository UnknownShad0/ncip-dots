import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { Info } from 'lucide-react';
import { PropsWithChildren } from 'react';

export default function InfoTip({ children, label = 'More information' }: PropsWithChildren<{label?: string}>) {
    return <Popover className="inline-flex"><PopoverButton aria-label={label} className="rounded-full p-1.5 text-muted hover:bg-secondary hover:text-primary"><Info size={17} /></PopoverButton>
        <PopoverPanel anchor="bottom end" className="dots-workspace z-[80] mt-2 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-4 text-sm leading-relaxed text-foreground shadow-lg">{children}</PopoverPanel>
    </Popover>;
}
