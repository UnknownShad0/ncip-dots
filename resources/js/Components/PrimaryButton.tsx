import { ButtonHTMLAttributes } from 'react';

export default function PrimaryButton({
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            className={`dots-button-primary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
