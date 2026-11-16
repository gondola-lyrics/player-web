import { resolve } from 'node:path'
import { defineConfig } from 'vite'

import vue from '@vitejs/plugin-vue'

const root = import.meta.dirname
const library = resolve(root, '../src')

export default defineConfig({
  root,
  base: './',
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@gondola-lyrics\/player$/, replacement: resolve(library, 'index.ts') },
      { find: /^@gondola-lyrics\/player\/core$/, replacement: resolve(library, 'core/index.ts') },
      { find: /^@gondola-lyrics\/player\/renderer$/, replacement: resolve(library, 'renderer/index.ts') },
      { find: '@root', replacement: library },
    ],
    dedupe: ['@gondola-lyrics/model', 'vue'],
  },
  optimizeDeps: {
    exclude: ['@gondola-lyrics/player', '@gondola-lyrics/player/core', '@gondola-lyrics/player/renderer'],
  },
  server: {
    host: '127.0.0.1',
    port: 9091,
  },
  build: {
    target: 'esnext',
    outDir: resolve(root, 'dist'),
  },
})
