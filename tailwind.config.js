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
            fontSize: {
                xs: ['15px', { lineHeight: '19px' }],
                sm: ['17px', { lineHeight: '23px' }],
                base: ['19px', { lineHeight: '27px' }],
                lg: ['21px', { lineHeight: '31px' }],
                xl: ['23px', { lineHeight: '31px' }],
                '2xl': ['27px', { lineHeight: '35px' }],
                '3xl': ['33px', { lineHeight: '39px' }],
                '4xl': ['39px', { lineHeight: '43px' }],
                '5xl': ['51px', { lineHeight: '51px' }],
                '6xl': ['63px', { lineHeight: '63px' }],
                '7xl': ['75px', { lineHeight: '75px' }],
                '8xl': ['99px', { lineHeight: '99px' }],
                '9xl': ['131px', { lineHeight: '131px' }],
            },
            lineHeight: {
                3: '15px',
                4: '19px',
                5: '23px',
                6: '27px',
                7: '31px',
                8: '35px',
                9: '39px',
                10: '43px',
            },
            colors: Object.fromEntries([
                'primary', 'primary-hover', 'primary-foreground', 'secondary', 'tertiary',
                'accent', 'accent-hover', 'accent-foreground',
                'sidebar', 'sidebar-foreground', 'sidebar-muted', 'sidebar-border',
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
