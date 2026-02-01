import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    build: {
        copyPublicDir: false,
        lib: {
            entry: path.resolve(__dirname, 'src/lib/index.ts'),
            formats: ['es'],
        },
        rollupOptions: {
            output: {
                entryFileNames: '[name]-[hash].js',
            },
        },
    },
    server: {
        host: true,
    },
    worker: {
        format: 'es',
        rollupOptions: {
            output: {
                entryFileNames: '[name]-[hash].js',
            },
        },
    },
})
