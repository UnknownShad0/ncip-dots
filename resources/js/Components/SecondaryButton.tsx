import { ButtonHTMLAttributes } from 'react';

export default function SecondaryButton({
    type = 'button',
    className = '',
    disabled,
    children,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            {...props}
            type={type}
            className={`dots-button-secondary disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            disabled={disabled}
        >
            {children}
        </button>
    );
}
