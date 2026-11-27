import { resolve } from 'node:path'
import { dts } from 'rolldown-plugin-dts'
import { defineConfig } from 'vite'

const src = resolve(import.meta.dirname, 'src')

export default defineConfig({
  resolve: {
    alias: {
      '@root': src,
    },
  },
  plugins: [dts({ sourcemap: true })],
  oxc: {
    exclude: [/\.js$/, /\.d\.[cm]?ts$/],
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    reportCompressedSize: false,
    lib: {
      entry: {
        index: resolve(src, 'index.ts'),
        core: resolve(src, 'core/index.ts'),
        renderer: resolve(src, 'renderer/index.ts'),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: /^@gondola-lyrics\/model(?:\/|$)/,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
      },
    },
  },
})
