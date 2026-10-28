import { Check, ChevronDown, Search } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SearchableSelectOption = {
    value: string;
    label: string;
    searchText?: string;
    disabled?: boolean;
};

type SearchableSelectProps = {
    id?: string;
    value: string | number | null | undefined;
    options: SearchableSelectOption[];
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder?: string;
    emptyOptionLabel?: string;
    emptyMessage?: string;
    ariaLabel: string;
    disabled?: boolean;
    ariaInvalid?: boolean;
    className?: string;
    buttonClassName?: string;
};

export default function SearchableSelect({
    id,
    value,
    options,
    onChange,
    placeholder,
    searchPlaceholder = 'Type to search…',
    emptyOptionLabel,
    emptyMessage = 'No matching options.',
    ariaLabel,
    disabled = false,
    ariaInvalid = false,
    className = '',
    buttonClassName = '',
}: SearchableSelectProps) {
    const generatedId = useId();
    const controlId = id ?? `searchable-select-${generatedId}`;
    const listId = `${controlId}-listbox`;
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [popupPosition, setPopupPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
    const selectedValue = value == null ? '' : String(value);
    const selectedOption = options.find((option) => option.value === selectedValue);
    const popupReady = popupPosition !== null;

    const visibleOptions = useMemo(() => {
        const term = query.trim().toLocaleLowerCase();
        const matches = options.filter((option) => !term || `${option.label} ${option.value} ${option.searchText ?? ''}`.toLocaleLowerCase().includes(term));

        return emptyOptionLabel && !term
            ? [{ value: '', label: emptyOptionLabel }, ...matches]
            : matches;
    }, [emptyOptionLabel, options, query]);

    useEffect(() => {
        if (!open) return;
        const updatePosition = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const gap = 8;
            const width = Math.min(Math.max(rect.width, 280), window.innerWidth - gap * 2);
            const left = Math.max(gap, Math.min(rect.left, window.innerWidth - width - gap));
            const below = window.innerHeight - rect.bottom - gap;
            const above = rect.top - gap;
            const openAbove = below < 280 && above > below;
            const maxHeight = Math.max(120, Math.min(288, openAbove ? above : below));
            const top = openAbove ? Math.max(gap, rect.top - maxHeight - 4) : rect.bottom + 4;
            setPopupPosition({ left, top, width, maxHeight });
        };

        setQuery('');
        setActiveIndex(0);
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

    useEffect(() => {
        if (open && popupReady) searchRef.current?.focus();
    }, [open, popupReady]);

    useEffect(() => {
        if (!open) return;
        const closeOnOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
        };
        document.addEventListener('mousedown', closeOnOutsideClick);

        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, [open]);

    const choose = (option: SearchableSelectOption) => {
        if (option.disabled) return;
        onChange(option.value);
        setOpen(false);
        setQuery('');
        triggerRef.current?.focus();
    };

    const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, visibleOptions.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            const activeOption = visibleOptions[activeIndex];
            if (activeOption) choose(activeOption);
        }
    };

    return <div ref={rootRef} className={`relative min-w-0 ${className}`}>
        <button
            ref={triggerRef}
            id={controlId}
            type="button"
            role="combobox"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-disabled={disabled}
            aria-invalid={ariaInvalid}
            disabled={disabled}
            onClick={() => setOpen((current) => !current)}
            onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setOpen(true);
                }
            }}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-left text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
        >
            <span className={`min-w-0 flex-1 truncate ${selectedOption ? '' : 'text-muted'}`}>
                {selectedOption?.label ?? placeholder}
            </span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && popupPosition && createPortal(<div ref={popupRef} style={{ left: popupPosition.left, top: popupPosition.top, width: popupPosition.width, maxHeight: popupPosition.maxHeight }} className="fixed z-[80] overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-xl">
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
                <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
                    onKeyDown={handleSearchKeyDown}
                    onBlur={() => setOpen(false)}
                    placeholder={searchPlaceholder}
                    aria-label={`Search ${ariaLabel.toLowerCase()}`}
                    aria-controls={listId}
                    aria-activedescendant={visibleOptions[activeIndex] ? `${listId}-option-${activeIndex}` : undefined}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none ring-0 placeholder:text-muted focus:border-0 focus:ring-0"
                />
            </label>
            <div id={listId} role="listbox" aria-label={ariaLabel} style={{ maxHeight: Math.max(80, popupPosition.maxHeight - 64) }} className="mt-2 overflow-y-auto overscroll-contain">
                {visibleOptions.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted">{emptyMessage}</p> : visibleOptions.map((option, index) => {
                    const selected = option.value === selectedValue;
                    const active = index === activeIndex;

                    return <button
                        key={`${option.value}:${option.label}`}
                        id={`${listId}-option-${index}`}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        tabIndex={-1}
                        disabled={option.disabled}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${active ? 'bg-secondary' : ''} ${selected ? 'font-semibold text-primary' : 'text-foreground'} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                        <span className="min-w-0 flex-1">{option.label}</span>
                        {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    </button>;
                })}
            </div>
            <p className="sr-only" aria-live="polite">{visibleOptions.length} options available</p>
        </div>, document.body)}
    </div>;
}
