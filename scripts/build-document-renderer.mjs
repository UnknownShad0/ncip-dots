import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

export const buildDocumentRenderer = () => build({
    entryPoints: ['resources/js/document-renderer.tsx'],
    outfile: 'public/build/document-renderer.js',
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'chrome110',
    minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
        name: 'embedded-document-fonts',
        setup(builder) {
            // The PDF service embeds these same private fonts as data URLs.
            builder.onLoad({ filter: /document-fonts\.css$/ }, () => ({ contents: '', loader: 'css' }));
        },
    }],
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await buildDocumentRenderer();
