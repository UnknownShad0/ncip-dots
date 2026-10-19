import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import { buildDocumentRenderer } from './scripts/build-document-renderer.mjs';

export default defineConfig({
    server: {
        watch: {
            ignored: ['**/storage/app/private/**'],
        },
    },
    plugins: [
        laravel({
            input: 'resources/js/app.tsx',
            ssr: 'resources/js/ssr.tsx',
            refresh: true,
        }),
        react(),
        {
            name: 'shared-document-renderer',
            async configureServer(server) {
                await buildDocumentRenderer();
                let build = Promise.resolve();
                server.watcher.on('change', file => {
                    if (/resources\/js\/(Components\/|document-renderer\.)/.test(file)) {
                        build = build.then(() => buildDocumentRenderer()).catch(error => server.config.logger.error(String(error)));
                    }
                });
            },
        },
    ],
});
