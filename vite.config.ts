import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        lib: {
            entry: path.resolve(__dirname, 'src/lib/qr-scanner.ts'),
        },
    },
})
