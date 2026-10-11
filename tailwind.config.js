import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.tsx',
    ],

    theme: {
        extend: {
            colors: Object.fromEntries([
                'primary', 'primary-hover', 'primary-foreground', 'secondary', 'tertiary',
                'background', 'surface', 'foreground', 'muted', 'border',
                'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft',
            ].map((name) => [name, `rgb(var(--color-${name}) / <alpha-value>)`])),
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },

    plugins: [forms],
};
