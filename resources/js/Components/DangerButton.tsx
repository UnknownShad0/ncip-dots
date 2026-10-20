import { ButtonHTMLAttributes } from 'react';

export default function DangerButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={`dots-button bg-danger text-white hover:bg-danger/90 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
